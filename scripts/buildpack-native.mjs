import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.SKYFORGE_TEST_URL||'http://100.105.241.126:4191';
const statePath=process.env.SKYFORGE_TEST_SESSION_STATE;
if(!statePath)throw new Error('Set SKYFORGE_TEST_SESSION_STATE outside the repository');
let state=process.argv.includes('--reopen')?JSON.parse(await readFile(statePath,'utf8')):{cookie:'',assets:[]};
async function api(path,method='GET',body){
  const response=await fetch(base+'/api/workspace/'+path,{method,headers:{cookie:state.cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(response.headers.has('set-cookie'))state.cookie=response.headers.get('set-cookie').split(';')[0];
  const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result;
}
if(!process.argv.includes('--reopen')){
  await api('session','POST',{});
  for(const ext of ['pdf','docx']){
    const bytes=await readFile('../buildpack-fixtures/synthetic.'+ext);
    const input={name:'synthetic-native-fixture.'+ext,base64:bytes.toString('base64')};
    const asset=await api('assets','POST',input);
    let ready;
    for(let attempt=0;attempt<90;attempt++){
      ready=(await api('assets')).find(item=>item.id===asset.id);
      if(ready.state==='READY')break;
      assert.notEqual(ready.state,'FAILED',JSON.stringify(ready));
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    assert.equal(ready.state,'READY');
    const again=await api('assets','POST',input);
    assert.equal(again.id,ready.id);assert.equal(again.version,ready.version);
    assert.equal(again.chunks.length,ready.chunk_count);
    state.assets.push({id:ready.id,name:ready.name,version:ready.version,chunks:ready.chunk_count,locators:ready.extraction.map(part=>part.locator)});
  }
  state.chat=await api('chats','POST',{});
  state.turn=await api('chats/'+state.chat.id+'/turns','POST',{question:'Salom',request_id:'persistence',language:'uz'});
  await writeFile(statePath,JSON.stringify(state));
}else{
  const assets=await api('assets');
  for(const saved of state.assets){
    const asset=assets.find(item=>item.id===saved.id);
    assert.equal(asset.state,'READY');assert.equal(asset.chunk_count,saved.chunks);
    assert.equal(asset.version,saved.version);
    const original=await fetch(base+'/api/workspace/assets/'+saved.id+'/original',{headers:{cookie:state.cookie}});
    assert.equal(original.status,200);assert.ok((await original.arrayBuffer()).byteLength>0);
    const denied=await fetch(base+'/api/workspace/assets/'+saved.id+'/original');
    assert.ok([401,404].includes(denied.status));
  }
  const chat=await api('chats/'+state.chat.id);
  assert.equal(chat.turns[0].id,state.turn.id);assert.equal(chat.turns[0].state,'READY');
  const result={date:new Date().toISOString(),base,synthetic:true,unchangedReingest:'PASS',backendRestart:'PASS',restoredChat:'PASS',originalOpen:'PASS',unauthorizedOriginal:'DENIED',assets:state.assets};
  await writeFile('docs/skyforge-build/native-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
