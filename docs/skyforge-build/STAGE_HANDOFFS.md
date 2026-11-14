# Build Pack stage handoffs

Baseline ec60412, branch codex/skyforge-build-pack. The existing public NASA dataset and legacy Atlas remain available. Native application contracts are versioned equivalents documented in CONTRACT_MAPPING.md.

| Stage | Delivered | Executed evidence | Limits |
| --- | --- | --- | --- |
| 00 Audit | Repository, running server, corpus, budget and capability map | Pack UTF-8 verification; existing 64 tests; SSH runtime checks | No AGENTS.md found in current repo |
| 01 Persistence | Additive ws_* SQLite schema, sessions, optimistic versions, private records, idempotency | workspace.test.js, two SQLite handles, reopen and two-client API test | Browser session identity, no account recovery |
| 02 Ingestion | Selected unchanged NASA corpus, owner-scoped document imports, native PDF/DOCX/CSV/JSON/text, persistent worker | Live synthetic PDF/DOCX page/paragraph extraction, CSV test and backend restart | 8 MB upload, 200 chunks, OCR_REQUIRED and UNINDEXED_MEDIA are explicit |
| 03 Retrieval | Existing E5 plus reciprocal-rank lexical/vector fusion, exact IDs and numeric oxygen/location gates | GOLD_SET_RESULTS.json, 7/7 finite expected trial sets | Unstructured uploads do not become canonical normalized measurements |
| 04 Gateway | Existing OpenRouter, strict citations/numbers, allowlisted model, price ceiling, reservation ledger, cache, abort | Live smoke and tests for 401/402/429/timeout/JSON/numeric/cost race | No chargeable retries or alternate model |
| 05 Library | Connected study cards, file previews, manual/smart shelves, AI shelf preview, pins, manual exclusions, opt-in auto-update, comparison | Browser shelf/comparison, API owner boundaries | Smart membership uses currently connected public evidence and typed IDs |
| 06 Chat | New Chat, persistent searchable history, rename/archive/delete, bounded context/summary, consent memory, SSE stage events, Stop/retry/copy | Browser history and memory; duplicate request/Stop tests; restart | Final validated result streams as one event, token deltas are not displayed |
| 07 Rank | Existing tier-first engine, editable weights, study/trial/material usefulness, saved runs and sensitivity | Existing Z02 suites; browser run; replay and private-run test | Measured-performance mode abstains without controlled data; custom classes not registered |
| 08 Estimate | Physical eligibility and NOT_ESTIMABLE; verified synthetic Beta quantiles | Beta(4,8), mean 1/3 and checked 95% interval | No eligible real physical probability model in this corpus |
| 09 Scenario | Saved qualitative assumptions, known observations and citations, null probability and next measurement | API and browser scenario/export | Quantitative forecasting remains ineligible |
| 10 UX | Ask AI, Library, Tools, preserved trial selection, source details, export, mobile and keyboard flows | Browser-results.json, widths 390/768/1440 | Full WCAG certification and user study not claimed |
| 11 Validation | Automated, golden, source/media, native extraction, live provider and restart suites | Tests and recorded live-smoke.json | Full adversarial universe and broad performance SLO not claimed |
| 12 Release | Staged deployment, production task backup/promotion, independent rollback path and release evidence | RELEASE_EVIDENCE.md | See acceptance matrix for limits |

Synthetic extraction fixtures and statistical samples are labeled as such and remain owner-private. A NASA catalogue size is distinct from the selected demo download size. Secret values and authentication cookies are omitted from evidence logs.
