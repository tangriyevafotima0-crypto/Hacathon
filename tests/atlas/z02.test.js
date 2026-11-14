import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  trialKey,
  parseCSV,
  extractRow,
  reviewRecord,
  openAtlasStore,
  readImport,
  exportJSON,
  exportArchive,
  createMetadataAdapter,
  resolveMetadata,
  ALIGNMENT_THRESHOLD_PCT,
  SCORE_TERMINOLOGY,
  parseQuery,
  addFilter,
  updateFilter,
  removeFilter,
  skipClarification,
  equalQueryFilters,
  evaluateChecklist,
  DEFAULT_WEIGHTS,
  rankTrials,
  selectLibraryStudies,
  selectStudyTrials,
  validateTrialSelection,
  updateTrialSelection,
  EVIDENCE_GAP_STATUSES,
  detectEvidenceGap,
  guardConclusion,
  compareTrials,
  REPORT_SCHEMA_VERSION,
  buildReportRows,
  exportReportJSON,
  exportReportCSV,
  API_STATUS_UNAVAILABLE,
  getReevaluationApiStatus,
  proposeReevaluation,
  cancelReevaluation,
  commitReevaluation,
} from '../../src/atlas/core/index.js';

const seedText = readFileSync(new URL('../../src/atlas/core/fixtures/bass-ii-seed.json', import.meta.url), 'utf8');
const t25CsvText = readFileSync(new URL('../../src/atlas/core/fixtures/GMT216-T25.csv', import.meta.url), 'utf8');

function memoryStorage() {
  const map = new Map();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), map };
}

function buildSeededStore(extraRows = []) {
  const storage = memoryStorage();
  const store = openAtlasStore(storage, { clock: () => '2026-11-14T08:00:00.000Z' });
  const p1 = store.preview(seedText, 'json');
  assert.equal(p1.ok, true);
  assert.equal(store.commit(p1, { confirmed: true, acknowledgeFlags: true }).ok, true);

  const p2 = store.preview(t25CsvText, 'csv');
  assert.equal(p2.ok, true);
  assert.equal(store.commit(p2, { confirmed: true, acknowledgeFlags: true }).ok, true);

  if (extraRows.length > 0) {
    const p3 = store.preview(JSON.stringify(extraRows), 'json');
    assert.equal(p3.ok, true, JSON.stringify(p3.errors));
    assert.equal(store.commit(p3, { confirmed: true, acknowledgeFlags: true }).ok, true);
  }
  return { store, storage, database: store.load().database };
}

const studyAdapter = createMetadataAdapter({
  studies: {
    'PSI-25': {
      domain: 'PREVENTION_SOLID',
      fuel_type: 'SOLID_FABRIC',
      environment: 'FLIGHT_0G',
      unit_families: ['FAMILY_A_FLAME_METRICS', 'FAMILY_B_ATMOS_THERMO'],
    },
    'PSI-159': {
      domain: 'GAS_EMULATION',
      fuel_type: 'GAS_BURNER',
      environment: 'FLIGHT_PROXY_0G',
      unit_families: ['FAMILY_B_ATMOS_THERMO'],
      is_proxy: true,
    },
  },
});

