import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, writeCSV, extractRow, reviewRecord, previewImport, emptyDatabase, openAtlasStore, activeRecords, exportJSON, exportArchive, getRevision, fieldEvidence } from '../../src/atlas/core/index.js';

const seed = readFileSync(new URL('../../src/atlas/core/fixtures/bass-ii-seed.json', import.meta.url),'utf8');
const csv = readFileSync(new URL('../../src/atlas/core/fixtures/GMT216-T25.csv', import.meta.url),'utf8');
const t25 = parseCSV(csv)[0];
const seedRows = JSON.parse(seed).rows;
const param = (r,k) => r.parameters.find(p => p.param_key === k);
function memory() {
  const map = new Map();
  return { getItem:k => map.get(k) ?? null, setItem:(k,v) => map.set(k,v), map };
}
function commit(store, text, format='json') {
  const plan = store.preview(text,format);
  assert.equal(plan.ok,true,JSON.stringify(plan.errors));
  const result = store.commit(plan,{ confirmed:true, acknowledgeFlags:true });
  assert.equal(result.ok,true,JSON.stringify(result.error)); return result;
}
const input = row => JSON.stringify([row]);

test('NASA Table 7.1 regression: width is 1.2 cm, ordered opposite protocols, distinct outcomes and page locators', () => {
  const p = previewImport(seed,'json',emptyDatabase());
  assert.equal(p.ok,true);
  const [t20,t21] = p.entries.map(e => e.record);
  for (const r of [t20,t21]) {
    assert.equal(r.study_id,'PSI-25');
    assert.deepEqual(param(r,'sample_width').si,{ unit:'m',values:[.012] });
    assert.equal(r.parameters.some(p => p.param_key === 'sample_thickness'),false);
    assert.deepEqual(param(r,'o2_concentration').si,{ unit:'mol/mol',values:[.172] });
    assert.equal(r.sample_history.status,'NOT_PROVIDED');
    assert.equal(r.sample_history.value,null);
    assert.equal(r.sources[0].pdf_page,104); assert.equal(r.sources[0].printed_page,96);
    assert.equal(r.sources[0].table,'7.1'); assert.equal(r.sources[0].row_id,r.trial_id);
    assert.equal(r.review.scientific_verification,'NOT_VERIFIED');
  }
  assert.deepEqual(param(t20,'flow_velocity').raw.values,[11,3]);
  assert.deepEqual(param(t20,'flow_velocity').si.values,[.11,.03]);
  assert.equal(param(t20,'flow_velocity').direction,'decreasing');
  assert.deepEqual(param(t21,'flow_velocity').si.values,[.11,.47]);
  assert.equal(param(t21,'flow_velocity').direction,'increasing');
  assert.equal(t20.outcome.raw_display,'Quenched'); assert.equal(t21.outcome.raw_display,'Blow-off');
});

test('provided comma-quoted T25 imports exactly, flagged REUSED, raw and SI retained', () => {
  const p = previewImport(csv,'csv',emptyDatabase());
  assert.equal(p.ok,true); const r = p.entries[0].record;
  assert.equal(r.outcome.raw_display,'Reused, ignited');
  assert.equal(r.sample_history.value,'REUSED');
  assert.ok(r.review.reasons.includes('REUSED_SAMPLE'));
  assert.equal(r.review.status,'FLAGGED_FOR_REVIEW');
  assert.deepEqual(param(r,'sample_width').si.values,[.022]);
  assert.deepEqual(param(r,'flow_velocity').si.values,[.05,.025]);
  assert.deepEqual(param(r,'o2_concentration').si.values,[.208]);
  assert.equal(param(r,'o2_concentration').location,'chamber_atmosphere');
  assert.deepEqual(r.raw_input,t25);
});

