import seed from './bass-ii-seed.json' with { type: 'json' };
import three from './bass-three.json' with { type: 'json' };
import provenance from './field-provenance.json' with { type: 'json' };
import sources from './source-registry.json' with { type: 'json' };
import coverage from './coverage-records.json' with { type: 'json' };
import oxygenCorpora from './oxygen-corpora.json' with { type: 'json' };
import { extractRow, reviewRecord } from '../core/index.js';

function deepFreeze(x) {
  if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); }
  return x;
}
export const BASS_SEED = deepFreeze(seed);
export const BASS_THREE = deepFreeze(three);
export const SOURCE_REGISTRY = deepFreeze(sources);
export const CONNECTED_COVERAGE = deepFreeze(coverage);
export const OXYGEN_CORPORA = deepFreeze(oxygenCorpora);
export const GAP_STATUS = Object.freeze({
  DIRECT: 'Direct matching evidence',
  RELATED: 'Related evidence with different conditions',
  NONE: 'No matching evidence in connected corpus',
  INSUFFICIENT: 'Insufficient metadata',
});
export const AI_CAPABILITY = Object.freeze({
  engine: 'DETERMINISTIC_SOURCE_GUARDS',
  live_api: 'NOT_IMPLEMENTED_NOT_TESTED',
  arbitrary_claim_understanding: false,
  risk_probability: null,
  predictive_model: null,
});
const canonical = new Map(BASS_THREE.rows.map(r => {
  const record = reviewRecord(extractRow(r));
  return [r.trial_id, record];
}));
const param = (r, k) => r.parameters.find(p => p.param_key === k);
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);

/** D review is a separate source check; never rewrites Z import trust/revisions. */
export function sourceReview(record) {
  const expected = record?.study_id === 'PSI-25' && canonical.get(record.trial_id);
  if (!expected) return {status:'NOT_IN_D_REVIEWED_DATA', reasons:['No D-reviewed trial identity'], scientific_verification:'NOT_VERIFIED'};
  const reasons = [];
  if (record.unparsed_columns?.length) reasons.push('unreviewed_columns');
  if (record.parameters?.length !== 3) reasons.push('unreviewed_parameters');
  for (const key of ['material','claim_type']) if (record[key] !== expected[key]) reasons.push(key);
  if (!equal(record.sample_history,expected.sample_history)) reasons.push('sample_history');
  if (!equal(record.outcome,expected.outcome)) reasons.push('outcome');
  for (const key of ['sample_width','flow_velocity','o2_concentration']) {
    if (!equal(param(record,key),param(expected,key))) reasons.push(key);
  }
  if (!equal(record.sources,expected.sources) || !equal(record.field_source_refs,expected.field_source_refs)) reasons.push('source_chain');
  return {
    status:reasons.length ? 'REVIEW_REQUIRED' : 'D_SOURCE_CHECKED',
    reasons,
    scientific_verification:'NOT_VERIFIED',
    note:'D checks this exact fixture/provenance; import approval and independent scientific approval remain separate.',
  };
}

/** Sidecar adds series context without altering Z-normalized, persisted records. */
export function fieldProof(record, field) {
  const review = sourceReview(record);
  if (review.status !== 'D_SOURCE_CHECKED') return {review, field, evidence:null};
  const data = provenance[record.trial_id];
  const names = {sample_width:'sample_width',flow_velocity:'flow',o2_concentration:'oxygen',outcome:'outcome',sample_history:'sample_history',material:'material',ambient_pressure:'pressure',sample_thickness:'thickness',exposed_length:'exposed_length'};
  const evidence = data[names[field]];
  if (!evidence) return {review,field,evidence:null};
  return deepFreeze({review,field,evidence:structuredClone(evidence),scope:['ambient_pressure','sample_thickness','exposed_length','material'].includes(field)?'SERIES_CONTEXT':'TEST_ROW_WITH_CONTEXT'});
}