test('Z02.1 UZ/EN query equivalence, source_text preservation, filter editing, unparsed retention, and 70% alignment_score terminology', () => {
  const uz = parseQuery('Mikrogravitatsiyada SIBAL qattiq mato kamera atmosferasida 17.2% kislorod va 11 -> 3 cm/s oqim');
  const en = parseQuery('SIBAL solid fabric in microgravity with 17.2% oxygen in chamber atmosphere and 11 to 3 cm/s flow');

  assert.equal(equalQueryFilters(uz, en), true);
  assert.deepEqual(uz.canonical_filters, en.canonical_filters);

  // Every extracted filter preserves its original text from the question
  for (const f of uz.filters) {
    assert.ok(f.source_text.length > 0, `Filter ${f.field} missing source_text`);
  }
  const o2Uz = uz.filters.find(f => f.field === 'o2_concentration');
  assert.equal(o2Uz.si_value, 0.172);
  assert.equal(o2Uz.location, 'chamber_atmosphere');
  assert.match(o2Uz.source_text, /17\.2%\s*kislorod/i);

  // Filter add, update, remove, and skipClarification pure API
  const withWidth = addFilter(uz, { field: 'sample_width', value: '1.2', unit: 'cm', source_text: '1.2 cm width' });
  assert.equal(withWidth.filters.some(f => f.field === 'sample_width' && f.si_value === 0.012), true);

  const updatedO2 = updateFilter(withWidth, 'o2_concentration', { value: '20.8', unit: 'vol%', source_text: '20.8% O2' });
  assert.equal(updatedO2.filters.find(f => f.field === 'o2_concentration').si_value, 0.208);
  assert.equal(updatedO2.filters.find(f => f.field === 'o2_concentration').origin, 'user_modified');

  const removedWidth = removeFilter(updatedO2, 'sample_width');
  assert.equal(removedWidth.filters.some(f => f.field === 'sample_width'), false);

  const skipped = skipClarification(removedWidth, true);
  assert.equal(skipped.clarification.skipped, true);
  assert.equal(skipped.clarification.threshold_pct, ALIGNMENT_THRESHOLD_PCT);
  assert.equal(skipped.clarification.threshold_metric, SCORE_TERMINOLOGY);

  // Unparsed / unknown terms are never lost
  const withUnparsed = parseQuery('SIBAL mato 17.2% O2 va 120 dB akustik lazer');
  assert.ok(withUnparsed.unparsed_requirements.length >= 1);
  assert.ok(withUnparsed.filters.some(f => f.status === 'UNKNOWN' && f.field === 'unparsed'));

  const { database } = buildSeededStore();
  const t20 = database.trials.find(t => t.trial_id === 'GMT190-T20').revisions[0].record;
  const checklist = evaluateChecklist(withUnparsed, t20, studyAdapter);
  assert.ok(checklist.counts.matched > 0);
  assert.ok(checklist.counts.unknown > 0);
});

test('Z02.2 Tier-first ranking: solid fabric query never lets gas-burner proxy outrank direct solid evidence, and 85% burner_flow O2 is not chamber_atmosphere', () => {
  const cfiGRow = {
    study_id: 'PSI-159',
    trial_id: 'CFIG-BURNER-85',
    material: 'METHANE_GAS',
    sample_width_cm: '',
    sample_width_status: 'NOT_APPLICABLE',
    flow_raw: '11 to 3',
    oxygen_vol_pct: '85',
    oxygen_location: 'burner_flow',
    sample_history: 'NOT_APPLICABLE',
    outcome: 'Inverted spherical gas flame',
    source_url: 'https://psi.nasa.gov/investigations/PSI-159',
    document_id: 'PSI-159',
    pdf_page: '1',
    printed_page: '1',
    table: '1',
    row_id: 'CFIG-BURNER-85',
    source_excerpt: 'CFIG-BURNER-85 | 85% O2 in burner_flow',
    excerpt_kind: 'TABLE_TRANSCRIPTION',
  };

  const { database } = buildSeededStore([cfiGRow]);

  // 1) Solid fabric query in 0g with 17.2% chamber O2
  const rankedSolid = rankTrials(
    database,
    'SIBAL solid fabric in 0g with 17.2% oxygen in chamber atmosphere and 11 to 3 cm/s flow',
    { metadataAdapter: studyAdapter }
  );

  const first = rankedSolid.results[0];
  const second = rankedSolid.results[1];
  const last = rankedSolid.results[rankedSolid.results.length - 1];

  assert.equal(first.trial_id, 'GMT190-T20');
  assert.equal(first.tier, 1);
  assert.equal(second.trial_id, 'GMT190-T21');
  assert.equal(second.tier, 2);
  assert.equal(last.trial_id, 'CFIG-BURNER-85');
  assert.equal(last.tier, 3);
  assert.equal(first.score_terminology, 'alignment_score');

  // Even if weights heavily favor unit_family/atmosphere where burner might score points, Tier 1/2 always beat Tier 3
  const skewedRank = rankTrials(
    database,
    'solid fabric in 0g',
    { metadataAdapter: studyAdapter, weights: { domain: 0.01, fuel: 0.01, atmosphere: 0.49, unit_family: 0.49 } }
  );
  const cfiIndex = skewedRank.results.findIndex(r => r.trial_id === 'CFIG-BURNER-85');
  const solidIndices = skewedRank.results
    .map((r, idx) => (r.study_id === 'PSI-25' ? idx : -1))
    .filter(idx => idx !== -1);
  for (const idx of solidIndices) {
    assert.ok(idx < cfiIndex, 'Direct solid fabric trial must always rank above gas-burner proxy');
  }

  // 2) Querying 85% O2 in chamber_atmosphere MUST NOT treat 85% O2 in burner_flow as an oxygen match
  const chamber85 = rankTrials(
    database,
    '85% oxygen in chamber atmosphere',
    { metadataAdapter: studyAdapter }
  );
  const cfiResult = chamber85.results.find(r => r.trial_id === 'CFIG-BURNER-85');
  assert.equal(cfiResult.components.atmosphere.score, 0);
  assert.match(cfiResult.components.atmosphere.detail, /OXYGEN_LOCATION_MISMATCH/);
  const o2Check = cfiResult.checklist.items.find(i => i.field === 'o2_concentration');
  assert.notEqual(o2Check.status, 'matched');
});

