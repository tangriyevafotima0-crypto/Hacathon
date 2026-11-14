# SKYFORGE Fire Atlas

Atlas core for team SKYFORGE. Shared repository: https://github.com/tangriyevafotima0-crypto/Hacathon

The initial repository was empty. This import contains the supplied React/Vite educational prototype plus Z Codex's isolated Atlas core. The visible prototype is not yet the Bk Fire Atlas interface. Its illustrative risk formula is not used by the Atlas core.

## Current status

| Component | Status |
| --- | --- |
| Z01 data contract, CSV/JSON import, revisions, provenance, raw/SI and storage adapter | Implemented |
| Tests | 32 passed locally: 3 original model tests, 20 Z01 tests, and 9 Z02 tests |
| Import/reload/repeated-import core demo | Passed with injected storage and disk reload |
| Production build | PASS locally and in [Z02 GitHub Actions](https://github.com/tangriyevafotima0-crypto/Hacathon/actions/runs/43577442863) |
| D authoritative data and scientific review | Pending integration |
| Bk Atlas UI and real browser acceptance | Pending integration |
| Z02 query/ranking/gap/conclusion/API | Implemented in the Atlas core. See the [Z02 contract](docs/z02/CONTRACT.md). |
| Analyzer / PM approval | Pending |

## Verified repository baseline

[CI run 43572572407](https://github.com/tangriyevafotima0-crypto/Hacathon/actions/runs/43572572407) passed `npm ci`, all 23 tests, and `npm run build` at commit [`04df762`](https://github.com/tangriyevafotima0-crypto/Hacathon/commit/04df76287b92d5b78423125753052cbdd31570b3). Vite 7.3.7 built successfully. All 45 delivered source/evidence files matched their local Git blob hashes at that commit; teammates' DOCX files were preserved. Original local build-failure logs remain historical evidence of the restricted local network, not the current CI result. Browser integration and scientific review remain pending.

## Run

Node.js 22.12+ required.

```sh
npm ci
npm test
npm run build
npm run dev
```

Core tests and demonstration need no installed frontend dependencies:

```sh
npm test
npm run demo:z01
npm run demo:z02
```

## Team integration

- Z owns `src/atlas/core`, import/store/search/export and shared types. Public API: `src/atlas/core/index.js`.
- D supplies authoritative source packages in `src/atlas/data`. Z's starter fixture is intentionally under `core/fixtures`.
- Bk owns `src/atlas/ui`, translations and styling, and consumes Z's contract.
- H owns acceptance scenarios and demo evidence. Analyzer independently repeats checks.
- Make small owner-specific branches and pull requests. Agree shared entrypoint/type changes before merging. Do not overwrite other owners' work.

Start with [Z01 contract](docs/z01/CONTRACT.md), [original artifact handoff](docs/z01/HANDOFF.md), and [GitHub handoff and next steps](docs/z01/GITHUB-HANDOFF.md). The original prototype instructions are retained in [PROTOTYPE-README.md](docs/z01/PROTOTYPE-README.md). Logs describe observed checks of Z01-v1.0.0; GitHub integration metadata is recorded separately.

For the Z02 API, integration example, and test results, see the [Z02 handoff](Z02-HANDOFF.md). Its historical Argon runs are recorded alongside the local Windows results.

Import confirmation is separate from scientific verification. T20/T21 history remains unknown, T25 remains reused and flagged; no unsupported NASA verification or predictive safety claim is made.