/** Exact four gap labels from the team plan. No interpolation or risk prediction. */
export function assessEvidenceGap(query, records=CONNECTED_COVERAGE, {allowTestFixtures=false}={}) {
  const base={prediction:null,risk_probability:null,corpus_size:records.length};
  const out=(status,reason,items=[])=>({...base,status,reason,evidence_ids:items.map(r=>r.id),source_ids:[...new Set(items.map(r=>r.source_id).filter(Boolean))]});
  if (!query || !['phase','gravity','setting'].every(k=>typeof query[k]==='string' && query[k])) {
    return out(GAP_STATUS.INSUFFICIENT,'Query needs phase, gravity and physical setting.');
  }
  const usable=records.filter(r=>allowTestFixtures || !r.test_only);
  const relevant=usable.filter(r=>r.phase===query.phase && (!query.material || !r.material || r.material===query.material));
  const observed=relevant.filter(r=>r.kind!=='PLANNED');
  if (!observed.length) return out(GAP_STATUS.NONE,
    relevant.some(r=>r.kind==='PLANNED')?'Only planned evidence is connected; plans are not completed measurements.':'No matching measured evidence in this selected corpus.',relevant);
  const checked=observed.map(r=>{
    const keys=['phase','gravity','setting',...(query.material?['material']:[]),
      ...(query.oxygen_fraction!==undefined?['oxygen_fraction','oxygen_location']:[])];
    const unknown=keys.filter(k=>r[k]===undefined || r[k]===null || r[k]==='NOT_PROVIDED');
    if (!(allowTestFixtures && r.test_only) && (!r.source_id || !r.source_url)) unknown.push('provenance');
    const different=keys.filter(k=>!unknown.includes(k) && r[k]!==query[k]);
    if(r.simulated)different.push('simulated_gravity');
    if(r.kind!=='MEASURED_TEST')different.push('evidence_granularity');
    return {r,unknown,different};
  });
  const direct=checked.filter(x=>!x.unknown.length && !x.different.length);
  if(direct.length) return out(GAP_STATUS.DIRECT,'Recorded regime and all requested conditions match; this is not material certification.',direct.map(x=>x.r));
  const related=checked.filter(x=>!x.unknown.length && x.different.length);
  if(related.length) return out(GAP_STATUS.RELATED,'Relevant observations exist, with gravity/setting/condition differences; no blended prediction.',related.map(x=>x.r));
  return out(GAP_STATUS.INSUFFICIENT,'Relevant records lack metadata needed for the requested condition match.',observed);
}

/** Concentration/location filter only: not evidence of material or gravity safety. */
export function queryOxygen(corpus, {minimum=.3, location='chamber_atmosphere'}={}) {
  if(!Number.isFinite(minimum)||minimum<0||minimum>1)throw new Error('INVALID_OXYGEN_FRACTION');
  const rows=OXYGEN_CORPORA[corpus];
  if(!rows)throw new Error('UNKNOWN_CORPUS');
  const located=rows.filter(r=>r.claim_type==='OBSERVATION' && r.location===location);
  const limit='Concentration/location matches only; no lunar/Mars or solid-material safety inference.';
  if(!located.length && rows.length) return {corpus,location,status:GAP_STATUS.INSUFFICIENT,count:null,matches:[],limit,reason:'Available oxygen belongs to a different measurement location.'};
  const matches=located.filter(r=>r.value>=minimum);
  return {corpus,location,status:matches.length?GAP_STATUS.DIRECT:GAP_STATUS.NONE,count:matches.length,matches,limit};
}

/** Bounded scientific claim keys; not an arbitrary-language AI endpoint. */
export function checkBoundedClaim(key) {
  const fixed={
    T20_T21_OXYGEN_DIFFERENT:['CONTRADICTED','Both Table7.1 rows report17.2vol%.'],
    T20_T21_OXYGEN_SAME:['SUPPORTED','Only the selected ISS rows: both17.2vol%.'],
    T20_T21_NEW:['INSUFFICIENT_EVIDENCE','No explicit NEW assertion in reviewed Table7.1/AppendixB.'],
    T25_QUENCHED:['INSUFFICIENT_EVIDENCE','Reused, ignited does not state later quenching.'],
    BASS_ON_MOON:['CONTRADICTED','Section7.1.3 places these tests aboard ISS in MSG.'],
    FM2_COMPLETED:['INSUFFICIENT_EVIDENCE','Connected FM2 source states future requirements, not completed lunar results.'],
    MOON_MARS_RISK_PERCENT:['INSUFFICIENT_EVIDENCE','No matching validated predictive model in this package.'],
  };
  const [verdict,reason]=fixed[key]??['INSUFFICIENT_EVIDENCE','Arbitrary text understanding is not implemented.'];
  return {claim_key:key,verdict,reason,source_ids:!fixed[key]?[]:key==='FM2_COMPLETED'?['FM2']:['NASA-TM-20210011385'],...AI_CAPABILITY};
}
