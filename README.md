# RBD Appalachia — Atlas of Accountability (Appalachian Region)

An interactive map from [Rebuild by Design](https://rebuildbydesign.org) focused on the **Appalachian Region**: all **423 ARC-designated Appalachian counties across 13 states**, colored by Atlas of Accountability data (FEMA disaster declarations, recovery funding, social vulnerability, and energy reliability), with the rest of the country muted.

**Live:** https://rebuildbydesign.github.io/atlas-appalachia/

This is a fork of the national Atlas of Accountability (the `atlas-of-accountability-v4` West Virginia workshop build), reframed for Appalachia and its regional partners. Internal project cue: **`rbd-appalachia`**.

---

## What it shows

- **The full ARC Appalachian Region** — 423 counties across 13 states (AL, GA, KY, MD, MS, NY, NC, OH, PA, SC, TN, VA, WV). Everything outside the region is faded so Appalachia reads as the subject.
- **Four Atlas data lenses** (radios, top of the Data Layers panel):
  1. FEMA Disaster Declarations
  2. FEMA Disaster Funding (obligations)
  3. Social Vulnerability (CDC SVI 2022) — **county-level by default**, with an optional **"Show census-tract detail"** toggle
  4. Energy Reliability (SAIDI average / worst-case outage)
- **The 5 ARC subregions**, color-coded (Northern = blue, North Central = purple, Central = green, South Central = orange, Southern = magenta), with colored boundary lines + labels.
- **State + Subregion selectors** — multi-select dropdowns in the Data Layers panel. Check any combination of states and/or subregions to focus the map to those counties (union); nothing checked = the whole region. The non-selected area greys out.
- **White county boundaries** (distinct from the darker state lines) and per-state labels for navigation.
- **Collapsible legend** and collapsible Data Layers panel so neither blocks the map.

---

## Repository structure

| File | Role |
|---|---|
| `index.html` | Page shell, control panel (lenses + selectors), legend. Loads assets with `?v=` cache-busting. |
| `scripts.js` | The shared Atlas engine (map init, lens styling, popups). **Largely inherited from the national Atlas** — its data logic is untouched; only the initial camera, county-label filter, the SVI county/tract gate (`window.SVI_TRACT_DETAIL`), and county-border color were edited. Exposes `window.applyAtlasStyling`. |
| `appalachia.js` | **All Appalachia-specific behavior** (loaded after scripts.js): filters the choropleth to the 423 counties, the region mask, state lines, region outline, subregions, county borders, the state/subregion selectors + SVI toggle, the legend collapse, and camera framing. Start here for most changes. |
| `appalachia.css` | Styling for the Appalachia add-ons (selectors, dropdowns, legend). |
| `styles.css` | Inherited Atlas styles. |
| `data/` | GeoJSON + JSON data (see below). |
| `workbook/` | Local partner deliverable (Excel). **Gitignored — not deployed.** |

### `data/` files

- `Atlas_FEMA_V2.geojson` — the national county dataset (all US counties, every Atlas metric). The choropleth source.
- `appalachia_geoids.json` — the 423 Appalachian county GEOIDs (choropleth filter).
- `appalachia_counties.geojson` / `appalachia_counties_sub.geojson` — the 423 county polygons (the `_sub` file adds a `subregion` property). `appalachia_counties.geojson` is the source for the region-only white county borders.
- `appalachia_boundary.geojson` — dissolved region outline.
- `appalachia_states.geojson` / `appalachia_state_labels.geojson` — per-state Appalachian-portion polygons (state boundary lines, state-solo dimming) + label anchors.
- `appalachia_state_geoids.json` — per-state county GEOID lists (state selector).
- `appalachia_subregions.geojson` — the 5 dissolved subregion polygons (colored outlines + dimming).
- `appalachia_subregion_geoids.json` — per-subregion county GEOID lists (subregion selector).
- `appalachia_subregion_labels.geojson` — subregion label anchors.
- `appalachia_subregions.json` — the authoritative county → subregion crosswalk.
- `appalachia_mask.geojson` — world-minus-region polygon (mutes surroundings; sits below the base `water` layer so ocean/lakes keep their blue).
- `appalachia_summary.json` — per-state full-vs-Appalachian stats (feeds the hidden snapshot panel).

---

## Data & methodology

- **Region + subregions:** the [Appalachian Regional Commission](https://www.arc.gov). County membership from ARC's "Appalachian Counties Served by ARC"; subregion assignments from ARC's official **"Subregions in Appalachia, 2021"** file (reflects Public Law 117-58 — WV Brooke/Hancock/Marshall/Ohio moved to North Central; NC Catawba/Cleveland and SC Union added). Subregion counts: Southern 105, South Central 87, Northern 82, Central 82, North Central 67 = **423**.
- Virginia's ARC entries are composite "county + independent city" labels; joins strip to the lead county name.

### Atlas data sources

| Layer | Source | Vintage |
| --- | --- | --- |
| FEMA Disaster Declarations (climate events) | iParametric | 2011–2024 |
| FEMA Obligations (Federal Share) | iParametric / OpenFEMA | 2011–2024 |
| HUD CDBG-DR (statewide, workbook only) | HUD | 2011–2024 |
| Social Vulnerability Index | CDC/ATSDR | 2022 |
| Energy Reliability (SAIDI) | U.S. Energy Information Administration | 2023 |
| County boundaries | ESRI / Census | 2020 |
| Appalachian Region & subregions | Appalachian Regional Commission | 2021 |

### Data rules (important — carried over from the national Atlas)

- **Never sum FEMA disaster declarations** across counties or states — one event spans many, so a sum double-counts. Use county/people counts, per-county median/max, or the real statewide declaration count.
- **Dollars and population are additive** (safe to sum); per-capita = summed dollars / summed population.
- **SVI and SAIDI are distributional** — summarize with the median, not a sum.
- Test every framing against the reverse reading. (Example: North Carolina's Appalachian counties are *less* vulnerable/funded than full-state NC, because full-NC totals are dominated by coastal hurricane counties.)

---

## Partner data workbook (local, not in the repo)

`workbook/Full_Appalachia_Atlas_County_Data.xlsx` — for regional partners and pivot tables. Five tabs:

1. **County Data** — all 423 counties (state, subregion, county, OMB class, population, FEMA declarations, FEMA obligations, per-capita, SVI + category, SAIDI avg/worst).
2. **By State** — 13-state summary (aggregated per the data rules above).
3. **By Subregion** — 5-subregion summary.
4. **Notes** — sources + methodology.
5. **Full State Data** — the 13 Appalachian states' *statewide* figures from the original Atlas release (FEMA PA+HM, HUD CDBG-DR, total federal, ranks) for reference. Statewide funding here uses a different definition than the county tab's FEMA obligations — do not cross-add.

Header style: black background, white text, Arial 10 throughout.

---

## Development & deployment

Static site on **GitHub Pages** (`main` branch, root), repo `rebuildbydesign/atlas-appalachia`. No build step — open `index.html` to run locally.

- **Deploy** = commit + push to `main`; Pages rebuilds automatically.
- **Push auth:** this machine has two `gh` accounts; the repo owner is `rebuildbydesign`. Push explicitly with that account:
  ```
  git -c credential.helper= push \
    "https://x-access-token:$(gh auth token --user rebuildbydesign)@github.com/rebuildbydesign/atlas-appalachia.git" main
  ```
- **Cache-busting:** `index.html` loads `scripts.js?v=N`, `appalachia.js?v=N`, `appalachia.css?v=N`, `styles.css?v=N`. **Bump `N` on every asset change** or browsers serve stale JS/CSS. (A `?cb=` on the page URL only refreshes the HTML, not the sub-resources.)
- **Mapbox:** base style `mapbox://styles/j00by/clvx7jcp006zv01ph3miketyz` ("Rebuild-Atlas", the original Atlas base map). The `pk.` token in `scripts.js` is a publishable token (safe to be public).

### Gotchas

- **Lazy render:** the map boots to a black screen with the info panel open and only fires `load` / paints after a real user interaction (mouse drag/click). The 5MB national geojson also tiles slowly (~10–20s) after load.
- The dormant West Virginia workshop overlay code in `scripts.js` never fires (no WV checkboxes, no statefilter.js) and is left in place.

---

## Resuming this project with Claude

Say **`rbd-appalachia`** to pick this back up. Key context: this README, the live URL above, and `appalachia.js` (where almost all project-specific behavior lives). Any `data/appalachia_*` file can be regenerated from the national `Atlas_FEMA_V2.geojson` + the ARC crosswalk (`appalachia_subregions.json`).

---

## Credits

Built by [Judy Huynh](https://github.com/judy-huynh) for [Rebuild by Design](https://rebuildbydesign.org), 2026. Partner inquiries: **[info@rebuildbydesign.org](mailto:info@rebuildbydesign.org)**.
