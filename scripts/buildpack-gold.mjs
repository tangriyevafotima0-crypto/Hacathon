import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const base=process.env.SKYFORGE_TEST_URL||'http://100.105.241.126:4193';
const cases=[
  {query:'"GMT216-T25"',trials:['GMT216-T25']},
  {query:'T20 and T21',trials:['GMT190-T20','GMT190-T21']},
  {query:'SIBAL 17.2% O2 chamber atmosphere',trials:['GMT190-T20','GMT190-T21']},
  {query:'SIBAL 17.2% O2 burner flow',trials:[]},
  {query:'SIBAL Moon 0.16g 30% O2',trials:[]},
  {query:'T25 namuna eni',trials:['GMT216-T25']},
  {query:'T25 sample width',trials:['GMT216-T25']},
];
const rows=[];
for(const item of cases){
  const start=performance.now();
  const response=await fetch(base+'/api/ingestion/search?'+new URLSearchParams({q:item.query}));
  assert.equal(response.status,200);
  const {results}=await response.json();
  const trials=[...new Set(results.map(r=>r.trialId).filter(Boolean))].sort();
  assert.deepEqual(trials,[...item.trials].sort(),item.query);
  rows.push({...item,actual:trials,status:'PASS',ms:Math.round(performance.now()-start)});
}
const times=rows.map(row=>row.ms).sort((a,b)=>a-b);
const result={date:new Date().toISOString(),corpus:'Five selected NASA metadata/table sets plus three BASS-II transcriptions',
  queries:rows,exactSetPasses:rows.length,total:cases.length,p50_ms:times[Math.floor(times.length*.5)],
  p95_ms:times[Math.min(times.length-1,Math.floor(times.length*.95))],
  scope:'Finite exact-ID and normalized BASS condition set. Does not measure universal retrieval precision.'};
await writeFile('docs/skyforge-build/GOLD_SET_RESULTS.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
