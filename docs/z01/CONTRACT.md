# Z01 data contract v1

Owner: Z Codex. Artifact: SKYFORGE-Z01-v1.0.0. This is the Z01 import and persistence foundation for D and Bk. The supplied candidate prototype has no Fire Atlas entrypoint; its existing educational UI is unchanged. This package does not claim Z02, UI integration, independent Analyzer approval, or a production-ready release.

## Files and ownership

`src/atlas/core/index.js` is the runtime public API, `index.d.ts` and `types.d.ts` describe the API and persisted objects. `import.schema.json` describes the exchange row shape; runtime extraction also enforces unit compatibility and physical bounds. `fixtures/bass-ii-seed.json` is a Z-owned integration fixture; it does not replace D's authoritative `src/atlas/data` package. T25 CSV is byte-for-byte the supplied file.

No edits to `App.jsx`, `main.jsx`, `styles.css`, `model.js`, or other owners' files. The sole shared integration change is adding Atlas tests and `demo:z01` to `package.json` scripts. Dependencies and lockfile are unchanged.

## Identity and provenance

| Item | Representation and rule |
| --- | --- |
| Parent study | `study_id`, canonical `PSI-25` for input `study: BASS-II` unless an explicit `study_id` is supplied |
| Child trial | `trial_id`; composite identity is `JSON.stringify([study_id, trial_id])`, never child ID alone |
| Revision | Append-only `revision_id`, `parent_revision_id`, timestamp, import format, explicit import confirmation and flag acknowledgement |
| Active revision | Latest newly accepted version. Reimporting an identical historical record does not reactivate or erase it |
| Source chain | Study → trial → revision → `field_source_refs[field]` → source within that revision |
| Source locator | HTTP(S) URL, document ID or `NOT_PROVIDED`, 1-based PDF and printed pages, table, row, excerpt, excerpt kind |
| Raw input | Every original column and scalar value retained. Unknown columns become `unparsed_columns` with `NOT_EXTRACTED` |
| Trust | Accepting an import means `revision.user_confirmation: CONFIRMED`; it never means scientifically verified. `record.review.scientific_verification` remains `NOT_VERIFIED` |

Use `getRevision(db, study, trial, revision?)` and `fieldEvidence(db, study, trial, field, revision?)` for Bk's evidence panel. Passing a revision pins evidence to that historical version. Field source IDs are scoped to the revision, not globally merged.

## Values and units

| Parameter | Legacy input | Flexible input | SI | Default location |
| --- | --- | --- | --- | --- |
| `sample_width` | `sample_width_cm` | `sample_width_raw` + `sample_width_unit` (`cm`, `mm`, `m`) | `m` | `sample_surface` |
| `flow_velocity` | `flow_raw` | `flow_raw` + `flow_unit` (`cm/s`, `m/s`) | `m/s` | `chamber_atmosphere` |
| `o2_concentration` | `oxygen_vol_pct` | `oxygen_raw` + `oxygen_unit` (`vol%`, `mol/mol`) | `mol/mol` | `NOT_PROVIDED` |

`vol% / 100` is the volume/mole fraction normalization used here; it is not oxygen partial pressure or a mass fraction. Width must be positive; flow nonnegative; oxygen 0–100 vol% or 0–1 fraction. Units from a different family are rejected. If legacy and flexible aliases both appear, their SI values must agree. A legacy `_cm` or `_vol_pct` value cannot silently adopt another unit.

Raw numeric strings accept a decimal dot or decimal comma, not thousands separators. In comma CSV, decimal commas must be quoted. Flow accepts one value or two ordered values separated by `to`, `->`, or `→`. It never sorts endpoints, averages, or flattens an ordered protocol into a range. Direction is derived from the sequence. Constant zero is measured, not missing.

Each parameter retains `raw.text`, `raw.unit`, ordered `raw.values`, `raw_display`, ordered `si.values`, `si.unit`, `si_display`, `direction`, `location`, `status`, and references. These three parameters are implemented; additional scientific fields are retained but not normalized until D/Z agree their unit semantics. No inferred thickness, burn rate, or gravity measurement is added.

Missing states stay separate: `MEASURED`, `NOT_PROVIDED`, `NOT_EXTRACTED`, `NOT_APPLICABLE`, `CONFLICTING`. Unextracted/conflicting raw text is retained without SI numbers; a nonempty measured value marked absent or inapplicable is rejected. Unknown location stays `NOT_PROVIDED`; burner oxygen retains `burner_flow` and cannot silently become chamber oxygen. Flow/sample location defaults are contract interpretations requiring D review, not new table measurements.

