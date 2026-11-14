# CHANGELOG — SKYFORGE Z02 (`SKYFORGE-Z02-Argon-v1`)

## Base Archive & Commit

- **Repository**: [`https://github.com/tangriyevafotima0-crypto/Hacathon`](https://github.com/tangriyevafotima0-crypto/Hacathon)
- **Supplied Archive**: `Hacathon-main.zip` (`SKYFORGE-Z01-v1.0.0`, corresponding to verified baseline commit [`04df76287b92d5b78423125753052cbdd31570b3`](https://github.com/tangriyevafotima0-crypto/Hacathon/commit/04df76287b92d5b78423125753052cbdd31570b3) and [CI run 43572572407](https://github.com/tangriyevafotima0-crypto/Hacathon/actions/runs/43572572407)).

## Added Files

- `src/atlas/core/metadata.js` — Z02 metadata contract extension (`resolveMetadata`, `createMetadataAdapter`, enum normalizers for `SAFETY_DOMAINS`, `FUEL_TYPES`, `ENVIRONMENTS`, `UNIT_FAMILIES`) with strict provenance tracking (`RECORD_EXPLICIT`, `PARAMETER_DERIVED`, `ADAPTER_SUPPLIED`, `UNKNOWN`) and zero silent guessing.
- `src/atlas/core/query.js` — Bilingual Uzbek/English question parser (`parseQuery`), verbatim `source_text` retention, unparsed requirement preservation (`unparsed_requirements`), pure filter editing API (`addFilter`, `updateFilter`, `removeFilter`, `skipClarification`, `equalQueryFilters`), checklist evaluation (`evaluateChecklist`), and 70% `alignment_score` threshold state.
- `src/atlas/core/ranking.js` — Tier 1–4 classification (`classifyEvidenceTier`, `TIER_DEFINITIONS`), within-tier 25%/25%/25%/25% component scoring (`computeComponentScores`, `scoreWithinTier`), deterministic tie-breaking, and ±10% relative weight perturbation sensitivity analysis (`checkWeightSensitivity`, `rankTrials`).
- `src/atlas/core/library.js` — Parent-study-once library selector (`selectLibraryStudies`), study-scoped trial selector (`selectStudyTrials`), and composite `[study_id, trial_id]` 1–3 trial selection validator/reducer (`validateTrialSelection`, `updateTrialSelection`).
- `src/atlas/core/gap-guard.js` — 4-status Evidence Gap Detector (`detectEvidenceGap`, `EVIDENCE_GAP_STATUSES`), provenance-linked Conclusion Guard (`guardConclusion`), and side-by-side trial comparator (`compareTrials`), enforcing Lunar/Martian non-interpolation and [NASA/TM-20210011385 Table 7.1](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=104) physical guardrails.
- `src/atlas/core/export.js` — Source-linked presentation/report export (`buildReportRows`, `exportReportJSON`, `exportReportCSV`) with RFC 4180 CSV escaping and explicit `report_schema: "skyforge.atlas.report/1"` separation from Z01 raw import exchange.
- `src/atlas/core/reeval-api.js` — Optional API re-evaluation module (`getReevaluationApiStatus`, `proposeReevaluation`, `cancelReevaluation`, `commitReevaluation`), reporting `API_UNAVAILABLE` by default when no live provider adapter is configured, rejecting exposed secrets, and requiring explicit diff confirmation before creating a new revision.
- `tests/atlas/z02.test.js` — 9 comprehensive integration test suites covering all Z02 requirements while keeping all 23 existing Z01/model tests intact (total: 32/32 passing tests).
- `scripts/z02-demo.mjs` — Reproducible CLI demonstration of Z02 query equivalence, ranking, library filtering, gap detection, conclusion guarding, API status, and report export.
- `docs/z02/CONTRACT.md` — Formal Z02 technical contract and metadata extension specification.
- `docs/z02/demo-output/report.json` & `docs/z02/demo-output/report.csv` — Generated presentation report outputs from `npm run demo:z02`.
- `docs/z02/npm-test.log`, `docs/z02/demo.log`, `docs/z02/npm-ci.log`, `docs/z02/npm-build.log` — Observed command outputs and exit codes from the execution environment.
- `CHANGELOG-Z02.md` & `Z02-HANDOFF.md` — Package changelog and integration handoff documentation.

## Modified Files

- `src/atlas/core/selectors.js` — Re-exported `selectLibraryStudies`, `selectStudyTrials`, `validateTrialSelection`, and `updateTrialSelection` alongside Z01's `getRevision` and `fieldEvidence`.
- `src/atlas/core/index.js` — Exported all Z02 public functions and constants alongside existing Z01 exports.
- `src/atlas/core/types.d.ts` — Added Z02 TypeScript interfaces (`QueryFilter`, `ParsedQuery`, `ChecklistItem`, `ChecklistEvaluation`, `RankingWeights`, `RankedTrialResult`, `SensitivityReport`, `EvidenceGapStatus`, etc.).
- `src/atlas/core/index.d.ts` — Added TypeScript declarations for all Z02 public API exports.
- `package.json` — Added `"demo:z02": "node scripts/z02-demo.mjs"` to `"scripts"`. No dependencies, devDependencies, or lockfile entries were changed (`test` already glob-matches `tests/atlas/*.test.js`).

## Deleted Files

- **None** (0 files deleted; all Z01, UI, model, and documentation files are preserved intact).
