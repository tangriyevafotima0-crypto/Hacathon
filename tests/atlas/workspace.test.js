import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { openWorkspace } from '../../server/workspace-store.js';
import { createWorkspaceApi } from '../../server/workspace-api.js';
import { syntheticEstimate, compareTrials, runTool } from '../../server/workspace-tools.js';

test('workspace persistence, optimistic writes, sessions and transactional cost reservations',()=>{
  const path=join(mkdtempSync(join(tmpdir(),'skyforge-')),'workspace.sqlite');
  const a=openWorkspace(path),b=openWorkspace(path);
  const session=a.session(false);
  const req={headers:{cookie:session.cookie}};
  assert.equal(b.identity(req),session.owner);
  const record=a.save(session.owner,'chat',{title:'test'});
  assert.equal(b.get(session.owner,'chat',record.id).title,'test');
  assert.equal(b.get('other','chat',record.id),undefined);
  a.save(session.owner,'chat',{title:'changed'},{id:record.id,version:1});
  assert.throws(()=>b.save(session.owner,'chat',{title:'old'},{id:record.id,version:1}),/STALE_VERSION/);
  const reservation=a.reserve('owner',6000,10000);
  assert.throws(()=>b.reserve('other',6000,10000),/BUDGET_LIMIT/);
  a.settle(reservation,1000);
  b.reserve('other',6000,10000);
  a.close();b.close();
  const reopened=openWorkspace(path);
  assert.equal(reopened.identity(req),session.owner);
  assert.equal(reopened.get(session.owner,'chat',record.id).title,'changed');
  reopened.close();
});

test('verified synthetic beta method and physical abstention preserve scientific scope',()=>{
  const result=syntheticEstimate({n:10,k:3,a:1,b:1});
  assert.equal(result.estimate,1/3);
  assert.equal(result.posterior.alpha,4);
  assert.equal(result.posterior.beta,8);
  assert.ok(Math.abs(result.interval[0]-0.109263443819098)<1e-12);
  assert.ok(Math.abs(result.interval[1]-0.609742559572421)<1e-12);
  assert.throws(()=>syntheticEstimate({n:1,k:100,a:1,b:1}),/INVALID_SYNTHETIC_INPUT/);
  assert.equal(runTool({tool:'estimation',target:'Mars safety'}).status,'NOT_ESTIMABLE');
  const comparison=compareTrials(['PSI-25:GMT190-T20','PSI-25:GMT190-T21']);
  assert.equal(comparison.rows.find(row=>row.field==='sample_width').status,'EQUIVALENT');
  assert.equal(comparison.rows.find(row=>row.field==='flow_velocity').status,'DIFFERENT');
});

