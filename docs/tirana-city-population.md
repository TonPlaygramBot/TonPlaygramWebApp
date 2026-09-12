# Tirana Streets population expansion

The shared city starts with 2,000 ambient/service vehicles plus 30 articulated buses, 300 distributed weapon pickups, 15 roadside arsenals and 600 walking/cycling citizens in addition to existing park, cafe and dealer routines. Street Career is the primary full-body interaction path.

Traffic follows connected directed road edges with lane offsets. A 32 m spatial grid bounds vehicle/pedestrian queries; traffic integrates at 20 Hz, with slower updates for distant civilians. Vehicles brake for visible signal stop lines, stopped queues and pedestrians ahead. A pedestrian who steps into the remaining stopping distance can be struck and damaged. Buses prefer wider roads, carry 12–20 occupants, articulate through turns and can be entered and driven from the front cabin. Their full 18 m body participates in player-vehicle contact and 3D ray queries. Buses occasionally open their doors while stopped at signals; dedicated scheduled routes, passenger boarding and deformable crash physics are not implemented.

Weapon pickups are shared-state objects. Armed NPC and police deaths drop the weapon they were carrying once. On-foot players can collect nearby available weapons; already owned weapons receive ammunition up to the reserve limit. Interaction validates proximity and Street Career line of sight. The 300 city pickups stay in world state for the run; collected city IDs are retained in mission checkpoints. Combat drops expire after five minutes and are capped at 128. Starting a new free-roam world replenishes city pickups.

Shop locations avoid mapped carriageways, buildings and existing collision solids. All 15 have shared-mesh walk-in interiors, signs, dealers, map markers, wall/counter collisions and the existing arsenal purchase rules. Shops are culled beyond 200 m. Nearby ground pickups use existing weapon models, with at most 24 active pickup meshes. Eight locally generated rigged citizen variants vary facial proportions, clothing and builds. The original car, motorcycle and police asset collections are reused.

## Reproduce assets

Run Blender 4.2:

```sh
blender -b --factory-startup --python webapp/scripts/blender/build_tirana_population.py
```

The exported GLBs are committed and load without Blender installed on Render. Reference links and inherited character attribution are in `webapp/public/assets/tirana-streets/population/ATTRIBUTION.md`.

## Validation

- `node --test test/tiranaPopulation.test.mjs test/tiranaCityLife.test.mjs test/tiranaStreetCareer*.test.mjs`: 55 passing tests, including late pedestrian impacts, full bus entry, bus collision extent and shop wall/open-door behavior.
- Targeted TypeScript check of the renderer and StreetCareerGame dependency graphs passes.
- `cd webapp && npm run build`: production build succeeds, including original-asset verification and automatic game-pack manifest generation.
- A 60-second headless populated run completed in 15.7 seconds in this environment before the final shop collision additions; 1,514 vehicles were moving and 516 stopped at the sampled end state. This is simulation evidence, not a phone FPS measurement.
- The actual StreetCareerGame was mounted in a 390 × 844 iframe. The browser environment reported `WebGL context unavailable on this device`; 3D rendering, camera operation, frame rate and sustained mobile memory usage could not be verified there. The authored bus was inspected in a Blender render.

The existing Tirana repair-driving test contains a legacySimulation byte-hash gate that fails on the unmodified checked-out legacy file; this change does not alter that file or weaken the gate. High-population multiplayer snapshot bandwidth and Render room capacity still require a live load test. Only nearby actors are rendered, but the shared simulation retains the complete population.
