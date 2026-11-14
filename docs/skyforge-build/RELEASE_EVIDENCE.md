# SKYFORGE Build Pack — demo release evidence

Task: SKYFORGE-BUILD-PACK-V1. Date: 2026-11-15 Asia/Tashkent. Baseline: ec60412. Source release: 229cb4cacb174d6dbcaed33c42f43c92b35b6897. Branch: codex/skyforge-build-pack. Later evidence-only commits do not change the deployed application.

Demo is available at http://100.105.241.126:4191 on the existing tailnet. This is an implemented, tested demo with the limitations below. It is **not full acceptance of every Build Pack requirement**. No overall completion percentage is inferred from test counts.

## Deployment and recovery

Windows server: Node 26, Python 3.13, 16 GB RAM, Intel UHD 630; G: had approximately 248 GB free during audit. Application: G:/SKYFORGE-NASA/fire-atlas-build-pack. Production scheduled task: SKYFORGE-Fire-Atlas-Pitch. Staging task SKYFORGE-Build-Pack-Staging is stopped. Main service remains bound to the existing tailnet address and port 4191.

Private database: G:/SKYFORGE-NASA/buildpack-workspace.sqlite. Existing ingestion.sqlite and the original fire-atlas-pitch folder are retained. SQLite backup API and original scheduled-task XML backups were written under G:/SKYFORGE-NASA/buildpack-release-backups before promotion. Secrets stayed server-side in .env.local.

Executed rollback returned the original working directory and its study API returned LEGACY_READY, studyCount=5. Promotion then returned READY with workspaceConfigured=true and corpusConfigured=true. Final restart returned source release 229cb4c. Native document and chat records reopened across the rollback/promotion restart sequence. See native-results.json.

