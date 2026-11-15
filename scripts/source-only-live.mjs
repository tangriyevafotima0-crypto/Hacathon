import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
const base=process.env.SKYFORGE_TEST_URL||'http://100.105.241.126:4191';let cookie='';const results=[];
async function api(path,body){const response=await fetch(base+'/api/workspace/'+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const d=await response.json();assert.ok(response.ok,JSON.stringify(d));return d;}
await api('session',{});const chat=await api('chats',{});let request=0;
for(const item of [
 {question:'introduce me this base and si dash',language:'en',expected:'PRODUCT'},
 {question:'shu dashboardni tanishtirib ber',language:'uz',expected:'PRODUCT'},
 {question:'How are you today?',language:'en',expected:'GENERAL'},
 {question:'What is the capital of France?',language:'en',expected:'INSUFFICIENT_EVIDENCE'},
 {question:'Bugun Londonda ob-havo qanday?',language:'uz',expected:'INSUFFICIENT_EVIDENCE'},
 {question:'T9999 sinovida havo oqimi qancha?',language:'uz',expected:'INSUFFICIENT_EVIDENCE'},
 {question:'T20 va T21 da havo oqimi va natijasi qanday farq qilgan?',language:'uz',expected:'ANSWERED'},
 {question:'How did airflow and outcomes differ between T20 and T21?',language:'en',expected:'ANSWERED'}
]){const turn=await api('chats/'+chat.id+'/turns',{question:item.question,language:item.language,request_id:'source-only-'+request++});assert.equal(turn.state,'READY',JSON.stringify(turn));assert.equal(turn.result.status,item.expected,JSON.stringify(turn));if(item.expected==='ANSWERED'){assert.ok(turn.result.evidence.some(e=>e.trialId==='GMT190-T20'));assert.ok(turn.result.evidence.some(e=>e.trialId==='GMT190-T21'));}else assert.equal(turn.result.evidence.length,0);if(item.expected==='INSUFFICIENT_EVIDENCE')assert.equal(turn.result.claims.length,0);results.push({...item,actual:turn.result.status,claims:turn.result.claims,evidence:turn.result.evidence.map(e=>e.locator),usage:turn.result.usage,status:'PASS'});console.log('PASS',item.question);}
for(const tool of ['ranking','scenario']){const plan=await api('analysis-preview',{tool,target:'ISS SIBAL airflow evidence',language:'en'});assert.ok(plan.explanation?.length);assert.ok(Object.values(plan.weights).some(v=>v>0));results.push({tool,aiSettings:'PASS',explanation:plan.explanation,assumptions:plan.assumptions});console.log('PASS AI settings',tool);}
await writeFile('docs/skyforge-build/source-only-live.json',JSON.stringify({date:new Date().toISOString(),base,results},null,2));
