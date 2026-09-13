# Tirana Streets realism and gameplay audit — 2026-09-13

Base: `main` at `3c86631`. The previous menu/FPS/weapon-picker PR #25907 is already merged. This change keeps those controls and adds the following improvements.

## Changes

- **Construction:** 233 construction-tagged buildings in the streamed neighbourhood layer now have exposed floor slabs, columns, stair flights and landings, selected brick infill, unfinished roof slabs, fencing, roof-mounted lattice cranes, and nearby trucks/material stacks. A missing building height alone never classifies a finished building as construction. Existing landmark-specific presentations remain separate.
- **Three new developments:** Mount Tirana, Hora Vertikale and Bond Tower now appear at verified OSM construction sites. Original, simplified massing uses setbacks/offsets to suggest their different designs. Placement was checked against existing building footprints and mapped road widths; all three cleared both checks.
- **Rendering:** reusable ID maps replace repeated scans through 44,543 neighbourhood buildings; nearby housing uses a spatial index. Imported prop placements are prepared once. Aircraft/prop transforms update before drawing. Geometry remains merged by material in the existing streamed cells, with existing culling/cache budgets.
- **Software compatibility:** the operation fallback no longer creates the GPU-oriented city enhancement/detail assembly or requests imported props it cannot show properly. It still uses the existing core city, camera and simulation. Vertex colours now reach the Canvas renderer; previously coloured merged meshes were rendered with just their base material colour.
- **People:** turn interpolation follows the shortest angle, locomotion playback follows movement speed, rigs without a run clip can reuse walking, cyclists do not play walking clips, and procedural strides advance continuously rather than jumping phase at speed changes. Existing police/gang/civilian role selection and authoritative AI rules are retained.
- **Gameplay:** weapon pickups preserve the active firing cooldown while cancelling reload, closing the pickup/fire cadence loophole. Sweep HUD progress uses kills; the tactical map shows the selected district instead of always saying Blloku. The city-map launcher and route note now sit above the game root: the old launcher was hidden underneath the look/fire surface, so tapping it could fire a shot instead.
- **Store placement:** five generated shops were on slopes while the shared room mesh rendered at zero elevation. Their separate collision walls also sampled different terrain heights. Flat-floor shops now require a zero-datum city plot over their whole footprint/apron. All 15 stores remain available, with aligned visuals, walls and entrances. Existing saved sessions may keep old server-owned placements until a new session is created.

## Reference research and accuracy

Sources were checked on 2026-09-13. Architects' project pages can lag site progress; planned floors/heights are not treated as built floors/heights.

