# SKYFORGE Fire Atlas

Fire Atlas opens the BASS-II comparison, source evidence, import, and notebook interface. The original team archives and their validation logs record their own versions.

## Run locally

Use Node.js 22.12 or later.

```sh
npm ci
npm test
node scripts/d01-d02-integrity.mjs
npm run build
npm run preview
```

Open the URL printed by Vite, normally http://127.0.0.1:4173. Development uses `npm run dev`.

1. In Import, choose **NASA’dan olish** to fetch the PSI-25 table. Review and confirm the three source-checked BASS-II rows. The same import supports CSV and JSON uploads and the T25 demo.
2. Open **PSI-25 · BASS-II** and select T20 and T21. Click a value to open its revision and the NASA locator. Report CSV/JSON exports include measurements and provenance. Exchange JSON can be reimported.
3. Search for `GMT216-T25`, or ask `0g da 1.2 cm enli SIBAL mato yonishi`. Select Moon or Mars to inspect evidence coverage. Save a note in Focus Corner and reopen it after a reload.

The NASA catalogue lists 24 combustion studies. Numeric comparisons use the imported BASS-II trials. The PSI file supplies the original material label, and NASA Table 7.1 supplies the exact sample width and flow protocol.

## NASA and Gemini

The online NASA fetch and optional Gemini re-evaluation use the server middleware registered in Vite dev and preview. A static-only deployment serves the UI and manual import. To expose the API in a deployed environment, host the middleware behind a same-origin Node server.

Copy `.env.example` to `.env.local`, set `GEMINI_API_KEY` in the server environment and restart the server to try live Gemini 3.8 Flash. Check a saved BASS-II trial using **Enni API orqali tekshirish**. The endpoint validates the requested width, the source reference, and the Gemini response. A correction requires explicit confirmation and a current revision. A missing credential is reported as `API_UNAVAILABLE`, and manual import remains available.

[Acceptance and outstanding checks](docs/acceptance.md)

## Team integration

- Z owns `src/atlas/core`, import/store/search/export and shared types. Public API: `src/atlas/core/index.js`.
- D supplies authoritative source packages in `src/atlas/data`. Z's starter fixture is intentionally under `core/fixtures`.
- Bk owns `src/atlas/ui`, translations and styling, and consumes Z's contract.
- H owns acceptance scenarios and demo evidence. Analyzer independently repeats checks.
- Make small owner-specific branches and pull requests. Agree shared entrypoint/type changes before merging. Do not overwrite other owners' work.

Start with [Z01 contract](docs/z01/CONTRACT.md), [original artifact handoff](docs/z01/HANDOFF.md), and [GitHub handoff and next steps](docs/z01/GITHUB-HANDOFF.md). The original prototype instructions are retained in [PROTOTYPE-README.md](docs/z01/PROTOTYPE-README.md). Logs describe observed checks of Z01-v1.0.0; GitHub integration metadata is recorded separately.

For the Z02 API, integration example, and test results, see the [Z02 handoff](Z02-HANDOFF.md). Its historical Argon runs are recorded alongside the local Windows results.

Import confirmation is separate from scientific verification. T20/T21 history remains unknown, T25 remains reused and flagged; no unsupported NASA verification or predictive safety claim is made.
