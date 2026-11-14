import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const base=process.env.SKYFORGE_TEST_URL||'http://100.105.241.126:4193';
function client(){
  let cookie='';
  return async function request(path,method='GET',body){
    const response=await fetch(base+path,{method,headers:{cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const setCookie=response.headers.get('set-cookie');
    if(setCookie)cookie=setCookie.split(';')[0];
    const value=await response.json();
    return {status:response.status,value};
  };
}
const a=client(),b=client();
const evidence={date:new Date().toISOString(),base,checks:[],provider:[],latencies:[]};
const check=(name)=>{evidence.checks.push({name,status:'PASS'});console.log('PASS',name);};
async function post(path,body){const response=await a('/api/workspace/'+path,'POST',body);assert.ok(response.status<300,JSON.stringify(response.value));return response.value;}
await a('/api/workspace/session','POST',{});
await b('/api/workspace/session','POST',{});
const chat=await post('chats',{});
assert.equal((await b('/api/workspace/chats/'+chat.id)).status,404);
check('owner-scoped conversation and empty New Chat');
const question='How did the airflow and outcome differ between T20 and T21?';
const start=performance.now();
const turn=await post('chats/'+chat.id+'/turns',{request_id:'gold-turn-1',question,language:'en'});
assert.equal(turn.state,'READY',JSON.stringify(turn));
assert.equal(turn.result.status,'ANSWERED',JSON.stringify(turn));
assert.ok(turn.result.evidence.some(item=>item.trialId==='GMT190-T20'));
assert.ok(turn.result.evidence.some(item=>item.trialId==='GMT190-T21'));
evidence.provider.push({turn_id:turn.id,model:turn.result.model,usage:turn.result.usage,duration_ms:turn.result.duration_ms});
evidence.latencies.push({name:'chat',ms:Math.round(performance.now()-start)});
const replay=await post('chats/'+chat.id+'/turns',{request_id:'gold-turn-1',question,language:'en'});
assert.equal(replay.id,turn.id);
check('live OpenRouter grounded answer and idempotent turn replay');
const fresh=await post('chats',{});
assert.equal((await a('/api/workspace/chats/'+fresh.id)).value.turns.length,0);
const comparison=await post('compare',{trials:['PSI-25:GMT190-T20','PSI-25:GMT190-T21']});
assert.deepEqual(comparison.rows.find(row=>row.field==='flow_velocity').values,['11 to 3 cm/s','11 to 47 cm/s']);
assert.deepEqual(comparison.trials[0].parameters.find(item=>item.param_key==='flow_velocity').si.values,[.11,.03]);
check('comparison preserves directional flow and NASA source anchors');
const shelf=await post('shelves',{name:'Demo BASS shelf',mode:'manual',members:['PSI-25:GMT190-T20']});
assert.equal((await b('/api/workspace/shelves/'+shelf.id)).status,404);
const memory=await post('memory',{kind:'goal',text:'Research Mars conditions',consent:true});
assert.equal((await b('/api/workspace/memory')).value.length,0);
await a('/api/workspace/memory/'+memory.id,'DELETE');
assert.equal((await a('/api/workspace/memory')).value.length,0);
check('private shelf and explicit memory create/forget');
for(const tool of ['ranking','estimation','scenario']){
  const definition=await post('analyses',{tool,target:'ISS SIBAL evidence',trials:['PSI-25:GMT190-T20'],assumptions:['Change ventilation under otherwise matched conditions']});
  const run=await post('analyses/'+definition.id+'/run',{request_id:'demo'});
  assert.ok(['READY','PARTIAL','NOT_ESTIMABLE'].includes(run.result.status));
  assert.equal((await b('/api/workspace/runs/'+run.id)).status,404);
  if(tool==='estimation')assert.equal(run.result.estimate,null);
}
const definition=await post('analyses',{tool:'estimation',target:'Synthetic Bernoulli exercise',synthetic:{n:10,k:3,a:1,b:1}});
const run=await post('analyses/'+definition.id+'/run',{request_id:'synthetic'});
assert.equal(run.result.estimate,1/3);
check('saved ranking, physical abstention, qualitative scenario and synthetic posterior');
const csv=await post('assets',{name:'synthetic-check.csv',base64:Buffer.from('trial,width_cm\nEXAMPLE,2.2\n').toString('base64')});
assert.equal((await b('/api/workspace/assets/'+csv.id+'/original')).status,404);
for(let i=0;i<35;i++){
  const files=(await a('/api/workspace/assets')).value;
  const file=files.find(item=>item.id===csv.id);
  if(file.state==='READY'){assert.equal(file.chunk_count,1);break;}
  if(file.state==='FAILED')throw Error(JSON.stringify(file));
  if(i===34)throw Error('Asset ingestion timeout');
  await new Promise(resolve=>setTimeout(resolve,1000));
}
await a('/api/workspace/assets/'+csv.id,'DELETE');
check('private CSV ingestion and source withdrawal');
const gap=await post('chats/'+fresh.id+'/turns',{request_id:'moon-gap',question:'SIBAL on the Moon 0.16g safe ventilation?',language:'en'});
assert.equal(gap.result.status,'INSUFFICIENT_EVIDENCE');
check('Moon question abstains without provider call');
const studies=(await a('/api/ingestion/studies')).value;
const image=studies.studies.flatMap(item=>item.files).find(file=>file.media==='image/jpeg');
const media=await fetch(base+image.url,{headers:{Range:'bytes=0-31'}});
assert.equal(media.status,206);
assert.equal((await media.arrayBuffer()).byteLength,32);
check('NASA image source and byte range');
if(process.env.SKYFORGE_TEST_EVIDENCE)await writeFile(process.env.SKYFORGE_TEST_EVIDENCE,JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
