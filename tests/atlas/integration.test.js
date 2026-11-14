import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASS_THREE } from '../../src/atlas/data/index.js';
import { convertNasaTable } from '../../src/atlas/nasa-import.js';
import { openAtlasStore, getRevision, parseQuery, equalQueryFilters, evaluateChecklist, updateFilter,
  proposeReevaluation, commitReevaluation, detectEvidenceGap, createMetadataAdapter, rankTrials, skipClarification } from '../../src/atlas/core/index.js';

function setup() {
  const storage = new Map();
  const store = openAtlasStore({getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)});
  const row = BASS_THREE.rows.find(item => item.trial_id === 'GMT216-T25');
  const write = value => store.commit(store.preview(JSON.stringify([value]), 'json'), {confirmed:true, acknowledgeFlags:true});
  write(row);
  return {store, row, write};
}

test('API cannot overwrite an edit made during a request or after the preview', async () => {
  const {store, row, write} = setup();
  const request = {study_id: row.study_id, trial_id: row.trial_id, field: 'sample_width_cm'};
  const correction = {proposed_raw_patch: {sample_width_cm:'2.3'}};
  let finish;
  const pending = proposeReevaluation(store, request, {adapter:{evaluate:() => new Promise(resolve => {finish=resolve;})}});
  write({...row, outcome:'Edited outcome'});
  finish(correction);
  assert.equal((await pending).status,'STALE_REVISION');
  assert.equal((await proposeReevaluation(store,{...request,revision_id:getRevision(store.load().database,row.study_id,row.trial_id).parent_revision_id},{adapter:{evaluate:()=>correction}})).status,'STALE_REVISION');
  const preview = await proposeReevaluation(store, request, {adapter:{evaluate:()=>correction}});
  write({...row, outcome:'Newer edit'});
  assert.equal(commitReevaluation(store,preview,{confirmed:true,acknowledgeFlags:true}).error.code,'STALE_PREVIEW');
  assert.equal(getRevision(store.load().database,row.study_id,row.trial_id).record.outcome.raw_display,'Newer edit');
  assert.equal(store.load().database.trials[0].revisions.length,3);
});

test('bilingual width, numeric gravity and minimum oxygen use the same checklist context', () => {
  assert.ok(equalQueryFilters(parseQuery('0g da 1.2 cm enli SIBAL mato yonishi'),parseQuery('SIBAL fabric flammability at 1.2 cm width in 0g')));
  for (const target of ['Moon 0.16g 30%+ O2','Mars 0.38g O2 30%+']) {
    const query=parseQuery(target);
    assert.equal(query.unparsed_requirements.length,0);
    assert.equal(query.filters.find(item=>item.field==='o2_concentration').operator,'gte');
  }
  const {store,row,write}=setup();
  let query=parseQuery('O2 30%+ in chamber atmosphere');
  for (const [oxygen, expected] of [[29.9,'partial'],[30,'matched'],[34,'matched']]) {
    write({...row,oxygen_vol_pct:String(oxygen)});
    const record=getRevision(store.load().database,row.study_id,row.trial_id).record;
    assert.equal(evaluateChecklist(query,record).items.find(item=>item.field==='o2_concentration').status,expected);
  }
  query=updateFilter(query,'oxygen_location',{value:'burner_flow'});
  const record=getRevision(store.load().database,row.study_id,row.trial_id).record;
  assert.equal(evaluateChecklist(query,record).items.find(item=>item.field==='o2_concentration').status,'partial');
});

test('matching partial-gravity conditions with untraceable provenance are insufficient', () => {
  const {store,row,write}=setup();
  write({...row,oxygen_vol_pct:'30',source_url:'https://example.invalid',source_excerpt:'',outcome:''});
  const adapter=createMetadataAdapter({studies:{'PSI-25':{environment:'PARTIAL_G_MOON',domain:'PREVENTION_SOLID',fuel_type:'SOLID_FABRIC'}}});
  const result=detectEvidenceGap(store.load().database,'SIBAL Moon 0.16g O2 30%+',{metadataAdapter:adapter});
  assert.equal(result.status,'Insufficient metadata');
  assert.equal(result.interpolated_values,null);
});

test('NASA table maps only three source-checked rows, preserving nominal material text', () => {
  const csv=readFileSync(new URL('../../src/atlas/data/sources/PSI-25-table-0.csv',import.meta.url),'utf8');
  const converted=convertNasaTable(csv);
  const {rows}=JSON.parse(converted);
  assert.equal(setup().store.preview(converted,'json').ok,true);
  assert.deepEqual(rows.map(row=>row.trial_id),['GMT190-T20','GMT190-T21','GMT216-T25']);
  assert.equal(rows[0].psi_csv_material_label,'1 cm SIBAL');
  assert.equal(rows[0].sample_width_cm,'1.2');
  assert.throws(()=>convertNasaTable(csv.replace(',T20,',',T999,')),/NASA_SOURCE_ROWS_INCOMPLETE/);
});

test('clarification counts actual alignment before rounding and Skip keeps order', () => {
  const {store,row,write}=setup();
  for (let index=0;index<3;index++) write({...row,trial_id:'BOUNDARY-'+index});
  const query=parseQuery('20.8% O2');
  const adapter=createMetadataAdapter({studies:{'PSI-25':{fuel_type:'SOLID_FABRIC'}}});
  const records=store.load().database.trials.map(trial=>trial.revisions[0].record);
  const options={metadataAdapter:adapter,weights:{domain:0,fuel:0.75,atmosphere:0.25,unit_family:0}};
  const atThreshold=rankTrials(records,query,options);
  assert.equal(atThreshold.clarification.high_alignment_count,4);
  assert.equal(atThreshold.clarification.needed,true);
  assert.equal(rankTrials(records.slice(0,3),query,options).clarification.needed,false);
  const skipped=rankTrials(records,skipClarification(query),options);
  assert.equal(skipped.clarification.needed,false);
  assert.deepEqual(skipped.results.map(row=>row.key),atThreshold.results.map(row=>row.key));
  const below=rankTrials(records,query,{...options,weights:{...options.weights,fuel:0.7500025,atmosphere:0.2499975}});
  assert.equal(below.results[0].alignment_score,0.699999);
  assert.equal(below.results[0].alignment_score_pct,70);
  assert.equal(below.clarification.high_alignment_count,0);
});
