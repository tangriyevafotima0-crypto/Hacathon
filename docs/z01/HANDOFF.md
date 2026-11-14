# Z01 Analyzer handoff

Task: Z01. Owner: Z Codex. Artifact: **SKYFORGE-Z01-v1.0.0**. Repo/commit: shared integration repository not supplied; artifact version and SHA-256 manifest identify this delivery. Z02 is the subsequent stage in `01-Codex-prompt.txt`; the immediate instruction in `00-BOSHLASH.txt` is Z01 now.

## Implemented

- Study/trial composite identity, append-only revisions, active version, import provenance, revision-scoped field source lookup.
- Distinct missing states and sample history; raw input and SI values; ordered flow; parameter location; preservation of outcome wording.
- RFC 4180-style CSV and flat JSON exchange, two-pass extraction/review, immutable preview and explicit confirmation, flagged acknowledgement.
- Batch duplicate/conflict detection, repeated/historical import deduplication, safe revision creation, stale preview rejection.
- Injected localStorage-compatible persistence, read corruption/schema checks, write/quota errors, retry and independent reload.
- Source-linked raw CSV/JSON exchange and full revision archive for reproducibility; Z02's presentation export remains separate.
- T20/T21 fixture and original T25 CSV; physical regression tests and repeatable end-to-end core demo.

## Observed checks

| Check | Actual result | Evidence |
| --- | --- | --- |
| Original prototype model tests | PASS 3/3; exit 0 | `baseline-tests.log` |
| `npm test` | PASS 23/23; 0 failed; exit 0 | `npm-test.log` |
| `npm run demo:z01` | PASS; 2 seed inserts, 1 T25 insert; reload returns 3 trials; second T25 import makes 0 changes | `demo.log`, `demo-output/store.json` |
| Offline dependency install | FAIL, exit 1: `ENOTCACHED` for exact Vite 7.3.7 tarball | `npm-ci-offline.log` |
| `npm run build` | FAIL, exit 127: `sh: vite: command not found` | `build.log` |
| Original files integrity | Only package scripts changed; original dependency lockfile and UI/model files unchanged | `baseline-integrity.json`, `package-scripts.patch` |
| T25 supplied bytes | Identical to supplied CSV | `MANIFEST.sha256` and original local file comparison |
| Browser localStorage/reload/E2E | NOT RUN; adapter semantics tested with injected storage and disk reload | No browser evidence claimed |
| Hosted offline reload / app shell cache | NOT RUN / NOT IMPLEMENTED | No offline-hosting claim |
| D/Bk integration and independent Analyzer | NOT RUN; common repo/fixture/UI not supplied | This package is the integration handoff |
| Live AI API | NOT IMPLEMENTED / NOT RUN | No provider or server credentials used |

The initial online `npm ci --cache /tmp/skyforge-npm-cache` also failed with `ENOTFOUND registry.npmjs.org`. No dependency versions were changed to make a different cached build appear equivalent. Node v24.18.1 and npm 11.16.0 were observed in this environment. Timing in test logs measures these local checks only, not product latency.

## Scientific grounding and scope