On the server, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File G:\SKYFORGE-NASA\release-buildpack.ps1 -Mode Restart
powershell -NoProfile -ExecutionPolicy Bypass -File G:\SKYFORGE-NASA\release-buildpack.ps1 -Mode Rollback
powershell -NoProfile -ExecutionPolicy Bypass -File G:\SKYFORGE-NASA\release-buildpack.ps1 -Mode Promote
```

Rollback changes the scheduled task action; it does not delete or downgrade either database. The release script waits for the listening process to stop before starting another service. An initial promotion check raced the old process and reverted automatically; port-drain verification fixed that. Legacy service does not implement /api/health, so rollback validation uses its real /api/ingestion/studies response rather than accepting the SPA fallback HTML as API health.

## Connected corpus, not the entire NASA repository

| Study | PSI version | Selected local bytes | Files | Indexed chunks | Coverage |
|---|---:|---:|---:|---:|---|
| SAFFIRE-I, PSI-98 | 4 | 134699 | 2 | 12 | Metadata and experimental table |
| SPICE, PSI-107 | 4 | 351361 | 2 | 476 | Metadata and experimental table |
| SAME, PSI-102 | 4 | 135763 | 2 | 16 | Metadata and experimental table |
| DAFT/DAFT-2, PSI-47 | 5 | 1486681 | 3 | 10 | Metadata, table and representative JPEG |
| Cool-flame CFD, PSI-117 | 2 | 22422 | 1 | 7 | Metadata; modeled study, not a flight measurement |
| Total selected files | | 2130926 | 10 | 521 | Partial selections, not full study downloads |

The catalog total of these study versions is 19,967,659,155 bytes; that is distinct from the 2,130,926 downloaded bytes. Their videos and full raw archives are not claimed downloaded. Three source-checked BASS-II trial transcriptions remain available for normalized comparison and ranking. Synthetic native-import fixtures are private and excluded from the public corpus count.

Embedding: Xenova/multilingual-e5-small, revision 761b726dd34fb83930e26aab4e9ac3899aa1fa78, 384 dimensions, index e5-q8-csv-metadata-v1. The existing local runtime creates embeddings; OpenRouter is not used for embeddings. Public retrieval uses lexical/vector fusion and normalized exact-ID/condition guards. Private document chunks retain their source/locator and persistent vectors.

## Executed checks

| Command or observation | Actual result | Evidence |
|---|---|---|
| npm test | 68 passed, 0 failed | tests/atlas and src/model.test.js |
| node scripts/d01-d02-integrity.mjs | PASS, 42 checked artifacts | Historical integration checksum reconciliation recorded in docs/d01-d02/checksums.json |
| npm run build | PASS locally and on server, 58 modules | Application release above |
| node scripts/buildpack-gold.mjs | 7/7 finite expected trial sets | GOLD_SET_RESULTS.json |
| node scripts/buildpack-smoke.mjs | 8 live API checks passed | live-production.json |
| node scripts/buildpack-browser.cjs | History, memory forget, comparison, shelves, tools, export, reload, mobile widths, zoom and keyboard navigation | browser-results.json and workspace-1440.png |
| node scripts/buildpack-native.mjs, restart, then --reopen | PDF 1 chunk/page locator, DOCX 2 chunks/paragraph locators, unchanged repeat stable, originals accessible only to owner, chat retained | native-results.json |
| node scripts/buildpack-updates.mjs | Auto-refresh, exclusions, stale old run and explicit immutable rerun | dependency-results.json |

Gold-set timings are finite observations, not a performance SLO. Original sample search p50=452 ms, p95=1535 ms across seven different queries, including first/cold access. No separate large warm/cold benchmark is claimed. Production grounded chat took 2691 ms wall time, including provider duration 1589 ms, 1125 prompt tokens and 191 completion tokens, reported cost $0.00056775. See live-production.json for the sanitized turn ID. Staging shelf explanation cost $0.00027825. Provider/model is google/gemini-3.1-flash-lite via OpenRouter. Before Build Pack tests the verified account remainder was $5.99418675; this is not a claim of the current balance.

Provider access has a persistent transactional $0.10 UTC-day application cap, $0.012 request reservation, allowlisted model, price ceiling, 650 completion-token cap, bounded context and 22-second timeout. There are no automatic chargeable retries. Missing cost conservatively retains the reservation. Tests use mocks for 401/402/429/timeouts and malformed JSON; successful provider connectivity is demonstrated separately by live-production.json.

## Capabilities and explicit limits

Implemented: separate Ask AI/Library/Tools, durable private chat, idempotent turns, final validated SSE response, Stop, searchable history, rename/archive/delete, explicit-consent memory, editable AI setup proposals, manual/smart shelves, saved analysis definitions and immutable runs, comparison, source locators, original previews, JSON export and stale snapshots. Browser-session isolation was tested across two clients. Session cookie is HttpOnly/SameSiteStrict. Anonymous session history is browser-specific; clearing cookies loses its access.

Supported import formats: native PDF/DOCX, TXT/CSV/JSON, maximum 8 MB/file and 200 chunks. Background extraction persists queue state and restarts. Images/videos retain original preview, byte-range support and UNINDEXED_MEDIA. OCR, video transcription, visual frame interpretation, video timestamps and automatic ZIP extraction are not implemented. Unsupported extraction is labeled, not silently interpreted as missing scientific data.

Ranking currently operates on the three normalized BASS-II trials. Adding an unstructured paper does **not** automatically create validated measurements, new material classes or changed ranks. Smart shelves refresh against the connected public catalog and preserve exclusions; owner-uploaded sources are searchable privately but not automatically enrolled as normalized shelf/ranking candidates. These are remaining product gaps.

Estimate Lab implements a labeled synthetic Beta-binomial exercise with tested quantiles; real physical requests return NOT_ESTIMABLE without eligible independent outcomes. Scenario Lab provides cited observations, assumptions and unknown conditional outcomes; no calibrated physical probability or causal forecast is implemented. Broader contradictory-source synthesis is limited. Evidence usefulness scores are not safety probabilities.

Other open work: named account/login and cross-device recovery; complete literal conformance to all pack schemas (versioned equivalent envelopes are documented); broader malicious-source and conflicting-memory language tests; full permissions/retention administration; complete accessibility audit and separate warm/cold load benchmark. Final responses stream after validation as one result, not individual model tokens. Deleting an asset withdraws access and derived results but retains original server bytes/backups under retention. Current access remains tailnet HTTP, not a public production TLS deployment.

ACCEPTANCE_RESULTS.csv distinguishes tested scope from partial coverage. Critical limited cases prevent a claim of full Build Pack acceptance. Repository CI results are tracked independently from local and live tests.

## Independent Analyzer reproduction

Use Node 24+ and npm ci, npm test, node scripts/d01-d02-integrity.mjs, npm run build. For live free retrieval checks set SKYFORGE_TEST_URL=http://100.105.241.126:4191 and run buildpack-gold.mjs. Native test needs the deliberately synthetic PDF/DOCX fixtures and SKYFORGE_TEST_SESSION_STATE outside the repository; run import phase, restart service, then --reopen. Never commit that session-state file.

The browser script requires Playwright plus CHROMIUM_PATH; configure SKYFORGE_TEST_BROWSER_EVIDENCE and SKYFORGE_TEST_SCREENSHOT to save outputs. Live smoke makes one bounded paid OpenRouter call; preserve the $0.10 ceiling. No API key is needed in a browser or local test script; the existing server environment supplies it. Test sessions are independent from the user's normal browser session.
