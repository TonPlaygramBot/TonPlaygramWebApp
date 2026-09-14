# Tirana Streets mobile and world update

Implemented and tested from `main` at `74a5645167219dc7b776eca39c27db73b4025477`, then rebased onto `394a9c3ee67d35289c199b0d3b5f15dad95c6b6e`. The intervening changes concern other games and do not overlap Tirana files. Review branch only; no merge or deployment.

## Behavior

- Career: MAP / MENU / EXIT form one centered row. Battlefield: MENU / MAP / PAUSE form a centered row. Health percentage and the authenticated TPG account balance appear at the upper left. Street cash is a separate game value.
- Graphics: Automatic, Battery saver, Balanced and High. Automatic starts conservatively from device memory/cores/display size and adjusts DPR, shadows and near detail after sustained frame-rate samples. It targets up to 60 FPS independently of the user's render cap, so a 120 FPS cap on a 60 Hz screen does not incorrectly lower quality. Manual choices remain fixed; settings persist using the existing settings store.
- Complete mapped footprint walls and roofs, roads and public footways stream in spatial batches around the viewer. The minimum visibility radius is 2.2 km, with complete boundary blocks retained. Courtyard holes remain open. Nearby ornament is queued independently. The loading fix replaces the original all-city synchronous allocation with incremental nearby work; coverage fills as districts finish, including after teleports. Physical-phone memory and frame-rate measurements remain necessary.
- Tap the compact weapon control to swap the last two weapons; swipe to cycle the entire carried inventory. No modal opens. Sprint toggles beside the joystick. Each held control retains its own pointer.
- The HUD reads the existing `/api/tirana-store/account` endpoint every 30 seconds and on focus, visibility changes and successful purchases. Failed reads display an unavailable value or the marked last confirmed balance, never invented funds. Existing purchase authentication and idempotency behavior are retained.

## Models and map coverage

Namazgah's uploaded scan and its runtime loader are removed. The replacement is an original, editable Blender exterior with four minarets, three balcony rings per minaret, a central dome, cascading domes, courtyard wings, arcades, window reveals and entrance steps. It has a 102,488-triangle near model and a 17,480-triangle far model (six material draws each). A small complete exterior shell appears immediately; both Blender detail downloads are optional to game entry. Low graphics uses the far model when available; failed downloads retain visible fallback geometry. Source `.blend` files, generators and exported GLBs are included.

The mosque uses the municipality's published 35 m dome / 50 m minaret figures as its authored vertical reference. The remaining dimensions and bay counts are estimates from public exteriors, not surveyed measurements. The model is **not microscopically exact**.

The plenary building receives a Blender entrance with four pilasters, gold capitals, tall windows, paneled doors and a red-carpet stair. Runtime overlays add the large Parliament logo and gold inscription. The separate parliamentary office building is not used as a dimensional reference for this entrance.

Institution guards use the original police humans. Two, four or six guards are authored **game difficulty counts**, unrelated to actual security staffing. Placement rejects building/obstacle collisions and carriageways, falls back to another usable facade, and deduplicates annexes of the same institution. Guards can respond to game incidents and return to their posts. Static layouts are cached; each simulation receives independent actors.

All 14 Albanian Forces GLBs already matched the originals restored September 11 and present September 12. `assets-source/tirana-landmark-rebuild/police-history.json` records the comparison. No substitute humans or new uniform textures were introduced.

The retained OSM snapshots identify 72 source-tagged houses in the Farka/Surrel study regions. These use the new Blender villa window/balcony kit on their mapped footprints; tall generic residential blocks are excluded from villa styling. Coverage contains 529 public walking/cycling segments totaling about 8.27 km. These are existing mapped routes now covered by resident surfaces, **not 529 newly surveyed paths**. Individual mature trees now follow terrain height and remain visible farther away; sparse authored forest crowns extend through 2.2 km inside retained forest polygons.

The snapshots contain no additional unmapped rural tree nodes for this pass. Forest crowns are authored vegetation, not individually surveyed trees. The work does **not** claim every Farka/Surrel villa, tree or lane has been reconstructed. The requested Edi Rama residence and a 1:1 recreation of all public landmarks remain unfinished; no unverifiable residence model or location was invented.

## Public references and attribution

Inspected on September 14, 2026:

- [Municipality: Namazgah](https://tirana.al/pika-interesi/xhamia-e-namazgjase) — published landmark description and principal heights.
- [Namazgah exterior photograph](https://commons.wikimedia.org/wiki/File:Tiran%C3%AB%2C_Albania%2C_2_January_2023_-_Namazgjah_Mosque.jpg) — Sharon Hahn Darlin, CC BY 2.0. The existing repository reference image was inspected; its pixels are not baked into the new model.
- [Parliament exterior photograph](https://commons.wikimedia.org/wiki/File:Kuvendi_i_Shqip%C3%ABris%C3%AB.jpg) — Kj1595, CC BY-SA 4.0; existing repository reference.
- [Public plenary facade photograph](https://media.snl.no/media/192772/standard_Tirana__Albania___National_Assembly_2015_01_1_.jpg) — inspected as an exterior reference; not redistributed in this change.
- [Parliament building information](https://www.parlament.al/Kuvendi/Ndertesa) and [public virtual tour](https://my.matterport.com/show/?m=y5zjW9R7yrk) — building identity/context; the virtual tour was located, not metrically measured.
- [Official Parliament logo, vector by Bes-ART](https://commons.wikimedia.org/wiki/File:Kuvendi_i_Shqip%C3%ABris%C3%AB.svg) — Commons identifies this official symbol as public domain. The unchanged SVG is distributed with the model overlays.
- [Farka park](https://aprtirana.al/parqe-rekreative/parku-i-liqenit-farke/) and [Rolling Hills Liqeni villas](https://rhliqeni.al/villas/) — public context and architectural vocabulary; no private interiors used.
- © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Existing archived footprints, routes and forest boundaries are retained. `rural-coverage.json` records covered source IDs.

## Reproduction and validation

```sh
npm --prefix webapp ci --ignore-scripts
node tools/build-tirana-rural-details.mjs
blender -b --python-exit-code 1 --python tools/blender/tirana_landmark_rebuild.py
blender -b --python-exit-code 1 --python tools/blender/render_landmark_rebuild.py
cd webapp && npx tsc --noEmit -p tsconfig.tirana-gameplay.json
```

Focused regression suites: `tiranaMobileWorldUpgrade`, `tiranaMobileCombat`, `tiranaControls`, `tiranaPatrolCustody`, `tiranaWeaponPurchaseClient`, `tiranaAlbanianForcesRuntime`, and `tiranaLandmarkFallback`.

`test/tiranaMobileUpgrade.browser.mjs` mounts the real React route, selects the real player/loadout, and exercises touch controls and graphics settings at portrait sizes. Its TPG endpoint is a test fixture. Simulation is frozen only for isolated input assertions; GPU draws run on demand using software WebGL. Results must not be presented as real-phone FPS or a production TPG account check.

Validation: all 59 focused regression tests passed. The production build and Tirana gameplay TypeScript check passed. Browser checks passed for three simultaneous contacts, weapon switching without releasing movement/fire, independent release, sprint on/off, all four graphics settings, balance refresh, and 390 × 844 / 320 × 740 control bounds. No page errors or retired-scan requests were observed. Screenshots use an elevated landmark review camera and fixture HUD values. Evidence is in `docs/validation/tirana-mobile-upgrade/`.