| Development | Construction-status/design source | Location source | In-game interpretation |
| --- | --- | --- | --- |
| Mount Tirana | [CEBRA](https://cebra.dk/works/mount-tirana), planned 205 m; [Nova](https://novaconstruction.al/en/projects/projects-in-construction), Barrikada Street, 58 planned floors | [OSM way 1198141918](https://www.openstreetmap.org/way/1198141918), version 4 | Exposed, stepped frame, illustrative 44.8 m phase |
| Hora Vertikale | [OODA](https://ooda.eu/projects/hora-vertikale), stacked seven-storey cubes, under construction; Nova identifies Muhamet Gjollesha Street | [OSM way 1319729560](https://www.openstreetmap.org/way/1319729560), version 1 | Offset volumes with partial brickwork, illustrative 32 m phase |
| Bond Tower | [OODA](https://ooda.eu/projects/bond-tower), under construction, Dritan Hoxha Avenue, 50 planned floors | [OSM way 1482335158](https://www.openstreetmap.org/way/1482335158), version 2 | Offset frame and more extensive infill, illustrative 38.4 m phase |

The downloaded OSM way/node records supplied site outlines, **not surveyed tower footprints**. Those outlines, versions, source timestamps and project links are in `developmentSites.mjs`. The smaller building footprints are authored inside the sites, avoiding existing mapped buildings and roads. Heights, staging, stairs, facade bays and equipment are illustrative. No completion date or present floor count is asserted. Existing finished buildings were not arbitrarily converted into building sites.

Visually inspected [Ales Construction's Tirana's Rock site photograph](https://ales.al/construction/projects/tiranas-rock/) for exposed concrete, cranes, site fencing and the relationship with neighbouring buildings. This older image is a material/form reference, not evidence of current completion. No reference photographs are redistributed or used as game textures. OSM outlines retain ODbL attribution.

Construction sites remain fenced scenic structures with the existing footprint collision contract. Visible staircases are not new playable interiors; the collision model does not yet resolve individual slab/column openings. Trucks and cranes are static merged scenery. These three examples are not a complete inventory of every current Tirana development.

## Visual verification

The supported browser loaded the **actual operation game** and rendered it using the existing Canvas compatibility renderer. WebGL creation reports `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`. No supported capability enables it in this session.

Observed in the actual game:

- Operation menu and locked later operations; 120 FPS and Battery settings persisted across reloads.
- Aim-assist toggle, deployment, owned-weapon picker, and pause screen.
- City map opens above the gameplay surface, pauses solo play, searches for Mount Tirana, selects its mapped location, and sets a route ending 22 m from the pin at mapped access. Closing the map resumes play.
- Corrected tactical-map label reads `TIRANA / SKANDERBEG SQUARE`.
- Street Career reached its explicit WebGL-unavailable error and returned to the operation menu.
- Actual city/weapon geometry was inspected in a gameplay screenshot. Software output has substantial limitations and displayed only about 1–4 FPS here; this is **not a WebGL or phone benchmark**.

`/tirana-construction-review.html` is a developer inspection entry using Three's SVGRenderer and the **same construction geometry generator as streamed gameplay**. The portrait-width view supports site selection, rotation and street/elevated cameras. Frame, infill and unfinished-roof views were visually checked; the review exposed and helped correct crane proportions. It is a geometry review, not a replacement game or proof of shader/texture/shadow quality.

Full WebGL playthroughs, touch controls on real phones, sustained 50–120 FPS, networked human play, and every career mission were not visually verified. No production deployment or paid transaction was performed.

## Verification

- Full Vite production build passed. Existing oversized-world chunk warnings remain.
- Scoped strict TypeScript check passed, including the new review entry.
- Initial focused run: **69 checks passed** across controls, streaming, full-body career, gameplay overhaul and construction tests.
- After the store/cooldown fixes: **64 checks passed** across player experience, population, construction, full-body career and gameplay overhaul. This overlaps the first run and must not be added to it as unique coverage.
- The Canvas renderer was checked with actual red/green vertex-coloured geometry and sampled output pixels; colours remained distinct.
- CPU query benchmark verified identical outputs before timing. Median over 30 iterations: 12 hero queries over 44,543 buildings, **2.257 ms → 0.001 ms**; 552 housing records, **0.036 ms → 0.014 ms**. These timings cover those queries only, not loading, GPU rendering or whole-frame cost.

Reproduce focused checks from the repository root:

```sh
node --test --test-concurrency=2 test/tiranaPlayerExperience.test.mjs test/tiranaPopulation.test.mjs test/tiranaConstructionAudit.test.mjs test/tiranaFullBodyCareer.test.mjs test/tiranaGameplayOverhaul.test.mjs
node --test test/tiranaControls.test.mjs test/tiranaCanopyStreaming.test.mjs
webapp/node_modules/.bin/tsc -p webapp/tsconfig.tirana-controls.json
node scripts/benchmark-tirana-lookups.mjs
npm --prefix webapp run build --ignore-scripts
```

The build assumes the repository's existing asset preparation has been completed. The software review runs with the app's normal development server and is not a published preview URL.

## Broad discovery audit and remaining gaps

All **68** `test/tirana*.test.mjs` and `test/blackwater*.test.mjs` files were attempted with two processes and a 70-second per-file limit. Initial file outcomes: **49 passed, 15 failed, 4 timed out**. Completed TAP summaries recorded 606 passing, 29 failing and 7 skipped checks. This discovery run happened during development; see `tirana-realism-audit.json` for file-level results. Subsequent focused fixes/reruns supersede its pickup-cooldown and shop-collision failures.

Additional CJS checks: mobile quality passed; the older racing repair runtime check failed. These are separate from the 68-file totals.

The broad suite is not green. Findings include:

- Older tests assume a pistol starter, 35 weapons, smaller traffic counts, four opening enemies, 150 reserve rounds, or three-wave default play. Current code has different explicit loadout/population/mode contracts. The bundled operation harness now reaches its actual simulation and even its win state, but retains outdated totals and a relative-asset URL failure.
- Several tests compare whole source-file hashes or old racing circuit identity/lengths. Existing shared-map changes invalidate those assertions. They need behavioral fixtures rather than new hashes that merely approve any change.
- The terrain test assumes a seat's vertical offset remains exactly one metre on a slope, whereas `driverPoint` rotates it onto the support plane.
- Some source/collision tests still assume regional malls are outside the old map bounds.
- Four render/AI suites timed out: battlefield forces, force squads, gameplay presentation and living city. Treat these as unresolved coverage, not successful checks.
- Three server tests initially lacked bot-local `uuid`. After installing the existing bot dependencies, the real two-client Socket.IO join/ready/drive/resume/cleanup test passed and exited normally. The older `tiranaStreets.test.mjs` did not complete within 45 seconds. Three Blackwater stake assertions passed, but that process remained alive and was interrupted; it is not counted as a completed passing suite.

Remaining priorities: run the complete game on a GPU-enabled phone/browser, profile world startup and the roughly 10 MB world chunk, reconcile legacy tests with the current mode/catalog contracts, inspect construction against fresh street-level captures, and implement physical construction interiors if they should become playable.