test('workspace APIs isolate owners, persist lifecycle, and deduplicate concurrent chat turns',async t=>{
  const path=join(mkdtempSync(join(tmpdir(),'skyforge-api-')),'workspace.sqlite');
  let calls=0;
  let hold=false,release;
  const service=createWorkspaceApi({path,
    router:{async complete(){calls++;if(hold)await new Promise(resolve=>{release=resolve;});else await new Promise(r=>setTimeout(r,30));return {data:{status:'ANSWERED',claims:[{text:'T25 width is 2.2 cm',evidence_ids:['real']}]}};}},
    retrieve:async()=>[{id:'real',studyId:'PSI-25',trialId:'GMT216-T25',locator:'Table 7.1',text:'T25 width 2.2 cm'}],
    search:async()=>({results:[]})});
  const server=createServer((req,res)=>void service.handle(req,res,()=>{res.writeHead(404);res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));service.close();});
  const base='http://127.0.0.1:'+server.address().port+'/api/workspace/';
  async function request(cookie,path,method='GET',value){
    const response=await fetch(base+path,{method,headers:{cookie,'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});
    return {status:response.status,value:await response.json(),cookie:response.headers.get('set-cookie')};
  }
  const a=(await request('','session','POST',{})).cookie;
  const b=(await request('','session','POST',{})).cookie;
  const chat=(await request(a,'chats','POST',{})).value;
  assert.equal((await request(b,'chats/'+chat.id)).status,404);
  const turn={question:'How wide is T25?',request_id:'test',language:'en'};
  const [one,two]=await Promise.all([request(a,'chats/'+chat.id+'/turns','POST',turn),request(a,'chats/'+chat.id+'/turns','POST',turn)]);
  assert.equal(calls,1);
  const share=(await request(a,'chats/'+chat.id+'/share','POST',{})).value;
  const publicView=await request('','shared/'+share.id);
  assert.equal(publicView.status,200);
  assert.equal(publicView.value.turns[0].claims[0].evidence_ids[0],'real');
  assert.equal(publicView.value.turns[0].evidence[0].interpretation,false);
  await request(a,'chats/'+chat.id+'/share','DELETE');
  assert.equal((await request('','shared/'+share.id)).status,404);
  const note=(await request(a,'notes','POST',{title:'private',text:'My notes'})).value;
  assert.equal((await request(b,'notes/'+note.id,'DELETE')).status,404);
  assert.equal((await request(a,'notes','GET')).value[0].text,'My notes');

  assert.ok([one.value,two.value].some(item=>item.state==='READY'));
  assert.equal((await request(a,'chats/'+chat.id+'/turns','POST',turn)).value.state,'READY');
  assert.equal(calls,1);
  const empty=(await request(a,'chats','POST',{})).value;
  assert.equal((await request(a,'chats/'+empty.id)).value.turns.length,0);
  const changed=await request(a,'chats/'+empty.id,'PATCH',{version:empty.version,title:'Archive test',archived:true});
  assert.equal(changed.status,200);
  assert.equal((await request(a,'chats?archived=1&q=Archive')).value.length,0);
  assert.equal((await request(a,'chats/'+empty.id,'PATCH',{version:empty.version,title:'Stale'})).status,409);
  assert.equal((await request(a,'chats/'+empty.id,'DELETE')).status,200);
  assert.equal((await request(a,'chats/'+empty.id)).status,404);
  assert.equal((await request(a,'memory','POST',{text:'Mars',kind:'goal'})).status,400);
  const memo=(await request(a,'memory','POST',{text:'Mars',kind:'goal',consent:true})).value;
  assert.equal((await request(b,'memory/'+memo.id,'DELETE')).status,404);
  assert.equal((await request(a,'memory/'+memo.id,'DELETE')).status,200);
  assert.equal((await request(a,'memory')).value.length,0);
  const streamChat=(await request(a,'chats','POST',{})).value;
  const streamed=await fetch(base+'chats/'+streamChat.id+'/turns',{method:'POST',headers:{cookie:a,'Content-Type':'application/json',Accept:'text/event-stream'},
    body:JSON.stringify({question:'How wide is T25?',request_id:'stream',language:'en'})});
  const stream=await streamed.text();
  assert.match(stream,/event: run.started/);
  assert.match(stream,/event: response.validated/);
  hold=true;
  const cancelChat=(await request(a,'chats','POST',{})).value;
  const pending=request(a,'chats/'+cancelChat.id+'/turns','POST',{question:'T25 width?',request_id:'cancel',language:'en'});
  while(!release)await new Promise(resolve=>setTimeout(resolve,2));
  await request(a,'chats/'+cancelChat.id+'/cancel','POST',{request_id:'cancel'});
  release();
  assert.equal((await pending).value.state,'CANCELLED');
  hold=false;
  const uploaded=await request(a,'assets','POST',{name:'experiment.csv',base64:Buffer.from('trial,width_cm\nU1,2.2\n').toString('base64')});
  assert.equal(uploaded.status,202);
  assert.equal((await request(b,'assets/'+uploaded.value.id+'/original')).status,404);
  assert.equal((await request(b,'assets')).value.length,0);
  let files=[];
  for(let i=0;i<30;i++){
    files=(await request(a,'assets')).value;
    if(files[0].state==='READY')break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(files[0].state,'READY');
  assert.equal(files[0].chunk_count,1);
  await request(a,'assets/'+uploaded.value.id,'DELETE');
  assert.equal((await request(a,'assets')).value.length,0);
});