test('Z02.3 Unknown metadata is never counted as a match; contract extension works without silent guessing', () => {
  const { database } = buildSeededStore();
  const t20 = database.trials.find(t => t.trial_id === 'GMT190-T20').revisions[0].record;

  // Without metadataAdapter, Z01 record does not have `environment` or `domain` or `fuel_type` in raw_input
  const rawMeta = resolveMetadata(t20);
  assert.equal(rawMeta.environment.status, 'NOT_PROVIDED');
  assert.equal(rawMeta.environment.value, null);
  assert.equal(rawMeta.domain.status, 'NOT_PROVIDED');
  assert.equal(rawMeta.fuel_type.status, 'NOT_PROVIDED');
  // Material and measured parameter unit families ARE present in Z01
  assert.equal(rawMeta.material.status, 'MEASURED');
  assert.equal(rawMeta.material.value, 'SIBAL');

  // Querying for 0g without metadataAdapter means `environment` is unknown on T20 -> cannot be Tier 1 or matched
  const rankedNoAdapter = rankTrials(database, 'SIBAL in 0g with 17.2% O2 in chamber atmosphere');
  const t20NoAdapter = rankedNoAdapter.results.find(r => r.trial_id === 'GMT190-T20');
  const envItem = t20NoAdapter.checklist.items.find(i => i.field === 'environment');
  assert.equal(envItem.status, 'unknown');
  assert.equal(t20NoAdapter.components.domain.score, 0);
  assert.equal(t20NoAdapter.tier, 2); // Cannot enter Tier 1 when queried environment is unknown
});