test('CSV preserves escaped quotes, embedded CRLF, BOM, quoted commas, empty fields', () => {
  const rows = parseCSV('\uFEFFa,b,c\r\n"x,""y""","line1\r\nline2",\r\n');
  assert.deepEqual(rows,[{a:'x,"y"',b:'line1\r\nline2',c:''}]);
  assert.deepEqual(parseCSV(writeCSV(rows)),rows);
});
test('malformed CSV and ambiguous column counts fail rather than guess', () => {
  for (const s of ['a,a\n1,2','a,b\n1,2,3','a\n"open','a\n"x"z','a\nx"y','__proto__\nx']) assert.throws(() => parseCSV(s));
});
test('decimal comma is supported in quoted cells and JSON, never as a thousands separator', () => {
  const r = extractRow({...t25,sample_width_cm:'2,2',flow_raw:'5 → 2,5',oxygen_vol_pct:'20,8'});
  assert.deepEqual(param(r,'flow_velocity').si.values,[.05,.025]);
  assert.equal(param(r,'sample_width').raw.text,'2,2');
  assert.throws(() => extractRow({...t25,sample_width_cm:'2,200,000'}),/INVALID_NUMBER/);
});
test('missing oxygen remains unknown, zero is measured, statuses remain distinct', () => {
  for (const status of ['NOT_PROVIDED','NOT_EXTRACTED','NOT_APPLICABLE','CONFLICTING']) {
    const p = param(extractRow({...t25,oxygen_vol_pct:'',oxygen_status:status}),'o2_concentration');
    assert.equal(p.status,status); assert.deepEqual(p.si.values,[]);
  }
  assert.deepEqual(param(extractRow({...t25,oxygen_vol_pct:'0'}),'o2_concentration').si.values,[0]);
  assert.equal(param(extractRow({...t25,oxygen_location:''}),'o2_concentration').location,'NOT_PROVIDED');
  assert.throws(() => extractRow({...t25,oxygen_status:'NOT_APPLICABLE'}),/MISSING_STATE_HAS_VALUE/);
});
test('unit families, physical ranges, IDs and safe source URLs are enforced', () => {
  const cases = [{flow_unit:'m'}, {sample_width_unit:'m/s'}, {oxygen_unit:'cm'}, {oxygen_vol_pct:'101'},
    {flow_raw:'-1 to 3'}, {flow_raw:'1 to 2 to 3'}, {sample_width_cm:'0'}, {sample_width_cm:'Infinity'},
    {trial_id:''}, {source_url:'javascript:alert(1)'}, {source_url:'https://u:password@example.com'}, {pdf_page:'1.2'},
    {oxygen_location:'somewhere'}, {sample_history:'new'}, {claim_type:'CERTIFIED'}];
  for (const patch of cases) assert.throws(() => extractRow({...t25,...patch}),JSON.stringify(patch));
  const r = extractRow({...t25,sample_width_raw:'.022',sample_width_unit:'m',flow_raw:'.05 to .025',flow_unit:'m/s',oxygen_raw:'.208',oxygen_unit:'mol/mol'});
  assert.deepEqual(param(r,'flow_velocity').si.values,[.05,.025]);
});
test('unknown columns are retained with NOT_EXTRACTED and flagged; SI assertions are never trusted', () => {
  const r = reviewRecord(extractRow({...t25,burn_rate:'99',si_display:'0.99 m/s'}));
  assert.ok(r.review.reasons.includes('UNMAPPED_COLUMNS'));
  assert.deepEqual(r.unparsed_columns.map(p => p.status),['NOT_EXTRACTED','NOT_EXTRACTED']);
  assert.deepEqual(param(r,'flow_velocity').si.values,[.05,.025]);
});
test('burner oxygen never becomes chamber oxygen', () => {
  const r = extractRow({...t25,oxygen_vol_pct:'85',oxygen_location:'burner_flow'});
  assert.equal(param(r,'o2_concentration').location,'burner_flow');
  assert.equal(param(r,'o2_concentration').si.values[0],.85);
});
test('preview is read-only; explicit confirmation and flagged review acknowledgement are required', () => {
  const storage = memory(), store = openAtlasStore(storage);
  const p = store.preview(csv,'csv');
  assert.equal(storage.map.size,0);
  assert.equal(store.commit(p).error.code,'CONFIRMATION_REQUIRED');
  assert.equal(store.commit(p,{confirmed:true}).error.code,'FLAG_ACKNOWLEDGEMENT_REQUIRED');
  assert.equal(storage.map.size,0);
  assert.throws(() => { p.entries[0].record.outcome.raw_display = 'safe'; },TypeError);
  assert.equal(store.commit({...p},{confirmed:true,acknowledgeFlags:true}).error.code,'INVALID_PREVIEW');
});
test('seed + T25 commit, independent reload, repeat import and historical repeat are idempotent', () => {
  const storage=memory(), store=openAtlasStore(storage);
  commit(store,seed); commit(store,csv,'csv');
  const reload = openAtlasStore(storage);
  let db = reload.load().database;
  assert.equal(db.trials.length,3);
  assert.equal(activeRecords(db).find(r => r.trial_id === 'GMT216-T25').outcome.raw_display,'Reused, ignited');
  const duplicate = commit(reload,csv,'csv');
  assert.equal(duplicate.changes.length,0); assert.equal(duplicate.database.generation,2);
  const changed=commit(reload,input({...t25,outcome:'Changed pending D review'}));
  const trial=changed.database.trials.find(t => t.trial_id === 'GMT216-T25');
  assert.equal(trial.revisions.length,2);
  assert.equal(trial.revisions[1].parent_revision_id,trial.revisions[0].revision_id);
  const replay=commit(reload,csv,'csv');
  assert.equal(replay.changes.length,0);
  assert.equal(replay.database.trials[2].active_revision_id,trial.active_revision_id);
  assert.equal(trial.revisions[0].record.outcome.raw_display,'Reused, ignited');
});
test('same child ID in different studies is distinct; batch duplicates collapse; conflicting batch fails atomically', () => {
  const storage=memory(), store=openAtlasStore(storage);
  const same = commit(store,JSON.stringify([t25,t25,{...t25,study_id:'OTHER-STUDY'}]));
  assert.equal(same.database.trials.length,2); assert.equal(same.changes.length,2);
  const before=JSON.stringify(store.load().database);
  const p=store.preview(JSON.stringify([t25,{...t25,outcome:'conflict'}]),'json');
  assert.equal(p.ok,false); assert.match(p.errors[0].message,/CONFLICTING_DUPLICATE/);
  assert.equal(store.commit(p,{confirmed:true,acknowledgeFlags:true}).error.code,'INVALID_PREVIEW');
  assert.equal(JSON.stringify(store.load().database),before);
});
test('stale tab preview is rejected and can be regenerated without overwriting another tab', () => {
  const storage=memory(), a=openAtlasStore(storage), b=openAtlasStore(storage);
  const pa=a.preview(csv,'csv'), pb=b.preview(seed,'json');
  assert.equal(a.commit(pa,{confirmed:true,acknowledgeFlags:true}).ok,true);
  assert.equal(b.commit(pb,{confirmed:true,acknowledgeFlags:true}).error.code,'STALE_PREVIEW');
  assert.equal(commit(b,seed).database.trials.length,3);
});
test('quota failure keeps durable state unchanged and lets the same plan retry', () => {
  const storage=memory(), store=openAtlasStore(storage); commit(store,seed);
  const previous=storage.getItem('skyforge.atlas.v1');
  const p=store.preview(csv,'csv'), original=storage.setItem;
  storage.setItem=() => { throw new Error('QuotaExceededError'); };
  assert.equal(store.commit(p,{confirmed:true,acknowledgeFlags:true}).error.code,'STORE_WRITE_FAILED');
  assert.equal(storage.getItem('skyforge.atlas.v1'),previous);
  storage.setItem=original;
  assert.equal(store.commit(p,{confirmed:true,acknowledgeFlags:true}).ok,true);
});
test('corruption, future schema, forged normalized values and denied reads never silently reset the store', () => {
  for (const raw of ['{broken','{"schema_version":"future"}', JSON.stringify({schema_version:'skyforge.atlas/1',generation:0,trials:[{}]})]) {
    const storage=memory(); storage.setItem('skyforge.atlas.v1',raw);
    const store=openAtlasStore(storage);
    assert.equal(store.load().ok,false); assert.equal(store.preview(csv,'csv').ok,false);
    assert.equal(storage.getItem('skyforge.atlas.v1'),raw);
  }
  const storage=memory(), store=openAtlasStore(storage); const result=commit(store,seed);
  const corrupt=JSON.parse(exportArchive(result.database)); corrupt.trials[0].revisions[0].record.parameters[0].si.values=[99];
  storage.setItem('skyforge.atlas.v1',JSON.stringify(corrupt));
  assert.equal(store.load().error.code,'STORE_READ_FAILED');
  assert.equal(openAtlasStore({getItem:() => {throw new Error('SecurityError');},setItem(){}}).load().ok,false);
  assert.equal(openAtlasStore(null).load().ok,false);
});
test('source evidence resolves per field and revision, JSON exchange reimports source-linked values', () => {
  const storage=memory(), store=openAtlasStore(storage); commit(store,seed); let result=commit(store,csv,'csv');
  const old=getRevision(result.database,'PSI-25','GMT216-T25');
  result=commit(store,input({...t25,source_url:'https://ntrs.nasa.gov/citations/20210011385',outcome:'reviewed draft'}));
  const evidence=fieldEvidence(result.database,'PSI-25','GMT216-T25','flow_velocity',old.revision_id);
  assert.equal(evidence.sources[0].url,t25.source_url);
  assert.equal(evidence.revision_id,old.revision_id);
  assert.equal(fieldEvidence(result.database,'PSI-25','GMT216-T25','invented'),null);
  const other=openAtlasStore(memory()); const imported=commit(other,exportJSON(result.database));
  assert.deepEqual(activeRecords(imported.database),activeRecords(result.database));
  const backed=JSON.parse(exportArchive(result.database));
  assert.equal(backed.trials[2].revisions.length,2);
});
test('JSON nested values, wrong schema and unsupported formats fail with no partial commit', () => {
  for (const [text,format] of [[input({...t25,oxygen_vol_pct:{value:20.8}}),'json'],['{}','json'],['[]','json'],['{}','xls'],['{"schema_version":"future","rows":[]}','json']]) {
    assert.equal(previewImport(text,format,emptyDatabase()).ok,false);
  }
});

