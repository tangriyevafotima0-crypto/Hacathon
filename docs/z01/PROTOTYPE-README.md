# SKYFORGE

**Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data**

A complete local React + Tailwind CSS dashboard for a NASA Space Apps Challenge project. This version is an educational scenario explorer: it does not yet analyze a microgravity experimental dataset or call an AI service. No NASA validation or endorsement is claimed.

## Run in VS Code

1. Install Node.js 22.12 or newer (Node 24 LTS is suitable) and Visual Studio Code.
2. Extract `SKYFORGE-complete.zip`. In VS Code, choose **File → Open Folder** and open the extracted `skyforge` folder containing `package.json`.
3. Choose **Terminal → New Terminal**, then run:

```powershell
npm ci
npm run dev
```

4. Open the Local URL printed by Vite (normally http://127.0.0.1:5173). Leave the terminal running while developing. Save changes in `src/App.jsx` or `src/styles.css` to see updates. Press Ctrl+C to stop.

`npm ci` installs the exact dependency versions in the included lockfile. If you intentionally change dependencies in `package.json`, run `npm install` to update that lockfile.

## Production and verification

```powershell
npm test
npm run build
npm run preview
```

The production build is in `dist/`. The preview command serves that build locally. No API key, account, environment file or backend is needed. Runtime operation is entirely local; installing dependencies and following research links require internet access.

## Files

- `src/App.jsx`: dashboard and reusable panels, sliders, badges and risk dial.
- `src/model.js`: defaults, material weights, scoring, ranking and rule-based recommendations.
- `src/styles.css`: Tailwind import, aerospace theme, responsive layout and reduced-motion support.
- `src/model.test.js`: deterministic calculations, saturation and control-extreme checks.
- `src/main.jsx`: React entry point.
- `vite.config.js`: React and Tailwind v4 Vite plugins.
- `index.html`, `public/favicon.svg`: application metadata and local icon.
- `REVIEW.md`: findings in the original file and implementation decisions.

## Interactions

- All three native range controls update the input cards, selected material index, comparison bars, count of high scores, formula contributions and Copilot recommendations immediately.
- Click a material row to inspect it in the risk dial. The comparison uses toggle-button semantics and exposes the selected row to assistive technology.
- Reset restores the supplied default inputs (32% oxygen, 10.2 psi, 8 cm/s), selects PMMA and returns to the Prevention tab.
- Prevention, Detection and Suppression tabs support click, Arrow Left/Right, Home and End. Tab moves into the selected panel.
- Model explanations expand and collapse. Research links open the original sources in a new tab.
- Sidebar links jump to dashboard sections. On small screens the sidebar hides; all sections remain available in the main content.

## Scientific assumptions

The original toy formula is retained so the behavior is transparent rather than presented as a new scientific model:

```text
oxygen term  = max(0, oxygen percent - 21) * 0.65
pressure term = max(0, pressure psi - 4.3) * 1.3
airflow term = airflow cm/s * 0.65
score = clamp(round(material base + all three terms), 0, 100)
```

The invented base weights are Nomex 18, PMMA 78, polyethylene 65 and cotton 45. Low (<40), Moderate (40–69) and High (≥70) are arbitrary UI bands. The index is **not a percentage probability**, measured flammability rating or certification. A low value does not mean safe. The formula is not fitted to research. The same modifier is applied to all materials, so it cannot model environmental changes in relative material behavior; scores can also saturate at 100. The original label “Critical” is replaced with “High” to reduce the implication of an operational alarm.

References of 21% oxygen and 4.3 psi are separate mathematical offsets, not a recommended atmosphere. Slider ranges (21–100%, 4.3–14.7 psi, 0–20 cm/s) are inherited exploration bounds, not approved habitat limits. Defaults are demonstration inputs, not NASA operational values.

Real combustion involves coupled oxygen partial pressure, flow, geometry, ignition, heat loss and material properties. The monotonic airflow term cannot represent all flame regimes, extinction or suppression. This tool cannot evaluate actual crew safety or recommend operational atmosphere adjustments. The Copilot is explicitly labeled a rule-based demo. To extend it, import properly sourced data with experiment IDs, test conditions, units and uncertainty; validate any subsequent model separately.

The setting is a **hypothetical orbital cabin**. Lunar surface gravity is partial gravity, so the original Artemis lunar-habitat microgravity label was removed.

## Sources

These sources provide background only; no measurements are imported from them and they do not validate the toy model.

- NASA, [Studying Combustion and Fire Safety](https://www.nasa.gov/missions/station/iss-research/studying-combustion-and-fire-safety/).
- NASA NTRS, [Combustion of Solids in Microgravity: Results from the BASS-II Experiment](https://ntrs.nasa.gov/citations/20160000593).
- [Vite getting started](https://vite.dev/guide/) for toolchain prerequisites.
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite) for the Tailwind v4 integration.

## Design and accessibility

Dark navy surfaces, cyan controls, orange high scores, persistent text labels and comparison bars create a restrained mission-control interface. Grid layouts adapt from desktop to tablet and mobile. Controls use associated labels, visible keyboard focus, native slider behavior, semantic buttons, accessible tabs and reduced-motion styling. The dial has a text alternative; risk bands include labels as well as colors. No external fonts, image services, chart packages or UI kits are required.