test('Z02.4 Sensitivity analysis: +-10% relative weight perturbation detects both stable and order-changing cases', () => {
  // Stable case: T20 strictly dominates T21 and T25 on 17.2% O2 + 11->3 cm/s query
  const { database } = buildSeededStore();
  const stableRanked = rankTrials(
    database,
    'SIBAL in 0g with 17.2% O2 in chamber atmosphere and 11 to 3 cm/s flow',
    { metadataAdapter: studyAdapter }
  );
  assert.equal(stableRanked.sensitivity.warning, false);
  assert.equal(stableRanked.sensitivity.status, 'SENSITIVITY_STABLE');
  assert.equal(stableRanked.sensitivity.runs.length, 8);

  // Order-changing (sensitive) case within the same tier (Tier 2):
  // Candidate A has exact fuel match (1.0) but partial atmosphere match (0.62) -> sum = 1.62
  // Candidate B has partial fuel match (0.65) but exact atmosphere match (1.0) -> sum = 1.65
  // Under baseline 25/25/25/25 weights, B slightly leads A, or when fuel vs atmosphere trade off closely:
  // Let's construct two Tier 2 records whose scores are close enough that a +-10% weight shift flips their order!
  const baseRow = JSON.parse(seedText).rows[0];
  const rowA = reviewRecord(extractRow({
    ...baseRow,
    trial_id: 'SENS-A',
    material: 'SIBAL',
    oxygen_vol_pct: '20.8', // 3.6% away from 17.2% -> proximity = 1 - 0.036/0.10 = 0.64
    flow_raw: '11 to 3',    // exact flow match = 1.0 -> avg atmosphere = (0.64 + 1.0)/2 = 0.82
    domain: 'PREVENTION_SOLID',
    fuel_type: 'SOLID_FABRIC', // exact material + fuel = 1.0
    environment: 'FLIGHT_0G',
  }));
  const rowB = reviewRecord(extractRow({
    ...baseRow,
    trial_id: 'SENS-B',
    material: 'SIBAL',
    oxygen_vol_pct: '17.2', // exact O2 = 1.0
    flow_raw: '11 to 47',   // different flow direction = 0.2 -> avg atmosphere = 0.60
    domain: 'PREVENTION_SOLID',
    fuel_type: '',          // fuel_type omitted -> fuel score = 0.85
    environment: 'FLIGHT_0G',
  }));
  // Wait: let's check scores of rowA and rowB or adjust O2 so their baseline scores are within 1%:
  // For rowB: fuel = 0.85; if oxygen_vol_pct = '17.4' (exact = 1.0) and flow_raw = '8 to 3' (same direction = 0.5) -> avg atmosphere (with env=1.0) = (1.0 + 0.5 + 1.0)/3 = 0.833333. Fuel + Atmos = 0.85 + 0.833333 = 1.683333.
  // For rowA: fuel = 1.0; if oxygen_vol_pct = '21.7' (diff = 0.045 -> proximity = 0.55) and flow_raw = '11 to 3' (exact = 1.0) and env = 1.0 -> avg atmosphere = (0.55 + 1.0 + 1.0)/3 = 0.85. Wait: if flow_raw = '8 to 3' (0.5) and O2 = '17.2' (1.0) -> avg = 0.833333.
  // Let's make rowA have fuel = 1.0, atmosphere = 0.80, and rowB have fuel = 0.805, atmosphere = 1.0!
  const candA = reviewRecord(extractRow({
    ...baseRow,
    trial_id: 'CAND-A',
    material: 'SIBAL',
    oxygen_vol_pct: '21.2', // diff from 17.2% is 0.04 -> proximity = 0.60; with env=1.0 -> atmosphere = (0.60 + 1.0)/2 = 0.80
    domain: 'PREVENTION_SOLID',
    fuel_type: 'SOLID_FABRIC', // fuel = 1.0
    environment: 'FLIGHT_0G',
  }));
  const candB = reviewRecord(extractRow({
    ...baseRow,
    trial_id: 'CAND-B',
    material: 'SIBAL',
    oxygen_vol_pct: '17.2', // exact match = 1.0; with env=1.0 -> atmosphere = 1.0
    sample_width_cm: '2.5', // different width so both are in Tier 2 when querying 1.2 cm width
    domain: 'PREVENTION_SOLID',
    fuel_type: '',          // fuel = 0.85
    environment: 'FLIGHT_0G',
  }));
  // With candA (fuel=1.0, atmos=0.82) vs candB (fuel=0.85, atmos=0.96):
  // Let's set oxygen_vol_pct on candA to '20.4' -> diff from 17.2 is 0.032 -> proximity = 0.68 -> atmos with env(1.0) = (0.68 + 1.0)/2 = 0.84.
  // Then candA has fuel=1.0, atmos=0.84 (sum = 1.84).
  // candB has fuel=0.85, atmos=1.00 (sum = 1.85).
  // At equal weights (0.25 each): candB (1.85 * 0.25) > candA (1.84 * 0.25).
  // When fuel weight increases by +10% (to 0.275) or atmosphere weight decreases by -10% (to 0.225):
  // 0.275 * 1.0 + 0.25 * 0.84 = 0.485 vs 0.275 * 0.85 + 0.25 * 1.0 = 0.48375 -> candA > candB! Order flips!
  const candAExact = reviewRecord(extractRow({
    ...baseRow,
    trial_id: 'CAND-A',
    material: 'SIBAL',
    sample_width_cm: '2.5',
    oxygen_vol_pct: '20.4',
    domain: 'PREVENTION_SOLID',
    fuel_type: 'SOLID_FABRIC',
    environment: 'FLIGHT_0G',
  }));

  const sensitiveRanked = rankTrials(
    [candAExact, candB],
    'SIBAL solid fabric in 0g with 17.2% O2 in chamber atmosphere and 1.2 cm sample width'
  );

  assert.equal(sensitiveRanked.results[0].tier, 2);
  assert.equal(sensitiveRanked.results[1].tier, 2);
  assert.equal(sensitiveRanked.sensitivity.warning, true);
  assert.equal(sensitiveRanked.sensitivity.status, 'SENSITIVITY_ORDER_CHANGED');
  assert.ok(sensitiveRanked.sensitivity.flips.length >= 1);
  assert.deepEqual(sensitiveRanked.sensitivity.affected_tiers, [2]);
  assert.equal(sensitiveRanked.results.every(r => r.sensitivity_warning === true), true);
});

