# Bk Codex — B01 / B02

Base: f00e4f7, Hacathon/main. Work performed only for Bk Codex. No Argon role executed, no Argon files modified.

Implemented React Atlas entrypoint in `src/atlas/ui/Atlas.jsx`, local styles, editable material/gravity controls and ID/material/outcome library search, study → trial selection (1–3), four comparison blocks, revision-scoped field evidence with PDF/printed locators and focus return. Import has preview, old/incoming raw diff, explicit flag acknowledgement, confirm/cancel, durable error handling, Web Locks serialization when available, API-unavailable status. Notebook saves/reopens/downloads local notes and selection; JSON/CSV/archive exports use Z public API. D bounded conclusion guard and corpus gap status are integrated without prediction.

D data and `tests/atlas/data.test.js` were extracted byte-for-byte from the repository's `SKYFORGE_D01_D02_Z01_v0.2.0.zip`, directory `SKYFORGE-D01-D02-v0.2.0/`. Z core is unchanged. The shared entrypoint `src/main.jsx` now opens Atlas; the earlier educational App/model remain in place.

## Observed validation

- `npm ci`: PASS, 79 packages installed, unchanged lockfile.
- `npm test`: PASS, 46/46 (original model, Z import/persistence, D scientific guards).
- `npm run build`: PASS, Vite 7.3.7.
- Chromium/Playwright at 1440×1000 and 390×844: PASS, no page errors or horizontal overflow. Screenshots `desktop.png`, `mobile-390.png`.
- Browser seed preview → explicit confirmation → select T20/T21 → width proof link: PASS.
- T25 preview/confirm → reload → repeated preview UNCHANGED: PASS.
- Notebook save → reload → reopen and JSON export with three source-linked rows: PASS.
- Network-off loaded core and proof panel: PASS. Keyboard Tab and focus return to originating field: PASS. This does not claim hosted offline reload.

Repeat: Node 22.12+, `npm ci`, `npm test`, `npm run build`, `npm run dev`. With Playwright installed and `/usr/bin/chromium` available, run `node docs/bk/browser-check.cjs` in another terminal. Screenshots are written to /tmp.

## Dependencies and open items

Z02 free-text UZ/EN scientific parser, tier ranking, sensitivity and 70% clarification are not present in the supplied Z core. UI uses honest field/library filters and explicitly marks this dependency. No simulated AI endpoint is shown. Live server API/provider integration remains unavailable. UZ/EN controls are implemented; scientific status terms and bounded D guard reasons remain in their source language. Fully localized scientific prose, manual recovery of corrupt notebook storage, multi-tab writes without Web Locks, and hosted app-shell offline reload remain open. External NASA PDF access requires network. Independent Analyzer/PM review NOT RUN; no approval claimed.

Task | owner | acceptance | result | evidence | Analyzer | PM
---|---|---|---|---|---|---
B01/B02 | Bk Codex | three-trial core integration and browser flow | PASS within scope above | tests, browser-check.cjs, screenshots | NOT RUN | NOT REQUESTED

## Recheck and fixes

Notebook malformed JSON/schema and denied access now show an explicit error and preserve original storage bytes. File reading catches failures and rejects files above 5 MB before reading. HTML language tracks the selected UI language. Two regression tests cover notebook validation. Browser edge-check.cjs additionally verifies corrupt stores, English, import cancellation, malformed CSV, Moon/Mars gap, exact PDF page and source-linked CSV download. All PASS.
