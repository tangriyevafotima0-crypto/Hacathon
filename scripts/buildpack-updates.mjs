import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base=(process.env.SKYFORGE_TEST_URL||'http://100.105.241.126:4193')+'/api/workspace/';
let cookie;
async function api(path,method='GET',value){
  const response=await fetch(base+path,{method,headers:{cookie:cookie||'','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});
  if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  const result=await response.json();
  assert.ok(response.status<300,JSON.stringify(result));
  return result;
}
await api('session','POST',{});
const excluded='PSI-25:GMT190-T20';
const shelf=await api('shelves','POST',{name:'Auto-updating SIBAL evidence',query:'SIBAL',mode:'smart',members:[],exclusions:[excluded],auto_update:true});
const definition=await api('analyses','POST',{tool:'ranking',target:'SIBAL ISS'});
const run=await api('analyses/'+definition.id+'/run','POST',{request_id:'before'});
const asset=await api('assets','POST',{name:'synthetic-update-trigger.txt',base64:Buffer.from('Synthetic dependency-update fixture.').toString('base64')});
let updated;
for(let attempt=0;attempt<25;attempt++){
  updated=(await api('shelves')).find(item=>item.id===shelf.id);
  if(updated.version>shelf.version&&!updated.stale)break;
  await new Promise(resolve=>setTimeout(resolve,1000));
}
assert.ok(updated.version>shelf.version);
assert.equal(updated.stale,false);
assert.equal(updated.members.includes(excluded),false);
const historical=await api('runs/'+run.id);
assert.equal(historical.stale,true);
assert.equal(historical.corpus_snapshot_id,run.corpus_snapshot_id);
const fresh=await api('analyses/'+definition.id+'/run','POST',{request_id:'after'});
assert.notEqual(fresh.id,run.id);
assert.notEqual(fresh.corpus_snapshot_id,run.corpus_snapshot_id);
await api('assets/'+asset.id,'DELETE');
const result={date:new Date().toISOString(),autoShelf:'PASS',manualExclusion:'PASS',staleRun:'PASS',immutableHistory:'PASS',explicitRerun:'PASS'};
await writeFile('docs/skyforge-build/dependency-results.json',JSON.stringify(result,null,2));
console.log(result);