test('Z02.5 Library filter: each study appears once, Study -> trial selector isolates identical trial_id across studies, and 1-3 selection limit is enforced', () => {
  // Add a second study with the exact same trial_id 'GMT190-T20'
  const baseRow = JSON.parse(seedText).rows[0];
  const otherStudyRow = {
    ...baseRow,
    study_id: 'PSI-98',
    study: 'SAFFIRE-I',
    trial_id: 'GMT190-T20',
    outcome: 'Large panel steady spread',
  };

  const { database } = buildSeededStore([otherStudyRow]);

  // 1) Each study appears once even when PSI-25 has multiple trials and multiple unit families
  const studies = selectLibraryStudies(database, {}, { metadataAdapter: studyAdapter });
  const studyIds = studies.map(s => s.study_id);
  assert.deepEqual(studyIds, ['PSI-25', 'PSI-98']);
  assert.equal(new Set(studyIds).size, studies.length);

  const psi25 = studies.find(s => s.study_id === 'PSI-25');
  assert.equal(psi25.total_trial_count, 3);
  assert.deepEqual(psi25.unit_families, ['FAMILY_A_FLAME_METRICS', 'FAMILY_B_ATMOS_THERMO']);

  // Filtering by FAMILY_A_FLAME_METRICS still returns PSI-25 once
  const filteredByFamily = selectLibraryStudies(database, { unit_family: 'FAMILY_A_FLAME_METRICS' }, { metadataAdapter: studyAdapter });
  assert.equal(filteredByFamily.filter(s => s.study_id === 'PSI-25').length, 1);

  // 2) Study -> trial selector never mixes identical trial_id from different studies
  const psi25Trials = selectStudyTrials(database, 'PSI-25');
  const psi98Trials = selectStudyTrials(database, 'PSI-98');
  assert.equal(psi25Trials.length, 3);
  assert.equal(psi98Trials.length, 1);
  assert.equal(psi25Trials.find(t => t.trial_id === 'GMT190-T20').outcome, 'Quenched');
  assert.equal(psi98Trials.find(t => t.trial_id === 'GMT190-T20').outcome, 'Large panel steady spread');
  assert.notEqual(
    psi25Trials.find(t => t.trial_id === 'GMT190-T20').key,
    psi98Trials.find(t => t.trial_id === 'GMT190-T20').key
  );

  // 3) 1-3 trial selection validation and bare trial_id rejection
  assert.equal(validateTrialSelection(database, []).error.code, 'SELECTION_EMPTY');
  assert.equal(validateTrialSelection(database, ['GMT190-T20']).error.code, 'COMPOSITE_STUDY_TRIAL_ID_REQUIRED');

  const validTwo = validateTrialSelection(database, [
    { study_id: 'PSI-25', trial_id: 'GMT190-T20' },
    { study_id: 'PSI-98', trial_id: 'GMT190-T20' },
  ]);
  assert.equal(validTwo.ok, true);
  assert.equal(validTwo.count, 2);
  assert.equal(validTwo.trials[0].record.outcome.raw_display, 'Quenched');
  assert.equal(validTwo.trials[1].record.outcome.raw_display, 'Large panel steady spread');

  const tooMany = validateTrialSelection(database, [
    { study_id: 'PSI-25', trial_id: 'GMT190-T20' },
    { study_id: 'PSI-25', trial_id: 'GMT190-T21' },
    { study_id: 'PSI-25', trial_id: 'GMT216-T25' },
    { study_id: 'PSI-98', trial_id: 'GMT190-T20' },
  ]);
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.error.code, 'SELECTION_LIMIT_EXCEEDED');

  // Interactive selection reducer
  let sel = [];
  sel = updateTrialSelection(sel, { study_id: 'PSI-25', trial_id: 'GMT190-T20' }).selected;
  sel = updateTrialSelection(sel, { study_id: 'PSI-25', trial_id: 'GMT190-T21' }).selected;
  sel = updateTrialSelection(sel, { study_id: 'PSI-25', trial_id: 'GMT216-T25' }).selected;
  assert.equal(sel.length, 3);
  const fourthAttempt = updateTrialSelection(sel, { study_id: 'PSI-98', trial_id: 'GMT190-T20' });
  assert.equal(fourthAttempt.ok, false);
  assert.equal(fourthAttempt.error.code, 'SELECTION_LIMIT_EXCEEDED');
});

