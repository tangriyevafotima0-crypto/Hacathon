import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createAtlasApi } from '../../server/atlas-api.js';
import { createOpenRouter } from '../../server/openrouter.js';
import { answerAtlas } from '../../server/atlas-answer.js';

async function post(api, input) {
  const request = Readable.from([JSON.stringify(input)]);
  request.url = '/api/re-evaluate';
  request.method = 'POST';
  return new Promise((resolve, reject) => {
    const response = {
      writeHead(status) { this.status = status; },
      end(body) { resolve({status:this.status,body:JSON.parse(body)}); },
    };
    api(request,response,() => reject(new Error('Route not handled'))).catch(reject);
  });
}

test('server bounds OpenRouter responses to the requested field and NASA evidence', async t => {
  const input = {study_id:'PSI-25',trial_id:'GMT216-T25',field:'sample_width_cm',source_ref_id:'PSI-25:GMT216-T25:source'};
  const {study_id,...identifiers}=input;
  let expected;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer test-credential');
    const {response_format,messages}=JSON.parse(options.body);
    assert.deepEqual(response_format.json_schema.schema.properties.value_cm.type,['number','null']);
    if(expected?.status==='INSUFFICIENT_EVIDENCE')assert.equal(JSON.parse(messages[1].content).nasa_width_cm,null);
    return Response.json({choices:[{message:{content:JSON.stringify(expected)}}],usage:{total_tokens:20}});
  });
  const api=createAtlasApi(createOpenRouter({key:'test-credential'}));
  for (const [value,withhold_width,status,value_cm] of [
    ['2,2',false,'CONFIRMED',2.2],
    [1.2,false,'PROPOSED_CORRECTION',2.2],
    [1.2,true,'INSUFFICIENT_EVIDENCE',null],
  ]) {
    expected={...identifiers,status,value_cm,rationale:'Table 7.1'};
    const result=await post(api,{...input,value,withhold_width});
    assert.equal(result.status,200);
    assert.equal(result.body.status,status);
    assert.deepEqual(result.body.usage,{total_tokens:20});
    assert.ok(result.body.duration_ms>=0);
    assert.deepEqual(result.body.proposed_raw_patch,status==='PROPOSED_CORRECTION'?{sample_width_cm:'2.2'}:undefined);
  }
  expected={...input,trial_id:'GMT190-T20',status:'CONFIRMED',value_cm:2.2,rationale:'Wrong trial'};
  assert.equal((await post(api,{...input,value:2.2})).body.error,'API_INVALID_RESPONSE');
  expected=null;
  assert.equal((await post(api,{...input,value:2.2})).body.error,'API_INVALID_RESPONSE');
  const fetchCount=globalThis.fetch.mock.callCount();
  for(const value of ['', '0x2', 0, -1, {}])assert.equal((await post(api,{...input,value})).status,400);
  assert.equal((await post(api,{...input,trial_id:'OTHER',value:2.2})).status,400);
  assert.equal(globalThis.fetch.mock.callCount(),fetchCount);
  assert.equal((await post(createAtlasApi(),input)).body.error,'API_UNAVAILABLE');
});

test('Ask AI rejects invented evidence IDs and skips the provider with no evidence', async () => {
  const evidence=[{id:'real-id',studyId:'PSI-25',kind:'NASA_TABLE_TRANSCRIPTION',locator:'Table 7.1',text:'T25: 2.2 cm'}];
  let calls=0;
  let id='invented';
  const router={async complete(){calls++;return {data:{status:'ANSWERED',claims:[{text:'2.2 cm',evidence_ids:[id]}]}};}};
  assert.equal((await answerAtlas(router,'T25?','uz',[])).status,'INSUFFICIENT_EVIDENCE');
  assert.equal(calls,0);
  await assert.rejects(answerAtlas(router,'T25?','uz',evidence),{message:'API_INVALID_RESPONSE'});
  id='real-id';
  assert.deepEqual((await answerAtlas(router,'T25?','uz',evidence)).evidence,evidence);
  const inventedNumber={async complete(){return {data:{status:'ANSWERED',claims:[{text:'The width is 99 cm.',evidence_ids:['real-id']}]}};}};
  await assert.rejects(answerAtlas(inventedNumber,'T25?','uz',evidence),{message:'API_UNSUPPORTED_NUMBER'});
});

test('OpenRouter exposes auth, credit, quota, timeout and malformed output without retries',async t=>{
  let reply=401;
  const mocked=t.mock.method(globalThis,'fetch',async()=>{
    if(reply==='timeout')throw new DOMException('timeout','TimeoutError');
    if(reply==='malformed')return Response.json({choices:[{message:{content:'not json'}}]});
    return new Response('',{status:reply});
  });
  const router=createOpenRouter({key:'test-key'});
  for(const [status,code] of [[401,'OPENROUTER_AUTH'],[402,'OPENROUTER_CREDIT'],[429,'API_QUOTA'],[502,'API_PROVIDER_FAILED'],['timeout','UPSTREAM_TIMEOUT'],['malformed','API_INVALID_RESPONSE']]){
    reply=status;
    const count=mocked.mock.callCount();
    await assert.rejects(router.complete({name:'test',schema:{type:'object'},instructions:'test',input:{}}),{message:code});
    assert.equal(mocked.mock.callCount(),count+1);
  }
});
