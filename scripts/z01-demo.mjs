import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { openAtlasStore, activeRecords, fieldEvidence, exportJSON, exportArchive, writeCSV } from '../src/atlas/core/index.js';

// Node file adapter for reproducibility only; Bk should inject window.localStorage.
const out = new URL('../docs/z01/demo-output/',import.meta.url);
mkdirSync(out,{recursive:true});
const data = new Map();
const storage = { getItem:key => data.get(key) ?? null, setItem:(key,value) => data.set(key,value) };
const store=openAtlasStore(storage,{clock:() => '2026-11-14T07:00:00.000Z'});
function importConfirmed(text,format) {
  const plan=store.preview(text,format);
  if (!plan.ok) throw new Error(JSON.stringify(plan));
  console.log('PREVIEW',JSON.stringify(plan.entries.map(e => ({trial:e.record.trial_id,action:e.action,review:e.record.review}))));
  const result=store.commit(plan,{confirmed:true,acknowledgeFlags:true});
  if (!result.ok) throw new Error(JSON.stringify(result));
  console.log('COMMIT',JSON.stringify({changes:result.changes.length,generation:result.database.generation}));
}
importConfirmed(readFileSync(new URL('../src/atlas/core/fixtures/bass-ii-seed.json',import.meta.url),'utf8'),'json');
const t25=readFileSync(new URL('../src/atlas/core/fixtures/GMT216-T25.csv',import.meta.url),'utf8');
importConfirmed(t25,'csv');
writeFileSync(new URL('store.json',out),exportArchive(store.load().database));
// A fresh adapter reads persisted bytes from disk rather than this store instance.
const reloaded=openAtlasStore({getItem:() => readFileSync(new URL('store.json',out),'utf8'),setItem:() => {throw new Error('read-only demo reload');}}).load();
if (!reloaded.ok) throw new Error(JSON.stringify(reloaded));
console.log('RELOAD',JSON.stringify(activeRecords(reloaded.database).map(r => ({study:r.study_id,trial:r.trial_id,outcome:r.outcome.raw_display}))));
importConfirmed(t25,'csv');
const evidence=fieldEvidence(reloaded.database,'PSI-25','GMT190-T20','flow_velocity');
console.log('FIELD_EVIDENCE',JSON.stringify(evidence));
writeFileSync(new URL('exchange.json',out),exportJSON(reloaded.database));
writeFileSync(new URL('exchange.csv',out),writeCSV(activeRecords(reloaded.database).map(r => r.raw_input)));
console.log('ARTIFACTS docs/z01/demo-output/{store.json,exchange.json,exchange.csv}');