test('Z02.6 Four evidence-gap statuses, Moon/Mars non-interpolation, and corpus scope disclaimer', () => {
  const { database } = buildSeededStore();

  // Status 1: Direct matching evidence (when metadata is known and conditions match)
  const direct = detectEvidenceGap(
    database,
    'SIBAL in 0g with 17.2% O2 in chamber atmosphere and 11 to 3 cm/s flow',
    { metadataAdapter: studyAdapter }
  );
  assert.equal(direct.status, EVIDENCE_GAP_STATUSES.DIRECT_MATCH);
  assert.equal(direct.matching_trials.length, 1);
  assert.equal(direct.matching_trials[0].trial_id, 'GMT190-T20');
  assert.equal(direct.interpolated_values, null);

  // Status 2: Related evidence with different conditions (e.g. Moon 0.16g / Mars 0.38g or 34% O2 for SIBAL)
  const lunarGap = detectEvidenceGap(
    database,
    'SIBAL solid fabric on the Moon 0.16g with 34% O2 in chamber atmosphere',
    { metadataAdapter: studyAdapter }
  );
  assert.equal(lunarGap.status, EVIDENCE_GAP_STATUSES.RELATED_DIFFERENT_CONDITIONS);
  assert.equal(lunarGap.interpolation_blocked, true);
  assert.equal(lunarGap.interpolated_values, null);
  assert.equal(lunarGap.safety_verdict, null);
  assert.ok(lunarGap.related_trials.length >= 1);

  // Attempting to request partial-g interpolation is explicitly blocked
  const blockedInterp = detectEvidenceGap(
    database,
    'SIBAL on Mars 0.38g',
    { metadataAdapter: studyAdapter, interpolatePartialG: true }
  );
  assert.equal(blockedInterp.status, EVIDENCE_GAP_STATUSES.INSUFFICIENT_METADATA);
  assert.equal(blockedInterp.reason, 'PARTIAL_G_INTERPOLATION_PROHIBITED');

  // Status 3: No matching evidence in connected corpus (and never claims "does not exist in science")
  const noMatch = detectEvidenceGap(
    database,
    'Kevlar droplet suppression in 1g',
    { metadataAdapter: studyAdapter }
  );
  assert.equal(noMatch.status, EVIDENCE_GAP_STATUSES.NO_MATCH_IN_CONNECTED_CORPUS);
  assert.match(noMatch.corpus_scope_note, /connected local corpus/i);
  assert.match(noMatch.corpus_scope_note, /does NOT mean evidence does not exist in broader scientific literature/i);

  // Status 4: Insufficient metadata (e.g. querying 0g when environment metadata is not provided on the records)
  const insufficient = detectEvidenceGap(
    database,
    'SIBAL in 0g with 17.2% O2 in chamber atmosphere'
    // No studyAdapter passed -> environment is NOT_PROVIDED on PSI-25 seed rows!
  );
  assert.equal(insufficient.status, EVIDENCE_GAP_STATUSES.INSUFFICIENT_METADATA);
});