test('unit-bearing column aliases cannot silently change units or contradict flexible values', () => {
  for (const patch of [{sample_width_unit:'m'},{oxygen_unit:'mol/mol'},{sample_width_raw:'99'}, {oxygen_raw:'40'}]) {
    assert.throws(() => extractRow({...t25,...patch}),/UNIT_COLUMN_CONFLICT|ALIAS_VALUE_CONFLICT/);
  }
});
test('unextracted and conflicting raw text survives without inventing normalized numbers', () => {
  for (const state of ['NOT_EXTRACTED','CONFLICTING']) {
    const r=reviewRecord(extractRow({...t25,flow_raw:'5 or 6? original illegible',flow_status:state}));
    const p=param(r,'flow_velocity');
    assert.equal(p.raw.text,'5 or 6? original illegible'); assert.deepEqual(p.si.values,[]);
    assert.equal(p.direction,'unknown'); assert.equal(p.status,state);
  }
});

test('mixed-column source-linked CSV round trip preserves physics, outcomes, missing states and evidence', () => {
  const store=openAtlasStore(memory()); commit(store,seed); const saved=commit(store,csv,'csv');
  const records=activeRecords(saved.database);
  const text=writeCSV(records.map(r => r.raw_input));
  const other=openAtlasStore(memory()); const imported=commit(other,text,'csv');
  const after=activeRecords(imported.database);
  for (let i=0;i<records.length;i++) {
    assert.deepEqual(after[i].parameters,records[i].parameters);
    assert.deepEqual(after[i].sources,records[i].sources);
    assert.deepEqual(after[i].outcome,records[i].outcome);
    assert.deepEqual(after[i].sample_history,records[i].sample_history);
  }
  assert.equal(commit(other,text,'csv').changes.length,0);
});