## Two passes and commit

Pass 1 (`extractRow`) validates identity, units, bounds and source locator, normalizes values and preserves raw metadata. Pass 2 (`reviewRecord`) flags reused samples, missing material/history/outcome/parameters/location, incomplete evidence, unmapped columns and mismatching source row IDs. There is no uncalibrated confidence score or 0.85 verification threshold.

```js
import { openAtlasStore, fieldEvidence } from './src/atlas/core/index.js';

let storage;
try { storage = window.localStorage; } catch { storage = null; }
const store = openAtlasStore(storage);
const loaded = store.load();
// Render errors rather than replacing a failed read with an empty database.
const preview = store.preview(csvText, 'csv');
// Show preview.entries[*].action, record, review.reasons and preview.errors.
// After the user confirms the displayed import and acknowledges flags:
const result = preview.ok ? store.commit(preview, {
  confirmed: true, acknowledgeFlags: true,
}) : preview;
// result.ok must be checked; keep the original preview on write failure.
// A fresh store instance reads the same persisted records across reload.
```

No writes occur during preview or cancellation. A preview is immutable and bound to its originating store instance. Unconfirmed or caller-fabricated previews are rejected. Any row error prevents the entire batch commit. Identical IDs/content within a batch collapse; conflicting versions of the same identity in one batch reject that batch. Reimport compares normalized record plus raw input and provenance against all revisions; changed provenance creates a revision even when numeric values match. Numeric strings and numbers are distinct raw inputs by design.

One Web Storage `setItem` writes the full validated envelope. Quota/security exceptions return structured errors without advancing in-memory state. Reads validate schema, revisions, active IDs, links, and recompute normalized records from raw input; corrupt stores are never silently reset. Export a backup before any manual recovery. Stale previews are detected against the exact stored bytes. This is optimistic concurrency, not a cross-tab compare-and-swap: Bk must serialize writes (for example Web Locks) if multiple tabs may commit simultaneously. IndexedDB/multi-tab locking is not implemented in Z01.

| Commit error | Bk action |
| --- | --- |
| `CONFIRMATION_REQUIRED` | Show confirmation flow |
| `FLAG_ACKNOWLEDGEMENT_REQUIRED` | Show the flagged reasons and request explicit review acknowledgement |
| `INVALID_PREVIEW` | Regenerate with this store's `preview` |
| `STALE_PREVIEW` | Reload state and regenerate preview |
| `STORE_READ_FAILED` | Show access/corruption details, preserve existing stored bytes |
| `STORE_WRITE_FAILED` | Show quota/access details, retain preview and allow retry |

## Exchange and backups

CSV imports have a header. JSON imports accept an array of flat row objects or `{schema_version: "skyforge.atlas/1", rows: [...]}`. CSV supports BOM, CRLF/LF, quoted commas/newlines, escaped quotes and empty cells. Duplicate/unsafe headers, malformed quoting and differing column counts reject instead of guessing. Maximum input is 5,000,000 JavaScript code units and 10,000 rows. This limit is a practical input bound, not a measured performance guarantee.

`exportJSON(db)` is a source-linked input exchange, recomputed on reimport. `writeCSV(activeRecords(db).map(r => r.raw_input))` is its CSV equivalent. Neither is a revision-preserving backup. `exportArchive(db)` preserves all revisions and normalized raw/SI metadata for backup and review; it is deliberately not accepted by ordinary import as an authoritative store replacement. A source-linked presentation export with explicit normalized columns belongs to Z02. Do not open untrusted CSV directly as a spreadsheet formula; this exchange preserves original source bytes rather than rewriting leading characters.

## D and Bk handoff

D: consume the row schema and fixture; supply authoritative excerpts, exact parameter locations and source metadata. Do not label T20/T21 `NEW` without evidence. Their table rows do not explicitly identify sample history. Z fixture leaves scientific verification pending. Provide other experiment records separately; no claims about eight connected studies are made.

Bk: connect the public API to preview/confirm/error/reload and field evidence. Never show a save success until `commit().ok`; display import confirmation separately from scientific verification. Pass stored results to Z02 search after integration. Keep the existing toy `model.js` risk formula outside Atlas evidence ranking.

Argon, D, Bk, H and Analyzer tasks were not executed or messaged by Z. This handoff is a file package for the user to distribute. Independent Analyzer and PM decisions remain pending.
