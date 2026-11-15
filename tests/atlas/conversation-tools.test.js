import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createWorkspaceApi} from '../../server/workspace-api.js';
import {runTool} from '../../server/workspace-tools.js';
import {isProductQuestion} from '../../server/conversation-router.js';

test('ranking selections limit eligible evidence without altering source scores',()=>{
 const all=runTool({tool:'ranking',target:'ISS SIBAL'});
 const only=runTool({tool:'ranking',target:'ISS SIBAL',trials:['PSI-25:GMT190-T20']});
 assert.equal(only.results.length,1);assert.equal(only.results[0].id,'PSI-25:GMT190-T20');assert.equal(only.results[0].score,all.results.find(r=>r.id===only.results[0].id).score);
 assert.equal(isProductQuestion('introduce me this base and si dash'),true);
 assert.equal(isProductQuestion('What is T20 in this dashboard?'),false);
});
test('conversation intent separates dashboard help, general conversation, research and cancellable work',async t=>{
 let retrievals=0,calls=0,block=false,started,aborted=false;
 const service=createWorkspaceApi({path:join(mkdtempSync(join(tmpdir(),'intent-')),'ws.sqlite'),
  router:{async complete({name,input,signal}){calls++;if(block){started();await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(Object.assign(Error('cancelled'),{name:'AbortError'}));},{once:true});});}
   if(name==='conversation_route')return {data:input.question==='Find relevant documents'?{route:'RESEARCH',text:''}:input.question==='What is two plus two?'?{route:'OUT_OF_CORPUS',text:''}:{route:'GENERAL',text:'I am here to help.'}};
   return {data:{status:'ANSWERED',claims:[{text:'T20 airflow 11 to 3 cm/s',evidence_ids:['T20']} ]}};}},
  retrieve:async q=>{retrievals++;return /Moon/i.test(q)?[]:[{id:'T20',studyId:'PSI-25',trialId:'GMT190-T20',text:'T20 airflow 11 to 3 cm/s',locator:'Table 7.1',sourceUrl:'https://nasa.gov'}];},search:async()=>({results:[]})});
 const server=createServer((req,res)=>void service.handle(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));service.close();});const base='http://127.0.0.1:'+server.address().port+'/api/workspace/';let cookie='';
 async function api(p,body){const r=await fetch(base+p,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;}
 await api('session',{});const c=await api('chats',{});let n=0;const ask=question=>api('chats/'+c.id+'/turns',{question,request_id:'r'+n++,language:'en'});
 const intro=await ask('introduce me this base and si dash');assert.equal(intro.result.status,'PRODUCT');assert.equal(retrievals,0);assert.equal(calls,0);assert.equal(intro.result.evidence.length,0);
 const general=await ask('How are you?');assert.equal(general.result.status,'GENERAL');assert.equal(retrievals,0);assert.equal(calls,1);
 const outside=await ask('What is two plus two?');assert.equal(outside.result.status,'INSUFFICIENT_EVIDENCE');assert.equal(outside.result.claims.length,0);assert.equal(retrievals,0);
 const research=await ask('T20 airflow?');assert.equal(research.result.status,'ANSWERED');assert.equal(retrievals,1);assert.equal(research.result.evidence[0].id,'T20');
 const routed=await ask('Find relevant documents');assert.equal(routed.result.status,'ANSWERED');assert.equal(retrievals,2);
 const moon=await ask('SIBAL on the Moon safety');assert.equal(moon.result.status,'INSUFFICIENT_EVIDENCE');assert.equal(moon.result.claims.length,0);
 block=true;const began=new Promise(r=>{started=r;});const pending=api('chats/'+c.id+'/turns',{question:'T20 again',request_id:'stop',language:'en'});await began;await api('chats/'+c.id+'/cancel',{request_id:'stop'});const cancelled=await pending;assert.equal(aborted,true);assert.equal(cancelled.state,'CANCELLED');assert.equal(cancelled.result,undefined);
});
