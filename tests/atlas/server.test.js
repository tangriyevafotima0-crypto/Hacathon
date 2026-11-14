import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createAtlasApi } from '../../server/atlas-api.js';

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

test('server bounds Gemini responses to the requested field and NASA evidence', async t => {
  const input = {study_id:'PSI-25',trial_id:'GMT216-T25',field:'sample_width_cm',source_ref_id:'PSI-25:GMT216-T25:source'};
  let expected;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url,/gemini-3\.8-flash:generateContent$/);
    assert.equal(options.headers['x-goog-api-key'],'test-credential');
    const {generationConfig,contents}=JSON.parse(options.body);
    assert.deepEqual(generationConfig.responseJsonSchema.properties.value_cm.type,['number','null']);
    assert.equal(generationConfig.responseSchema,undefined);
    if(expected?.status==='INSUFFICIENT_EVIDENCE')assert.match(contents[0].parts[0].text,/"nasa_width_cm":null/);
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(expected)}]}}],usageMetadata:{totalTokenCount:20}});
  });
  const api=createAtlasApi('test-credential');
  for (const [value,withhold_width,status,value_cm] of [
    ['2,2',false,'CONFIRMED',2.2],
    [1.2,false,'PROPOSED_CORRECTION',2.2],
    [1.2,true,'INSUFFICIENT_EVIDENCE',null],
  ]) {
    expected={...input,status,value_cm,rationale:'Table 7.1'};
    const result=await post(api,{...input,value,withhold_width});
    assert.equal(result.status,200);
    assert.equal(result.body.status,status);
    assert.deepEqual(result.body.usage,{totalTokenCount:20});
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