Official source: [NASA/TM-20210011385, Table 7.1](https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf#page=104). NASA's indexed full-text table was checked against all three rows. It reports printed page 96; PDF viewer page 104 follows the supplied plan's locator. The 49 MB PDF could not be fetched/rendered in this environment, so visual PDF-page confirmation is **NOT RUN**.

| Trial | Width | Ordered flow | Oxygen | Original comments |
| --- | --- | --- | --- | --- |
| GMT190-T20 | 1.2 cm | 11 → 3 cm/s | 17.2 vol% | Quenched |
| GMT190-T21 | 1.2 cm | 11 → 47 cm/s | 17.2 vol% | Blow-off |
| GMT216-T25 | 2.2 cm | 5 → 2.5 cm/s | 20.8 vol% | Reused, ignited |

T20/T21 sample history is `NOT_PROVIDED`: Table 7.1 does not explicitly label these rows NEW. No thickness was substituted for width. T25 remains REUSED and flagged, not silently promoted to verified. The fixture excerpts are marked table transcriptions, not verbatim prose. The supplied T25 lacks document ID and an excerpt; those remain missing and flagged instead of being invented.

The revised team plan takes precedence over the older master prompt's claims of eight verified studies, 0 ms latency, NEW history without evidence, and whole-app completion by one agent. This delivery connects exactly two seed rows plus the user-imported third row. The older `src/model.js` risk scores remain educational prototype behavior and are not imported into Atlas evidence or SI values. No additional DOI, lunar/Martian burn prediction, proxy ranking or corpus coverage was asserted.

## Integration steps

1. BN supplies the shared repo URL/branch/commit and lockfile baseline. Copy Z-owned new paths, then merge the small package script diff into existing scripts. Do not overwrite another owner's entrypoint/UI/data.
2. D reviews `CONTRACT.md`, `import.schema.json` and the seed; confirms physical locations and source excerpt provenance; supplies authoritative fixture records. The loader deliberately does not interpret a user import as scientific verification.
3. Bk injects `window.localStorage`, renders preview actions/reasons/errors, requests explicit import/flag confirmation, checks save results and uses `fieldEvidence` for exact source links. For multiple simultaneously writing tabs, serialize commits; optimistic byte comparison alone is not a transactional cross-tab lock.
4. Z02 implements query parsing, editable filters, tier-first ranking, sensitivity, library filtering, source-linked presentation export and D-approved conclusion/gap rules when that stage is opened. Live API adapter is conditional, not simulated as operational.

## Analyzer reproduction

1. Extract this exact package into a clean directory; read `Z01-READ-ME.md`. Verify every line of `MANIFEST.sha256` with `shasum -a 256 -c MANIFEST.sha256` from `skyforge`.
2. Run `npm test`. Expected: 23 tests, 23 pass, 0 fail. The first 3 are original illustrative-model tests, the next 20 exercise Atlas.
3. Run `npm run demo:z01`. Expected commit changes: 2, then 1, then 0; generation remains 2 after repeated import. `RELOAD` lists T20, T21 and T25 with separate outcome strings.
4. Inspect `docs/z01/demo-output/store.json`: three composite identities, one revision each, active revision IDs, raw/SI order and scoped source references. Inspect exchange JSON/CSV for original metadata and quoted T25 outcome.
5. On an internet-enabled machine, run `npm ci`, `npm test`, `npm run build` against the unchanged lockfile. The author's build failure is not a pass; retest is required.
6. After Bk integration, verify real browser preview/cancel/confirm, denied storage/quota reporting, reload, historical source links, mobile and offline behavior separately. Verify the NASA PDF locator visually. No such browser acceptance is implied by the Node demo.

## Open issues and dependencies

| Priority | Owner / dependency | Open item |
| --- | --- | --- |
| Release blocker | Environment / BN | Exact dependency installation and production build have not passed |
| Integration blocker | BN + D + Bk | Shared repo commit, authoritative D fixture and Bk integration unavailable |
| Integration requirement | Bk/Z | Cross-tab serialized commits if more than one tab can write; current core uses optimistic stale-preview detection |
| Acceptance pending | Analyzer | Independent rerun, browser acceptance and PDF visual check |
| Next stage | Z02 | Search/ranking/sensitivity/library/gap/conclusion/API/presentation export beyond immediate Z01 |

`Z01 | Z Codex | SKYFORGE-Z01-v1.0.0 | core tests + reload/import demo | PASS; production build FAIL; browser NOT RUN | attached logs | blockers above | Analyzer PENDING | PM PENDING`

No package was sent to another person or agent. The user can forward this artifact to D, Bk and Analyzer; delivery is not represented as having occurred.
