import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  openAtlasStore,
  createMetadataAdapter,
  parseQuery,
  equalQueryFilters,
  rankTrials,
  selectLibraryStudies,
  validateTrialSelection,
  detectEvidenceGap,
  guardConclusion,
  compareTrials,
  exportReportJSON,
  exportReportCSV,
  getReevaluationApiStatus,
} from '../src/atlas/core/index.js';

const out = new URL('../docs/z02/demo-output/', import.meta.url);
mkdirSync(out, { recursive: true });

const data = new Map();
const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
const store = openAtlasStore(storage, { clock: () => '2026-11-14T08:30:00.000Z' });

const seed = readFileSync(new URL('../src/atlas/core/fixtures/bass-ii-seed.json', import.meta.url), 'utf8');
const t25 = readFileSync(new URL('../src/atlas/core/fixtures/GMT216-T25.csv', import.meta.url), 'utf8');

store.commit(store.preview(seed, 'json'), { confirmed: true, acknowledgeFlags: true });
store.commit(store.preview(t25, 'csv'), { confirmed: true, acknowledgeFlags: true });

const db = store.load().database;
const adapter = createMetadataAdapter({
  studies: {
    'PSI-25': {
      domain: 'PREVENTION_SOLID',
      fuel_type: 'SOLID_FABRIC',
      environment: 'FLIGHT_0G',
      unit_families: ['FAMILY_A_FLAME_METRICS', 'FAMILY_B_ATMOS_THERMO'],
    },
  },
});

const qUz = parseQuery('Mikrogravitatsiyada SIBAL qattiq mato kamera atmosferasida 17.2% kislorod');
const qEn = parseQuery('SIBAL solid fabric in microgravity with 17.2% oxygen in chamber atmosphere');
console.log('QUERY_EQUIVALENCE', JSON.stringify({ equal: equalQueryFilters(qUz, qEn), canonical: qUz.canonical_filters }));

const ranked = rankTrials(db, qEn, { metadataAdapter: adapter });
console.log('RANKING', JSON.stringify(ranked.results.map(r => ({
  rank: r.rank,
  trial: r.trial_id,
  tier: r.tier,
  alignment_score: r.alignment_score,
  sensitivity_warning: r.sensitivity_warning,
}))));

const library = selectLibraryStudies(db, {}, { metadataAdapter: adapter });
console.log('LIBRARY_STUDIES', JSON.stringify(library.map(s => ({ study_id: s.study_id, trials: s.trials.map(t => t.trial_id) }))));

const selection = validateTrialSelection(db, [
  { study_id: 'PSI-25', trial_id: 'GMT190-T20' },
  { study_id: 'PSI-25', trial_id: 'GMT190-T21' },
]);
console.log('SELECTION_VALID', JSON.stringify({ ok: selection.ok, count: selection.count }));

const gapLunar = detectEvidenceGap(db, 'SIBAL solid fabric on the Moon 0.16g with 34% O2', { metadataAdapter: adapter });
console.log('LUNAR_GAP', JSON.stringify({ status: gapLunar.status, interpolation_blocked: gapLunar.interpolation_blocked }));

const comparison = compareTrials(db, selection.selected, { metadataAdapter: adapter });
console.log('COMPARISON_OUTCOMES', JSON.stringify(comparison.outcomes));

const guard = guardConclusion(db, {
  text: 'In GMT190-T20, 1.2 cm SIBAL under 11 to 3 cm/s flow at 17.2% O2 resulted in Quenched.',
  citations: [{ study_id: 'PSI-25', trial_id: 'GMT190-T20', field: 'outcome' }],
});
console.log('CONCLUSION_GUARD', JSON.stringify({ ok: guard.ok, status: guard.status }));

console.log('API_STATUS', JSON.stringify(getReevaluationApiStatus()));

writeFileSync(new URL('report.json', out), exportReportJSON(db));
writeFileSync(new URL('report.csv', out), exportReportCSV(db));
console.log('ARTIFACTS docs/z02/demo-output/{report.json,report.csv}');
