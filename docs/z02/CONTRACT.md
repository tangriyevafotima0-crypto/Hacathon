# Z02 Data, Search, Ranking, Guard & Report Contract v1

- **Artifact**: `SKYFORGE-Z02-Argon-v1.zip`
- **Owner**: Z (Z02 Core Module Implementation — Argon v1)
- **Repository Baseline**: [`tangriyevafotima0-crypto/Hacathon`](https://github.com/tangriyevafotima0-crypto/Hacathon) at commit [`04df76287b92d5b78423125753052cbdd31570b3`](https://github.com/tangriyevafotima0-crypto/Hacathon/commit/04df76287b92d5b78423125753052cbdd31570b3) (supplied archive `Hacathon-main.zip`, artifact `SKYFORGE-Z01-v1.0.0`, previously verified in [CI run 43572572407](https://github.com/tangriyevafotima0-crypto/Hacathon/actions/runs/43572572407)).
- **Public Entrypoint**: `src/atlas/core/index.js` (`src/atlas/core/index.d.ts`, `src/atlas/core/types.d.ts`).

## 1. Ownership & Non-Regression Boundary

Z02 extends `src/atlas/core` without modifying:
- Z01 core modules (`src/atlas/core/contract.js`, `src/atlas/core/csv.js`, `src/atlas/core/import.js`, `src/atlas/core/store.js`, `src/atlas/core/import.schema.json`, `src/atlas/core/fixtures/*`, `tests/atlas/import.test.js`);
- Prototype and UI files (`src/App.jsx`, `src/main.jsx`, `src/styles.css`, `src/model.js`, `src/model.test.js`);
- Dependencies or `package-lock.json`.

The illustrative risk formula in `src/model.js` is never imported or referenced by `src/atlas/core`.

## 2. Metadata Contract Extension (`src/atlas/core/metadata.js`)

Z01 `TrialRecord` objects store normalized physical parameters (`sample_width`, `flow_velocity`, `o2_concentration`), `material`, `claim_type`, `sample_history`, `outcome`, and `raw_input`. Higher-level study classifications required for Tier 1–4 ranking and library filtering (`domain`, `fuel_type`, `environment`, additional `unit_families`, `is_proxy`) are not hardcoded or guessed when absent from Z01 rows. Instead, `resolveMetadata(record, adapter?)` resolves them deterministically in strict priority order:

1. **Record-explicit fields (`RECORD_EXPLICIT`)**: `record.material` and optional columns present in `record.raw_input` (`domain` / `safety_domain`, `fuel_type` / `material_class`, `environment` / `environment_type` / `gravity`, `unit_family` / `unit_family_id`, `is_proxy`). Because Z01 retains extra columns in `raw_input` and `unparsed_columns`, D can include these columns directly in `src/atlas/data` rows without changing the Z01 store schema.
2. **Parameter-derived physical invariants (`PARAMETER_DERIVED`)**:
   - Measured `sample_width` (`m`) contributes `FAMILY_A_FLAME_METRICS`.
   - Measured `flow_velocity` (`m/s`) or `o2_concentration` (`mol/mol`) contributes `FAMILY_B_ATMOS_THERMO`.
   - `claim_type === 'MODEL_RESULT'` or `location === 'simulation_domain'` derives `GROUND_CFD`.
3. **Explicitly injected `MetadataAdapter` (`ADAPTER_SUPPLIED`)**: Created via `createMetadataAdapter({ studies, trials, materials })`, allowing D or Bk to attach authoritative study/trial metadata without mutating stored Z01 records.
4. **Unknown state (`UNKNOWN` / `status: 'NOT_PROVIDED'`)**: Any metadata field not supplied by (1), (2), or (3) remains `value: null, status: 'NOT_PROVIDED'`. Unknown metadata is never guessed or treated as a match.

## 3. Bilingual Query Parser & Editable Filters (`src/atlas/core/query.js`)

- `parseQuery(queryText, options?)` parses Uzbek and English natural-language queries into a frozen `ParsedQuery` state.
- Equivalent Uzbek and English queries normalize to identical `canonical_filters` and `canonical_signature` (`equalQueryFilters(qUz, qEn) === true`), while every filter preserves its verbatim substring from the query in `source_text`.
- Unrecognized words or unsupported numeric/unit tokens are retained in `unparsed_requirements` and as filters with `status: 'UNKNOWN'` (`field: 'unparsed'`), evaluating to `'unknown'` (`Manbada noma'lum` / `Unknown in Source`) in `evaluateChecklist`.
- Pure filter editing API: `addFilter(queryState, spec)`, `updateFilter(queryState, idOrField, patch)`, `removeFilter(queryState, idOrField)`, `skipClarification(queryState, skipped)`.
- The 70% threshold (`ALIGNMENT_THRESHOLD_PCT = 70`) is explicitly labeled `alignment_score` (`SCORE_TERMINOLOGY = 'alignment_score'`), never scientific confidence or safety probability.

## 4. Tier-First Ranking & ±10% Weight Sensitivity (`src/atlas/core/ranking.js`)

### Stage A — Tier 1–4 Priority (`classifyEvidenceTier`)

| Tier | Code | Criteria |
| --- | --- | --- |
| **Tier 1** | `TIER_1_DIRECT_MATCH` | Experimental `OBSERVATION` (never proxy/emulator/CFD) where all queried physical conditions (`material`/`fuel_type`, `domain`, `environment`, `o2_concentration` + `oxygen_location`, `flow_velocity`, `sample_width`) are `MEASURED` and directly match. |
| **Tier 2** | `TIER_2_RELATED_DIFFERENT_CONDITIONS` | Experimental `OBSERVATION` sharing the primary material/fuel/domain, not a gas-burner proxy or CFD simulation, where one or more secondary conditions differ or have `NOT_PROVIDED` metadata. |
| **Tier 3** | `TIER_3_PROXY_OR_MODEL` | Physical proxy/emulator (`FLIGHT_PROXY_0G`, `GAS_EMULATION`, gas-burner trial with `burner_flow` O₂ such as [NASA PSI-159](https://psi.nasa.gov/investigations/PSI-159)) or numerical simulation (`MODEL_RESULT`, `GROUND_CFD`). Never outranks Tier 1 or Tier 2 direct solid-fabric evidence. |
| **Tier 4** | `TIER_4_CONTEXT_ONLY` | Non-experimental claims (`HYPOTHESIS`, `OBJECTIVE`, `CAVEAT`), unrelated domain/fuel, or unverified background context. |

### Stage B — Within-Tier Component Scoring & Tie-Break (`computeComponentScores`, `scoreWithinTier`)

- Default weights: `DEFAULT_WEIGHTS = { domain: 0.25, fuel: 0.25, atmosphere: 0.25, unit_family: 0.25 }`.
- Unknown metadata on a component strictly scores `0`.
- An oxygen measurement with `location: 'burner_flow'` (e.g. 85% O₂ in [NASA PSI-159](https://psi.nasa.gov/investigations/PSI-159)) scores `0` when the query requests or defaults to `chamber_atmosphere`.
- Deterministic tie-break order within a tier: (1) `alignment_score` descending, (2) matched checklist count descending, (3) review flag count ascending, (4) `study_id` ascending, (5) `trial_id` ascending.

### Stage C — ±10% Relative Weight Perturbation (`checkWeightSensitivity`)

Each of `domain`, `fuel`, `atmosphere`, and `unit_family` is perturbed one at a time by `-10%` and `+10%` relative (`w_k * 0.90` and `w_k * 1.10`), and all four weights are renormalized to sum to `1.0`. If the within-tier ordering of `trialKey(study_id, trial_id)` changes in any tier across the 8 runs, `sensitivity.warning` is `true` (`status: 'SENSITIVITY_ORDER_CHANGED'`) with full flip details.

## 5. Library Filtering & 1–3 Selection (`src/atlas/core/library.js`)

- `selectLibraryStudies(database, filters?, options?)`: groups active trials by `study_id` so each parent study appears at most once even when spanning multiple unit families (`FAMILY_A_FLAME_METRICS`, `FAMILY_B_ATMOS_THERMO`, etc.).
- `selectStudyTrials(database, study_id, options?)`: pure `Study → trial` selector scoped to `study_id` so identical `trial_id` values across different studies never collide.
- `validateTrialSelection(database, selection)` and `updateTrialSelection(currentSelection, candidate, action)`: require composite `[study_id, trial_id]` identity (rejecting bare `trial_id` strings with `COMPOSITE_STUDY_TRIAL_ID_REQUIRED`) and enforce `1..3` selected trials (`MIN_SELECTED_TRIALS = 1`, `MAX_SELECTED_TRIALS = 3`).

## 6. Evidence-Gap Detector & Conclusion Guard (`src/atlas/core/gap-guard.js`)

- `detectEvidenceGap(databaseOrRecords, queryOrScenario, options?)` returns one of four exact statuses:
  - `'Direct matching evidence'`
  - `'Related evidence with different conditions'`
  - `'No matching evidence in connected corpus'`
  - `'Insufficient metadata'`
- Critical guardrails:
  - If any queried condition is unknown on a matching candidate record, returns `'Insufficient metadata'` — never `'Direct matching evidence'`.
  - Includes `corpus_scope_note` stating that `'No matching evidence in connected corpus'` applies strictly to the connected local corpus, never claiming absence in all of science.
  - Blocks Lunar (`0.16g`) and Martian (`0.38g`) combustion value interpolation (`interpolation_blocked: true`, `interpolated_values: null`).
  - Records D's authoritative `src/atlas/data` rules as an explicit dependency (`PENDING_AUTHORITATIVE_D_PACKAGE` until connected).
- `guardConclusion(database, proposal, options?)` requires resolved `{ study_id, trial_id, revision_id, field }` provenance via Z01's `getRevision` and `fieldEvidence`, and blocks:
  - Missing or unresolved provenance citations (`PROVENANCE_CITATION_REQUIRED`, `UNRESOLVED_PROVENANCE_SOURCE`);
  - Unsupported safety/certification verdicts (`UNSUPPORTED_SAFETY_OR_VERIFICATION_VERDICT`);
  - Conflating corpus absence with scientific non-existence (`CORPUS_ABSENCE_CONFLATED_WITH_SCIENTIFIC_NONEXISTENCE`);
  - Partial-gravity interpolation or extrapolation (`PARTIAL_G_INTERPOLATION_OR_DIRECT_EXTRAPOLATION_BLOCKED`);
  - Conflating `1.2 cm` / `2.2 cm` `sample_width` from [NASA/TM-20210011385 Table 7.1, PDF p. 104](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=104) with `sample_thickness` (`WIDTH_THICKNESS_CONFLATION`);
  - Applying `burner_flow` oxygen to `chamber_atmosphere` (`BURNER_FLOW_TO_CHAMBER_ATMOSPHERE_MISMATCH`);
  - Claiming a `REUSED` sample (`GMT216-T25`) as `NEW` (`REUSED_SAMPLE_CLAIMED_AS_NEW`) or omitting the reuse limitation (`REUSED_SAMPLE_LIMITATION_REQUIRED`);
  - Invented physical numbers not present in the cited revision(s) (`UNGROUNDED_SCIENTIFIC_NUMBER`).

## 7. Source-Linked Presentation / Report Export (`src/atlas/core/export.js`)

- `buildReportRows(database, options?)`, `exportReportJSON(database, options?)`, and `exportReportCSV(database, options?)` produce human- and analyst-readable reports containing `study_id`, `trial_id`, `revision_id`, raw/SI values and units, ordered flow (`11 -> 3`), `direction`, `location`, `status` (missing state), `sample_history`, `outcome`, and full source locators (`source_url`, `document_id`, `pdf_page`, `printed_page`, `table`, `row_id`, `source_excerpt`, `excerpt_kind`).
- Marked with `report_schema: "skyforge.atlas.report/1"` and `importable_exchange: false` so Z01's `readImport` rejects report files if accidentally passed as raw import exchange, while Z01's `exportJSON`, `exportArchive`, and `writeCSV` remain untouched.

## 8. Optional Re-evaluation API Adapter (`src/atlas/core/reeval-api.js`)

- Because no live AI provider adapter is configured in the repository, `getReevaluationApiStatus()` returns `{ available: false, status: 'API_UNAVAILABLE' }`.
- Adapter objects containing secret keys (`apiKey`, `token`, `secret`, `password`, `Authorization`) are rejected (`API_SECRET_REJECTED`).
- When an external adapter is injected, `proposeReevaluation(store, request, { adapter })` generates an immutable diff without mutating the store; provider errors and `cancelReevaluation(proposal)` leave the original record untouched; `commitReevaluation(store, proposal, { confirmed: true, acknowledgeFlags: true })` creates a new append-only revision via Z01's store commit pipeline.
