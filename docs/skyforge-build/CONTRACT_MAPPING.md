# Build Pack 1.0 contract mapping

The application uses versioned equivalent envelopes for the supplied schemas. Existing normalized measurements and append-only browser revisions retain the Z01 contract. The original baseline is ec60412.

| Pack concept | Implemented representation |
| --- | --- |
| Owner/workspace | Server-issued HttpOnly random session token, hashed in ws_sessions. One private browser workspace per session. Public NASA assets remain public. Named login and cross-device account recovery are outside this release. |
| Conversation/message | ws_records chat/turn records. Each logical turn contains its persisted question, final validated response or explicit failed/cancelled state, idempotency key and corpus snapshot. The public transport returns a final JSON response. |
| Memory | Explicit-consent memory record, enabled flag, version, kind, text and consent time. Default chat setting is off. Context includes up to four enabled items only. |
| Evidence bundle | Existing evidence IDs, source URLs, file/page/record locators and claim types are retained. Owner-uploaded content is USER_UPLOAD. SQLite vectors remain derived data. |
| Immutable analysis | Versioned analysis definition and immutable run with result, snapshot and method. Rerun creates another run. TRIAL/STUDY/MATERIAL research-usefulness modes use the existing tier-first engine. Highest applicable trial aggregation is disclosed. Measured-performance mode abstains without eligible comparable outcomes. |
| Estimate | Physical requests return NOT_ESTIMABLE and missing sampling-frame requirements. Synthetic exercise returns verified Beta-binomial mean and equal-tailed 95% interval with explicit synthetic flag and prior. |
| Scenario | PARTIAL conditional scenario, cited observations, assumptions, unknown outcomes and null probabilities. |
| Shelf | Private manual/smart shelf with query, source/trial membership, reasons and exclusions. Refresh is explicit. Snapshot changes mark shelf/run stale. Moon/Mars shelf results carry RELATED_DIFFERENT_CONDITIONS. |
| Budget | Shared persistent SQLite reservation in microUSD before dispatch. $0.012 maximum reservation, $0.10 UTC-day application ceiling, no provider retries. Missing cost conservatively retains reservation. Current allowlist is the verified google/gemini-3.1-flash-lite model. |

Native document import is limited to 8 MB per file and 200 text chunks per asset. Formats PDF/DOCX/TXT/CSV/JSON use deterministic extraction. Empty PDF pages are OCR_REQUIRED. Images/videos retain original preview and UNINDEXED_MEDIA status. The worker resumes queued records from persistent storage. Source withdrawal removes retrieval and cached outputs and invalidates saved turns containing that source. Physical numeric filters apply only to normalized measurements with known values.

Raw file bytes are retained under workspace-assets for rollback/retention. Deleting through the application withdraws application access and derivatives. It does not claim erasure of server backups.

The new database is additive and separate from the existing ingestion.sqlite. Creation of ws_* tables is idempotent. The tests reopen the database, retain owner identity, detect stale writes and exercise competing ledger reservations. Rollback returns the original server task to its original working directory without deleting either database.