test('Z02.7 Conclusion guard and side-by-side comparison guardrails', () => {
  const { database } = buildSeededStore();

  // 1) Valid provenance-linked conclusion is approved
  const validGuard = guardConclusion(database, {
    text: 'In GMT190-T20, a 1.2 cm sample width of SIBAL under decreasing 11 to 3 cm/s airflow at 17.2 vol% O2 resulted in Quenched.',
    citations: [
      { study_id: 'PSI-25', trial_id: 'GMT190-T20', field: 'flow_velocity' },
      { study_id: 'PSI-25', trial_id: 'GMT190-T20', field: 'outcome' },
    ],
  });
  assert.equal(validGuard.ok, true);
  assert.equal(validGuard.status, 'APPROVED_WITH_PROVENANCE');
  assert.equal(validGuard.resolved_evidence.length, 2);

  // 2) Conclusion without citations is blocked
  const noCit = guardConclusion(database, {
    text: 'SIBAL quenched at 17.2% O2.',
    citations: [],
  });
  assert.equal(noCit.ok, false);
  assert.equal(noCit.status, 'BLOCKED');
  assert.ok(noCit.violations.some(v => v.code === 'PROVENANCE_CITATION_REQUIRED'));

  // 3) Lunar/Mars extrapolation or safety certification claim or invented number is blocked
  const badExtrap = guardConclusion(database, {
    text: 'Based on GMT190-T20 at 17.2% O2, SIBAL is 100% safe on the Moon at 0.16g with a burn rate of 0.42 mm/s and 1.2 cm thickness.',
    citations: [{ study_id: 'PSI-25', trial_id: 'GMT190-T20', field: 'outcome' }],
    target_conditions: { environment: 'PARTIAL_G_MOON', o2_vol_pct: 34 },
  });
  assert.equal(badExtrap.ok, false);
  const codes = badExtrap.violations.map(v => v.code);
  assert.ok(codes.includes('UNSUPPORTED_SAFETY_OR_VERIFICATION_VERDICT'));
  assert.ok(codes.includes('PARTIAL_G_INTERPOLATION_OR_DIRECT_EXTRAPOLATION_BLOCKED'));
  assert.ok(codes.includes('WIDTH_THICKNESS_CONFLATION'));
  assert.ok(codes.includes('TARGET_OXYGEN_CONDITION_MISMATCH'));
  assert.ok(codes.includes('UNGROUNDED_SCIENTIFIC_NUMBER'));

  // 4) Citing REUSED sample GMT216-T25 without mentioning reuse returns a constraint; claiming it as NEW is blocked
  const reusedConstrained = guardConclusion(database, {
    text: 'In GMT216-T25, 2.2 cm SIBAL at 20.8% O2 and 5 to 2.5 cm/s flow ignited.',
    citations: [{ study_id: 'PSI-25', trial_id: 'GMT216-T25', field: 'outcome' }],
  });
  assert.equal(reusedConstrained.ok, true);
  assert.equal(reusedConstrained.status, 'CONSTRAINED_WITH_LIMITATIONS');
  assert.ok(reusedConstrained.constraints.some(c => c.code === 'REUSED_SAMPLE_LIMITATION_REQUIRED'));

  const reusedAsNew = guardConclusion(database, {
    text: 'In GMT216-T25, a new sample of 2.2 cm SIBAL at 20.8% O2 ignited.',
    citations: [{ study_id: 'PSI-25', trial_id: 'GMT216-T25', field: 'sample_history' }],
  });
  assert.equal(reusedAsNew.ok, false);
  assert.ok(reusedAsNew.violations.some(v => v.code === 'REUSED_SAMPLE_CLAIMED_AS_NEW'));

  // 5) Side-by-side comparison of GMT190-T20 and GMT190-T21 preserves shared width/O2 and contrasting flow/outcomes
  const cmp = compareTrials(database, [
    { study_id: 'PSI-25', trial_id: 'GMT190-T20' },
    { study_id: 'PSI-25', trial_id: 'GMT190-T21' },
  ]);
  assert.ok(cmp.shared_conditions.some(c => c.field === 'sample_width' && c.si_display === '0.012 m'));
  assert.ok(cmp.shared_conditions.some(c => c.field === 'o2_concentration' && c.si_display === '0.172 mol/mol'));
  assert.ok(cmp.contrasting_conditions.some(c => c.field === 'flow_velocity'));
  assert.deepEqual(cmp.outcomes.map(o => o.outcome_raw_display), ['Quenched', 'Blow-off']);
});

test('Z02.8 Source-linked presentation report export (CSV/JSON) preserves all metadata and stays separate from import exchange', () => {
  const { database } = buildSeededStore();

  const reportJsonText = exportReportJSON(database);
  const reportObj = JSON.parse(reportJsonText);
  assert.equal(reportObj.report_schema, REPORT_SCHEMA_VERSION);
  assert.equal(reportObj.importable_exchange, false);
  assert.equal(reportObj.row_count, 3);

  // Presentation report JSON must be rejected by Z01's raw import reader so formats are never conflated
  assert.throws(() => readImport(reportJsonText, 'json'), /JSON_ROWS_ARRAY_REQUIRED/);

  // Meanwhile Z01's exportJSON and exportArchive continue to work unchanged
  const rawExchange = JSON.parse(exportJSON(database));
  assert.equal(rawExchange.schema_version, 'skyforge.atlas/1');
  const archive = JSON.parse(exportArchive(database));
  assert.equal(archive.trials.length, 3);

  // Verify CSV escaping and completeness of required columns
  const reportCsvText = exportReportCSV(database);
  const parsedReportRows = parseCSV(reportCsvText);
  assert.equal(parsedReportRows.length, 3);

  const t20Row = parsedReportRows.find(r => r.trial_id === 'GMT190-T20');
  assert.equal(t20Row.study_id, 'PSI-25');
  assert.equal(t20Row.revision_id, '["PSI-25","GMT190-T20"]:r1');
  assert.equal(t20Row.sample_width_raw_display, '1.2 cm');
  assert.equal(t20Row.sample_width_si_display, '0.012 m');
  assert.equal(t20Row.sample_width_location, 'sample_surface');
  assert.equal(t20Row.flow_velocity_raw_values, '11 -> 3');
  assert.equal(t20Row.flow_velocity_si_values, '0.11 -> 0.03');
  assert.equal(t20Row.flow_velocity_direction, 'decreasing');
  assert.equal(t20Row.flow_velocity_location, 'chamber_atmosphere');
  assert.equal(t20Row.o2_concentration_raw_display, '17.2 vol%');
  assert.equal(t20Row.o2_concentration_si_display, '0.172 mol/mol');
  assert.equal(t20Row.o2_concentration_location, 'chamber_atmosphere');
  assert.equal(t20Row.sample_history_status, 'NOT_PROVIDED');
  assert.equal(t20Row.outcome_display, 'Quenched');
  assert.equal(t20Row.pdf_page, '104');
  assert.equal(t20Row.printed_page, '96');
  assert.equal(t20Row.table, '7.1');

  const t25Row = parsedReportRows.find(r => r.trial_id === 'GMT216-T25');
  assert.equal(t25Row.outcome_display, 'Reused, ignited'); // comma properly escaped & round-tripped
  assert.equal(t25Row.sample_history_value, 'REUSED');
  assert.equal(t25Row.flow_velocity_raw_values, '5 -> 2.5');
  assert.equal(t25Row.flow_velocity_direction, 'decreasing');
});

