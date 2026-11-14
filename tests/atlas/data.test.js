import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extractRow,reviewRecord,parseCSV,writeCSV,openAtlasStore,activeRecords,exportArchive,fieldEvidence} from '../../src/atlas/core/index.js';
import {BASS_SEED,BASS_THREE,SOURCE_REGISTRY,CONNECTED_COVERAGE,OXYGEN_CORPORA,GAP_STATUS,sourceReview,fieldProof,queryOxygen,assessEvidenceGap,checkBoundedClaim,AI_CAPABILITY} from '../../src/atlas/data/index.js';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const param=(r,k)=>r.parameters.find(p=>p.param_key===k);
const rows=BASS_THREE.rows;
const recs=rows.map(r=>reviewRecord(extractRow(r)));
const t25=read('src/atlas/data/GMT216-T25.csv');
const json=p=>JSON.parse(read('src/atlas/data/'+p));
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function commit(store,text,format='json'){
 const p=store.preview(text,format);assert.equal(p.ok,true,JSON.stringify(p.errors));
 const r=store.commit(p,{confirmed:true,acknowledgeFlags:true});assert.equal(r.ok,true,JSON.stringify(r.error));return r;
}

test('D01: authoritative rows use Z schema with NASA raw/SI cells and exact outcomes',()=>{
 const expected=[
  ['GMT190-T20',[.012],[.11,.03],[.172],'decreasing','Quenched'],
  ['GMT190-T21',[.012],[.11,.47],[.172],'increasing','Blow-off'],
  ['GMT216-T25',[.022],[.05,.025],[.208],'decreasing','Reused, ignited']];
 for(const [i,r] of recs.entries()){
  const [id,w,f,o,d,outcome]=expected[i];
  assert.equal(r.trial_id,id);assert.deepEqual(param(r,'sample_width').si,{unit:'m',values:w});
  assert.deepEqual(param(r,'flow_velocity').si.values,f);
  assert.deepEqual(param(r,'o2_concentration').si,{unit:'mol/mol',values:o});
  assert.equal(param(r,'flow_velocity').direction,d);assert.equal(r.outcome.raw_display,outcome);
  assert.equal(param(r,'o2_concentration').location,'chamber_atmosphere');
  assert.equal(sourceReview(r).status,'D_SOURCE_CHECKED');
 }
});
test('D01: NEW is not inferred; reused T25 remains flagged despite D source check',()=>{
 for(const r of recs.slice(0,2)){assert.equal(r.sample_history.value,null);assert.equal(r.sample_history.status,'NOT_PROVIDED');}
 assert.equal(recs[2].sample_history.value,'REUSED');
 assert.ok(recs[2].review.reasons.includes('REUSED_SAMPLE'));
 for(const r of recs)assert.equal(r.review.scientific_verification,'NOT_VERIFIED');
 const fake=reviewRecord(extractRow({...rows[0],sample_history:'NEW'}));
 assert.equal(sourceReview(fake).status,'REVIEW_REQUIRED');assert.ok(sourceReview(fake).reasons.includes('sample_history'));
});
test('D01: T25 original CSV physics agrees; enriched locator is explicitly additional provenance',()=>{
 const original=parseCSV(read('src/atlas/core/fixtures/GMT216-T25.csv'))[0];
 const reviewed=parseCSV(t25)[0];
 for(const k of ['trial_id','material','sample_width_cm','flow_raw','oxygen_vol_pct','oxygen_location','sample_history','outcome','pdf_page','printed_page','table','row_id'])assert.equal(reviewed[k],original[k]);
 assert.equal(original.document_id,undefined);assert.equal(reviewed.document_id,'NASA/TM-20210011385');
 assert.equal(reviewed.excerpt_kind,'TABLE_TRANSCRIPTION');
 assert.equal(reviewed.source_excerpt,'GMT216-T25 | 2.2 | 5 to 2.5 | 20.8 | Reused, ignited');
});
test('D01: sidecar preserves spatial flow, ambient location source and series-level scope',()=>{
 const f=fieldProof(recs[0],'flow_velocity').evidence;
 assert.equal(f.configuration,'concurrent');assert.equal(f.semantics_locator.pdf_page,103);
 const o=fieldProof(recs[0],'o2_concentration').evidence;
 assert.equal(o.location_locator.pdf_page,102);assert.equal(o.locator.pdf_page,104);
 const width=fieldProof(recs[0],'sample_width').evidence;assert.equal(width.raw,'1.2');
 const thickness=fieldProof(recs[0],'sample_thickness');
 assert.equal(thickness.scope,'SERIES_CONTEXT');assert.equal(thickness.evidence.si,.00032);assert.equal(thickness.evidence.approximate,true);
 assert.equal(fieldProof(recs[0],'ambient_pressure').evidence.si,101325);
});
test('D01: mutated physics or locator cannot borrow checked D evidence',()=>{
 for(const patch of [{flow_raw:'3 to 11'},{source_url:'https://example.org/fake'},{sample_width_cm:'1.3'},{oxygen_location:'burner_flow'},{outcome:'Safe'}]){
  const r=reviewRecord(extractRow({...rows[0],...patch}));
  assert.equal(sourceReview(r).status,'REVIEW_REQUIRED');assert.equal(fieldProof(r,'flow_velocity').evidence,null);
 }
});
test('D01: raw official PSI CSV joins the correct test, preserves nominal width and negative CO',()=>{
 const raw=parseCSV(read('src/atlas/data/sources/PSI-25-table-0.csv'));
 assert.equal(raw.length,129);
 const official=raw.find(r=>r['GMT']==='216'&&r['Test #']==='T25');
 assert.equal(official['Fuel Sample Material'],'2 cm SIBAL');
 assert.equal(official['Air display'],'5   2.5');assert.equal(official['Fan display'],'53   45');
 assert.equal(official['Calibrated  initial O2 % by vol'],'20.8');
 assert.equal(official['Calibrated final O2 % by vol'],'20.7');
 assert.equal(official['Initial CO (ppm)'],'-1');
 const proof=json('field-provenance.json')['GMT216-T25'];
 assert.equal(proof.gas_readings['Initial CO (ppm)'].raw,'-1');
 assert.equal(proof.gas_readings['Initial CO (ppm)'].quality,'NEGATIVE_REPORTED_VALUE_RETAINED');
 assert.equal(proof.sample_width.si,.022);
});
test('D01: real Z persistence seed/import/reload/repeat/source-chain works',()=>{
 const adapter=memory(),store=openAtlasStore(adapter);
 assert.equal(commit(store,JSON.stringify(BASS_SEED)).changes.length,2);
 assert.equal(commit(store,t25,'csv').changes.length,1);
 const repeat=commit(store,t25,'csv');assert.equal(repeat.changes.length,0);assert.equal(repeat.database.generation,2);
 const independent=openAtlasStore(adapter).load();assert.equal(independent.ok,true);
 assert.equal(activeRecords(independent.database).length,3);
 const ev=fieldEvidence(independent.database,'PSI-25','GMT216-T25','flow_velocity');
 assert.equal(ev.sources[0].excerpt_kind,'TABLE_TRANSCRIPTION');assert.equal(ev.sources[0].document_id,'NASA/TM-20210011385');
 assert.equal(ev.scientific_verification,'NOT_VERIFIED');
 assert.equal(JSON.parse(exportArchive(independent.database)).trials.length,3);
});
test('D01: source enrichment creates a revision without losing original imported provenance',()=>{
 const store=openAtlasStore(memory()),original=read('src/atlas/core/fixtures/GMT216-T25.csv');
 const a=commit(store,original,'csv');const old=a.database.trials[0].active_revision_id;
 const b=commit(store,t25,'csv');assert.equal(b.database.trials[0].revisions.length,2);
 assert.equal(fieldEvidence(b.database,'PSI-25','GMT216-T25','flow_velocity',old).sources[0].document_id,'NOT_PROVIDED');
 assert.equal(fieldEvidence(b.database,'PSI-25','GMT216-T25','flow_velocity').sources[0].document_id,'NASA/TM-20210011385');
});
test('D01: D exchange roundtrip retains source text, ordered flow and missing history',()=>{
 const raw=parseCSV(writeCSV(rows));const parsed=raw.map(r=>reviewRecord(extractRow(r)));
 for(const [i,r] of parsed.entries()){assert.equal(sourceReview(r).status,'D_SOURCE_CHECKED');assert.deepEqual(r.parameters,recs[i].parameters);}
});
test('D02: six requested PSI records have exact DOI and source-version provenance',()=>{
 const expected={'PSI-98':['10.60555/0t15-1z43',4],'PSI-99':['10.60555/2chp-m469',5],'PSI-69':['10.60555/mbq8-0451',5],'PSI-101':['10.60555/2np7-jv14',4],'PSI-159':['10.60555/cyt1-kh64',1],'PSI-117':['10.60555/gz0q-b577',2]};
 for(const [id,[doi,version]]of Object.entries(expected)){
  const r=SOURCE_REGISTRY.find(r=>r.source_id===id);assert.equal(r.doi,doi);assert.equal(r.version,version);
  assert.match(r.retrieval_url,new RegExp(id+'$'));assert.equal(r.original_source_sha256.length,64);
 }
});
test('D02: CFD, emulator, planned and simulated data are not flight material-test outcomes',()=>{
 const meta=json('sources/psi-metadata-extracts.json');
 assert.equal(meta.find(r=>r.source_id==='PSI-117').metadata.projectType,'Ground Investigation');
 assert.equal(SOURCE_REGISTRY.find(r=>r.source_id==='PSI-117').claim_type,'MODEL_RESULT');
 assert.match(meta.find(r=>r.source_id==='PSI-117').metadata.approach,/OpenFOAM/);
 assert.equal(SOURCE_REGISTRY.find(r=>r.source_id==='FM2').claim_type,'OBJECTIVE');
 assert.match(SOURCE_REGISTRY.find(r=>r.source_id==='BRE').additional_primary_url,/20160010073$/);
 assert.ok(CONNECTED_COVERAGE.find(r=>r.id==='LUCI-STUDY').simulated);
 assert.equal(OXYGEN_CORPORA.FM2,undefined);
});
test('D02: exact four gap statuses, four fixtures per planet, all branches execute',()=>{
 const fixtures=json('fixtures/planet-gap.json');
 for(const planet of ['MOON','MARS']){
  const subset=fixtures.filter(f=>f.id.startsWith(planet));assert.equal(subset.length,4);
  assert.deepEqual(new Set(subset.map(f=>f.expected_status)),new Set(Object.values(GAP_STATUS)));
  for(const f of subset){const r=assessEvidenceGap(f.query,f.records,{allowTestFixtures:f.allow_test_fixtures});assert.equal(r.status,f.expected_status,f.id);assert.equal(r.prediction,null);assert.equal(r.risk_probability,null);}
 }
});
test('D02: synthetic direct fixtures cannot enter connected scientific evidence',()=>{
 assert.equal(CONNECTED_COVERAGE.some(r=>r.test_only),false);
 for(const f of json('fixtures/planet-gap.json').filter(f=>f.expected_status===GAP_STATUS.DIRECT)){
  assert.equal(f.fixture_purpose,'Algorithm branch only; not NASA data');
  assert.notEqual(assessEvidenceGap(f.query,f.records).status,GAP_STATUS.DIRECT);
 }
});
test('D02: actual lunar/Martian surface query gets related evidence, no fabricated prediction',()=>{
 for(const [gravity,setting]of [['lunar','lunar_surface'],['martian','martian_surface']]){
  const r=assessEvidenceGap({phase:'solid',material:'SIBAL',gravity,setting});
  assert.equal(r.status,GAP_STATUS.RELATED);assert.equal(r.prediction,null);assert.equal(r.risk_probability,null);
 }
 const onlyPlan=CONNECTED_COVERAGE.filter(r=>r.kind==='PLANNED');
 assert.equal(assessEvidenceGap({phase:'solid',material:'Synergy Pro Navy',gravity:'lunar',setting:'lunar_surface'},onlyPlan).status,GAP_STATUS.NONE);
});
test('D02: all oxygen fixtures are corpus- and location-specific',()=>{
 for(const f of json('fixtures/oxygen-queries.json')){
  const r=queryOxygen(f.corpus,{minimum:f.minimum,location:f.location});
  assert.equal(r.count,f.count);assert.equal(r.status,f.status);
 }
 assert.equal(Math.max(...OXYGEN_CORPORA.CFIG_NORMAL.map(r=>r.value)),.3997);
 assert.equal(Math.max(...OXYGEN_CORPORA.CFIG_INVERSE.map(r=>r.value)),.85);
});
test('D02: oxygen corpus derives from NASA raw concentration columns, never mass flow',()=>{
 for(const [name,file,key,location]of [
  ['CFIG_NORMAL','PSI-159-table-0.csv','XO2 before test','chamber_atmosphere'],
  ['CFIG_INVERSE','PSI-159-table-1.csv','XO2','burner_flow']]){
  const raw=parseCSV(read('src/atlas/data/sources/'+file));
  for(const r of OXYGEN_CORPORA[name]){
   const source=raw.find(x=>x.Test===r.id);assert.ok(source,r.id);
   assert.equal(r.value,Number(source[key]));assert.equal(r.location,location);assert.notEqual(r.raw_column,'O2 flow rate (mg/s)');
  }
 }
 assert.equal(OXYGEN_CORPORA.CFIG_NORMAL.length,179);assert.equal(OXYGEN_CORPORA.CFIG_INVERSE.length,154);
});
test('D02: unknown/high-risk claims abstain; no live AI or fake probability is reported',()=>{
 assert.equal(checkBoundedClaim('T20_T21_OXYGEN_DIFFERENT').verdict,'CONTRADICTED');
 for(const k of ['T20_T21_NEW','T25_QUENCHED','MOON_MARS_RISK_PERCENT','arbitrary text']){
  const r=checkBoundedClaim(k);assert.equal(r.verdict,'INSUFFICIENT_EVIDENCE');assert.equal(r.risk_probability,null);assert.equal(r.arbitrary_claim_understanding,false);
 }
 assert.equal(AI_CAPABILITY.live_api,'NOT_IMPLEMENTED_NOT_TESTED');
});
test('D02: invalid oxygen/unknown query dimensions do not create apparent matches',()=>{
 assert.throws(()=>queryOxygen('UNKNOWN'),/UNKNOWN_CORPUS/);
 assert.throws(()=>queryOxygen('BASS_THREE',{minimum:30}),/INVALID_OXYGEN_FRACTION/);
 assert.equal(assessEvidenceGap({phase:'solid'}).status,GAP_STATUS.INSUFFICIENT);
});
test('D02: metadata snapshot hashes and registry references resolve',()=>{
 const p='src/atlas/data/sources/psi-metadata-extracts.json';
 const hash=createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex');
 const ids=new Set(SOURCE_REGISTRY.map(r=>r.source_id));assert.equal(ids.size,SOURCE_REGISTRY.length);
 for(const r of SOURCE_REGISTRY.filter(r=>r.source_id.startsWith('PSI-')))assert.equal(r.snapshot_sha256,hash);
 for(const r of CONNECTED_COVERAGE)assert.ok(ids.has(r.source_id));
});

test('D01: unreviewed imported fields cannot inherit checked evidence',()=>{
 const forged=reviewRecord(extractRow({...rows[0],burn_rate:'99 mm/s'}));
 assert.equal(sourceReview(forged).status,'REVIEW_REQUIRED');
 assert.ok(sourceReview(forged).reasons.includes('unreviewed_columns'));
 assert.equal(fieldProof(forged,'flow_velocity').evidence,null);
});
test('D02: a purported direct record without provenance is insufficient metadata',()=>{
 const q={phase:'solid',material:'SIBAL',gravity:'lunar',setting:'lunar_surface'};
 const r={...q,id:'unproven',kind:'MEASURED_TEST',simulated:false};
 assert.equal(assessEvidenceGap(q,[r]).status,GAP_STATUS.INSUFFICIENT);
});
