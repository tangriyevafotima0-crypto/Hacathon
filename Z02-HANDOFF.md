# Z02 Integration Handoff (`SKYFORGE-Z02-Argon-v1`)

- **Task**: Z02 Core Implementation (Query Parser, Tier-First Ranking + Sensitivity, Library Filter, Evidence-Gap & Conclusion Guard, Presentation Export, Optional API Adapter)
- **Repository**: [`https://github.com/tangriyevafotima0-crypto/Hacathon`](https://github.com/tangriyevafotima0-crypto/Hacathon)
- **Base Archive / Commit**: `Hacathon-main.zip` (`SKYFORGE-Z01-v1.0.0`, commit [`04df76287b92d5b78423125753052cbdd31570b3`](https://github.com/tangriyevafotima0-crypto/Hacathon/commit/04df76287b92d5b78423125753052cbdd31570b3), previously verified in [CI run 43572572407](https://github.com/tangriyevafotima0-crypto/Hacathon/actions/runs/43572572407)).
- **Approval Status**: Independent Analyzer and PM approvals are **PENDING** (not claimed by this package).

## 1. Public API Summary (`src/atlas/core/index.js`)

| Module | Exported Functions & Constants | Purpose |
| --- | --- | --- |
| `metadata.js` | `SAFETY_DOMAINS`, `FUEL_TYPES`, `ENVIRONMENTS`, `UNIT_FAMILIES`, `createMetadataAdapter`, `resolveMetadata` | Resolves explicit record fields, parameter-derived unit families, and optional D/Bk `MetadataAdapter` without guessing missing metadata. |
| `query.js` | `ALIGNMENT_THRESHOLD_PCT` (`70`), `SCORE_TERMINOLOGY` (`'alignment_score'`), `parseQuery`, `addFilter`, `updateFilter`, `removeFilter`, `skipClarification`, `equalQueryFilters`, `evaluateChecklist` | Parses UZ/EN questions into canonical editable filters, preserves `source_text` and `unparsed_requirements`, and produces `matched`/`partial`/`unknown` checklists. |
| `ranking.js` | `DEFAULT_WEIGHTS`, `TIER_DEFINITIONS`, `normalizeWeights`, `classifyEvidenceTier`, `computeComponentScores`, `scoreWithinTier`, `checkWeightSensitivity`, `rankTrials` | Enforces Tier 1–4 priority before 25/25/25/25 component scoring, prevents `burner_flow` O₂ from matching `chamber_atmosphere`, and runs ±10% relative weight perturbation checks. |
| `library.js` | `MIN_SELECTED_TRIALS` (`1`), `MAX_SELECTED_TRIALS` (`3`), `selectLibraryStudies`, `selectStudyTrials`, `validateTrialSelection`, `updateTrialSelection` | Deduplicates parent studies (`study_id` shown once), isolates `Study → trial` drilldown by composite `[study_id, trial_id]`, and enforces the 1–3 trial selection limit. |
| `gap-guard.js` | `EVIDENCE_GAP_STATUSES`, `ALL_EVIDENCE_GAP_STATUSES`, `detectEvidenceGap`, `guardConclusion`, `compareTrials` | Returns the 4 exact evidence-gap statuses, blocks Lunar/Martian interpolation, compares 2–3 selected trials, and guards conclusions with trial/revision/field/source provenance. |
| `export.js` | `REPORT_SCHEMA_VERSION`, `REPORT_EXPORT_MODE`, `buildReportRows`, `exportReportJSON`, `exportReportCSV` | Exports presentation/report CSV and JSON with full raw/SI values, ordered flow, direction, location, missing state, sample history, outcome, and source locators, separate from Z01 import exchange. |
| `reeval-api.js` | `API_STATUS_UNAVAILABLE`, `API_STATUS_READY`, `getReevaluationApiStatus`, `proposeReevaluation`, `cancelReevaluation`, `commitReevaluation` | Defaults to `API_UNAVAILABLE` (no live provider in repo), rejects exposed secrets, generates non-mutating diffs, and commits a new revision only after user confirmation. |

## 2. Bk UI Integration Example

```js
import {
  openAtlasStore,
  createMetadataAdapter,
  parseQuery,
  addFilter,
  removeFilter,
  skipClarification,
  rankTrials,
  selectLibraryStudies,
  selectStudyTrials,
  updateTrialSelection,
  validateTrialSelection,
  detectEvidenceGap,
  compareTrials,
  guardConclusion,
  exportReportCSV,
  exportReportJSON,
  getReevaluationApiStatus,
} from './src/atlas/core/index.js';

// 1. Load persisted store
const store = openAtlasStore(window.localStorage);
const loaded = store.load();
if (!loaded.ok) {
  // Render loaded.error without resetting storage
}
const db = loaded.database;

// 2. Attach D's study metadata declaration (or pass rows with domain/fuel_type/environment columns)
const metadataAdapter = createMetadataAdapter({
  studies: {
    'PSI-25': {
      domain: 'PREVENTION_SOLID',
      fuel_type: 'SOLID_FABRIC',
      environment: 'FLIGHT_0G',
      unit_families: ['FAMILY_A_FLAME_METRICS', 'FAMILY_B_ATMOS_THERMO'],
    },
  },
});

// 3. Natural-language UZ/EN search + editable filter chips
let queryState = parseQuery('Mikrogravitatsiyada SIBAL qattiq mato kamera atmosferasida 17.2% kislorod');
queryState = addFilter(queryState, { field: 'sample_width', value: '1.2', unit: 'cm', source_text: '1.2 cm' });
// If user clicks "Skip clarification / O'tkazib yuborish":
queryState = skipClarification(queryState, true);

const ranked = rankTrials(db, queryState, { metadataAdapter });
// Render ranked.results[*].tier, alignment_score_pct (labeled "alignment_score"), checklist.items, and ranked.sensitivity.warning

// 4. Library parent -> child flow & 1-3 trial selection
const studies = selectLibraryStudies(db, { domain: 'PREVENTION_SOLID' }, { metadataAdapter });
const psi25Trials = selectStudyTrials(db, 'PSI-25', { metadataAdapter });

let selection = [];
selection = updateTrialSelection(selection, { study_id: 'PSI-25', trial_id: 'GMT190-T20' }).selected;
selection = updateTrialSelection(selection, { study_id: 'PSI-25', trial_id: 'GMT190-T21' }).selected;
const validatedSelection = validateTrialSelection(db, selection);

// 5. Side-by-side comparison, Moon/Mars gap detection & conclusion guard
const comparison = compareTrials(db, validatedSelection.selected, { metadataAdapter });
const lunarGap = detectEvidenceGap(db, 'SIBAL on the Moon 0.16g with 34% O2', { metadataAdapter });
const guardResult = guardConclusion(db, {
  text: 'In GMT190-T20, 1.2 cm sample width SIBAL at 17.2% O2 under 11 to 3 cm/s flow resulted in Quenched.',
  citations: [{ study_id: 'PSI-25', trial_id: 'GMT190-T20', field: 'outcome' }],
});

// 6. Source-linked report export & optional API status
const reportCsv = exportReportCSV(db, { selection: validatedSelection.selected });
const reportJson = exportReportJSON(db, { selection: validatedSelection.selected });
const apiStatus = getReevaluationApiStatus(); // { available: false, status: 'API_UNAVAILABLE', ... }
```

## 3. Observed Test & Command Results

All commands were executed inside the isolated Linux VM (`Node v18.20.4`, `npm 9.2.0`, outbound internet disabled). Separate historical CI results from Z01 ([CI run 43572572407](https://github.com/tangriyevafotima0-crypto/Hacathon/actions/runs/43572572407)) are not claimed as runs of this new Z02 code.

| Command | Exit Code | Actual Result & Evidence Log |
| --- | --- | --- |
| `npm test` | `0` | **PASS (32/32)**: 3 original model tests + 20 Z01 import/store tests + 9 Z02 test suites (`docs/z02/npm-test.log`) |
| `npm run demo:z01` | `0` | **PASS**: Z01 seed/T25 import, reload, idempotency, and exchange verified (`docs/z01/demo.log`) |
| `npm run demo:z02` | `0` | **PASS**: UZ/EN equivalence, Tier 1–2 ranking, library selector, Lunar gap detector, conclusion guard, `API_UNAVAILABLE` status, and report CSV/JSON generation (`docs/z02/demo.log`) |
| `npm ci` | `1` | **FAIL (offline sandbox)**: `EAI_AGAIN registry.npmjs.org` (`EBADENGINE` warnings on Node v18.20.4 for packages targeting Node >=20/22) (`docs/z02/npm-ci.log`) |
| `npm run build` | `127` | **FAIL (`vite: not found`)**: `node_modules` could not be installed offline (`docs/z02/npm-build.log`) |

## 4. Limitations & Cross-Role Dependencies (D / Bk / H / Analyzer)

- **D (`src/atlas/data`)**: `src/atlas/data` is not yet populated in the base repository; only Z01's `src/atlas/core/fixtures/bass-ii-seed.json` ([NASA/TM-20210011385 Table 7.1, PDF p. 104](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=104)) and `GMT216-T25.csv` are present. `detectEvidenceGap` and `guardConclusion` explicitly record `PENDING_AUTHORITATIVE_D_PACKAGE` in `dependencies` and return conservative statuses (`Insufficient metadata` when study environment/domain metadata is absent). When D delivers `src/atlas/data`, supply either row columns (`domain`, `fuel_type`, `environment`, `unit_family`) or a `createMetadataAdapter(...)` declaration.
- **Bk (`src/atlas/ui`)**: Connect `parseQuery`, filter editing functions, `rankTrials`, `selectLibraryStudies`, `selectStudyTrials`, `validateTrialSelection`, `detectEvidenceGap`, `compareTrials`, `guardConclusion`, `exportReportCSV`/`exportReportJSON`, and `getReevaluationApiStatus`. Display `alignment_score` with its non-safety disclaimer, show `sensitivity.warning` badges when `true`, and keep the `API_UNAVAILABLE` state visible unless a real server-backed adapter is injected.
- **H & Analyzer**: On an internet-enabled Node 22.12+ machine (or GitHub Actions after Codex pushes), run `npm ci`, `npm test`, and `npm run build` to verify the full Vite bundle alongside all 32 tests.

## 5. Files Deleted

- **None** (no files are to be deleted when integrating this package into the repository).
## Repository Integration Verification

On 2026-11-14, the Argon core, types, and tests already in `main` were verified against the ZIP. The remaining Z02 materials add `demo:z02`, its script and reports, the contract, and the original handoff and evidence logs. `MANIFEST-Z02.sha256` records the original Argon hashes, including the handoff before this section was added. `MANIFEST.sha256` records the earlier Z01 snapshot.

| Command | Windows result (Node 24.21.0, npm 11.19.0) |
| --- | --- |
| `npm ci` | Exit 0. npm warned that the esbuild postinstall script was outside its allow list. |
| `npm test` | Exit 0. All 32 tests passed. |
| `npm run build` | Exit 0. Vite 7.3.7 produced the production bundle. |
| `npm run demo:z01` | Exit 0. Import, reload, and repeated import passed. |
| `npm run demo:z02` | Exit 0. Both generated report files matched the Argon ZIP byte for byte. |

[GitHub Actions run 43577442863](https://github.com/tangriyevafotima0-crypto/Hacathon/actions/runs/43577442863) passed on `df26867`, which contains the Z02 core and tests. The D01/D02 archive is present at repository root. Integration of its data into the Atlas and Bk's UI wiring are pending, as are H acceptance and independent Analyzer/PM review.
