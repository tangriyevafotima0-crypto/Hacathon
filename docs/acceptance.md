# Fire Atlas integration acceptance

This matrix gives each check equal weight. PASS counts toward the estimate. PARTIAL and NOT RUN count as open. The matrix covers the integration and handoff requested in the correction archive. Hosted offline reload is optional.

| ID | Owner | Check and expected result | Result and evidence |
| --- | --- | --- | --- |
| 01 | BN | Preserve the current main and the Bk archive | PASS, history includes 7d2017f and the Bk UI from SKYFORGE-HAMMASI.zip |
| 02 | BN | Integrate D data and Z02 with the real Atlas entrypoint | PASS, src/main.jsx and clean production build |
| 03 | BN | Clean installation, tests and production build | PASS, npm ci, npm test and npm run build |
| 04 | D | Source checksums use consistent bytes | PASS, scripts/d01-d02-integrity.mjs |
| 05 | D | T20/T21 preserve 1.2 cm width, 17.2 vol% oxygen and unknown sample history | PASS, data.test.js |
| 06 | D | T20 flow 11 to 3 and Quenched, T21 flow 11 to 47 and Blow-off | PASS, data.test.js and Chromium |
| 07 | D | T25 preserves 2.2 cm, 5 to 2.5 cm/s, 20.8 vol% and reused outcome | PASS, data.test.js and import.test.js |
| 08 | Bk | Fetch PSI-25 online and preview three eligible trials | PASS, docs/bk/browser-nasa.cjs |
| 09 | Bk | CSV/JSON preview, flagged review, confirmation and reload | PASS, docs/bk/browser-check.cjs and import.test.js |
| 10 | Z | Repeated import preserves a single trial and existing revisions | PASS, import.test.js and Chromium |
| 11 | Z | Race during API request, historical target, stale confirmation | PASS, integration.test.js |
| 12 | Z | API unavailable, cancel, provider error and retry preserve the store | PASS, z02.test.js, import.test.js and Chromium |
| 13 | Z | Exact H02 UZ/EN questions resolve to equivalent width and other chips | PASS, integration.test.js |
| 14 | Z | 70% banner boundaries and unchanged ranking on Skip | PASS, integration.test.js |
| 15 | Z | Tier priority, deterministic order and eight sensitivity scenarios | PASS, z02.test.js |
| 16 | Z | 29.9/30/34% and edited oxygen location | PASS, integration.test.js and z02.test.js |
| 17 | Bk | Study to first trial in two clicks, with up to three selections | PASS, Chromium and z02.test.js |
| 18 | Bk | Source opens to PDF 104, printed 96 and trial row, focus returns | PASS, Chromium and data.test.js |
| 19 | Bk | CSV/JSON report with raw/SI and provenance, exchange JSON reimports | PASS, z02.test.js, import.test.js and Chromium JSON download |
| 20 | D | Four gap states, partial gravity analogs and no interpolated prediction | PASS, data.test.js, z02.test.js and integration.test.js |
| 21 | Bk | Desktop and 390 px, reload, Notebook reopen | PASS, docs/bk/browser-check.cjs |
| 22 | Bk | Gemini response contract and invalid response rejection | PASS with simulated provider, server.test.js |
| 23 | Bk | Real Gemini 3.8 Flash responses in UZ/EN with usage and timing | NOT RUN, server needs a team GEMINI_API_KEY |
| 24 | H | Original H01 artifact and historical 31-file manifest | NOT RUN, ZIP includes the H01 report text |
| 25 | H/BN | Confirm team local event, local deadline and required format | NOT RUN, team registration evidence required |
| 26 | H | Demo claims grounded in the integrated application | PASS, demo and claim notes below |
| 27 | Analyzer/PM | Independent review, release decision and deployment SHA check | NOT RUN, this matrix records implementation-side verification |

Verified coverage is 23 of 27 checks, about 85%. This is a readiness estimate for this integration scope. Gemini can be enabled with the server credential. The hosted build and formal team handoff require separate verification.

## Demo and claim notes

UZ: NASA’dan BASS-II jadvalini oling va uch sinovni tasdiqlang. T20 va T21 da 1.2 cm en hamda 17.2 vol% O₂ bir xil. Oqim 11 → 3 va 11 → 47 cm/s, kuzatilgan natijalar Quenched va Blow-off. Qiymatni bosib NASA jadvaliga o‘ting. T25 ni qidirib, jadval manbasi bilan eksport qiling. Oy yoki Mars sharoitini tanlab, tanlangan korpusdagi dalillar qamrovini ko‘ring.

EN: Fetch NASA’s BASS-II table and confirm the three trials. Compare T20 and T21, then open Table 7.1 from a measurement. Find T25 and export the report with source locators. Select Moon or Mars to inspect the evidence coverage for the selected conditions.

| Claim | Evidence and limit |
| --- | --- |
| T20/T21 width, oxygen, flow and outcome | NASA/TM-20210011385 Table 7.1. Sample history is unknown. The two observations do not establish a universal ventilation boundary. |
| T25 is reused and ignited | Table 7.1. The row does not establish a later extinction outcome. |
| Lunar and Martian coverage | LUCI and the parabolic precursor are related experiments. FM² is marked as planned in the connected data. The gap assessment is specific to the corpus and conditions. |
| CFI-G inverse burner oxygen | PSI-159 table 1, record 18, trial 21202 A1. XO₂=0.85 belongs to the burner flow. |
| SAME-R particle-size claim | Open pending a specific source locator. |
| Query and online API | UZ/EN filters and ranking are deterministic. Gemini integration accepts source-bounded width checks. Live provider verification is pending. |

Global submission closes on 15 November 2026 at 23:59 local time. Team-specific pitch timing and submission format depend on the registered event. [NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/)