test('Z02.9 Optional API adapter: defaults to API_UNAVAILABLE, rejects secrets, and requires diff + confirmation before creating a revision', async () => {
  const { store } = buildSeededStore();

  // 1) Default status in repo is API_UNAVAILABLE
  const defaultStatus = getReevaluationApiStatus();
  assert.equal(defaultStatus.available, false);
  assert.equal(defaultStatus.status, API_STATUS_UNAVAILABLE);

  const noAdapterRes = await proposeReevaluation(store, { study_id: 'PSI-25', trial_id: 'GMT216-T25' });
  assert.equal(noAdapterRes.ok, false);
  assert.equal(noAdapterRes.status, API_STATUS_UNAVAILABLE);

  // 2) Rejects adapters that expose secrets/apiKeys
  const secretAdapter = { name: 'unsafe', apiKey: 'sk-secret-123', evaluate: async () => ({}) };
  assert.equal(getReevaluationApiStatus(secretAdapter).status, 'API_SECRET_REJECTED');

  // 3) Provider failure leaves original record untouched
  const failingAdapter = {
    name: 'mock-failing-provider',
    async evaluate() {
      throw new Error('Upstream timeout');
    },
  };
  const beforeBytes = JSON.stringify(store.load().database);
  const failedProp = await proposeReevaluation(store, { study_id: 'PSI-25', trial_id: 'GMT216-T25' }, { adapter: failingAdapter });
  assert.equal(failedProp.ok, false);
  assert.equal(failedProp.error.code, 'API_PROVIDER_FAILED');
  assert.equal(JSON.stringify(store.load().database), beforeBytes);

  // 4) Valid adapter produces diff without mutating store; cancel leaves store untouched; confirm creates r2
  const validAdapter = {
    name: 'mock-verifier',
    async evaluate({ record }) {
      return {
        rationale: 'Added missing document_id and table transcription excerpt from NASA/TM-20210011385 p.104',
        proposed_raw_patch: {
          document_id: 'NASA/TM-20210011385',
          source_excerpt: `${record.trial_id} | 2.2 | 5 to 2.5 | 20.8 | Reused, ignited`,
          excerpt_kind: 'TABLE_TRANSCRIPTION',
        },
      };
    },
  };

  const prop1 = await proposeReevaluation(store, { study_id: 'PSI-25', trial_id: 'GMT216-T25' }, { adapter: validAdapter });
  assert.equal(prop1.ok, true);
  assert.equal(prop1.diffs.length, 3);
  assert.equal(JSON.stringify(store.load().database), beforeBytes); // Still unmutated!

  // Cancel proposal -> cannot be committed afterward, store still untouched
  const cancelled = cancelReevaluation(prop1);
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(commitReevaluation(store, prop1, { confirmed: true, acknowledgeFlags: true }).ok, false);
  assert.equal(JSON.stringify(store.load().database), beforeBytes);

  // Generate fresh proposal and commit with confirmation -> creates revision r2 while preserving r1
  const prop2 = await proposeReevaluation(store, { study_id: 'PSI-25', trial_id: 'GMT216-T25' }, { adapter: validAdapter });
  assert.equal(commitReevaluation(store, prop2, { confirmed: false }).error.code, 'CONFIRMATION_REQUIRED');
  const committed = commitReevaluation(store, prop2, { confirmed: true, acknowledgeFlags: true });
  assert.equal(committed.ok, true);

  const t25Trial = committed.database.trials.find(t => t.trial_id === 'GMT216-T25');
  assert.equal(t25Trial.revisions.length, 2);
  assert.equal(t25Trial.revisions[0].record.sources[0].document_id, 'NOT_PROVIDED');
  assert.equal(t25Trial.revisions[1].record.sources[0].document_id, 'NASA/TM-20210011385');
});
