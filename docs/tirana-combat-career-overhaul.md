# Tirana Streets: combat and career overhaul

Base: `391db8b681ccac45a9b6a5e5daaad65be8f9bb32` on `main`, including the preceding mobile-runtime update. This change keeps the original city, models, textures, population, weapon assets and motion library. It does not change paid-match settlement or deploy the application.

## Design comparison and research

Vice City is a useful interaction and mission reference, not a claim of equivalent fidelity or access to Rockstar's implementation. Rockstar's mobile control guide describes free look outside button areas, contextual foot/driving/flight controls, configurable button placement and left-handed mirroring. This update applies a clearer mission readout, separate jobs/settings navigation and mirrored control groups; it does **not** claim to implement Vice City's fully draggable HUD editor.

The current Three.js renderer remains appropriate for this repository. Introducing a second engine, replacing the city, or migrating to WebGPU would add compatibility and content-conversion risks without a measured benefit here. The implementation uses existing WebGL instancing, pooled effects, local spatial queries, bounded AI decisions and distance-based animation work.

Sources reviewed:

- [Rockstar: Vice City mobile controls and options](https://support.rockstargames.com/articles/6PXKAiKnAwtES5fSl4JFtT/detailed-breakdown-of-controls-options-in-vice-city-10th-anniversary-edition): comparison of contextual controls, free look and handedness.
- [Three.js: InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): shared geometry/materials reduce draw calls; dynamic instance buffers must be updated explicitly. Changes use APIs supported by this project's installed Three.js r164.
- [Graham Pentheny: Efficient Crowd Simulation for Mobile Games](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter24_Efficient_Crowd_Simulation_for_Mobile_Games.pdf): prioritised local steering and spatially restricted neighbour queries. This city retains its authored sidewalk/road graph; no full-city flow-field replacement is claimed.
- [Quaternius: Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html): the existing free CC0 motions remain the animation source. The repository's motion licence and attribution files are retained. No Rockstar code or animation data is copied.

## Player-facing changes

### Battlefield

- Operators perceive opponents through facing and line of sight. Last-seen positions, nearby gunfire and timestamped teammate reports guide searches; hidden moving targets are not tracked through walls.
- Squads distribute support, assault and flanking roles, reserve space around capture objectives and pause flanking to engage. Actual damage causes suppression; reloads, three-shot bursts and firing-lane checks govern shooting.
- Cover searches reuse results and test at most four path candidates per decision window. Failed searches continue through later candidates rather than permanently ignoring them.
- Mission stages expose the current objective, completion ratio, contested state and blocker hints. Intel and extraction require an uninterrupted safe dwell; defense checkpoints retain completed 15-second segments.
- Confirmed hits produce blood feedback. Wall, courtyard, roof and terrain hits produce surface-aligned marks. Shots reuse the physics spatial index instead of scanning every city obstacle.

### Career and City Stories

- Career delivery missions track cargo integrity from actual injury and vehicle impacts; the introductory First Shift remains forgiving.
- Combat extraction is interrupted by damage, movement or remaining opponents. Pursuit finishes require a quiet stationary hideout; flight finishes require a stable landing. Destroyed mission vehicles allow a bounded recovery opportunity.
- Mission results record grades and preserve best results without adding currency payouts. Director state is carried by validated, detached checkpoints.
- City Stories adds verification/handoff/return stages and inventory evidence, with migration for existing stage indices and durable retry checkpoints.
- Portrait HUDs separate mission information from thumb controls. Jobs, briefing, route guidance and comfort settings have distinct views. Blood traces can be disabled through settings.

### City behavior and presentation

- Nearby pedestrians keep right, resolve overlaps with capped movement and prefer less crowded connected exits. The existing collision system still checks their resulting position.
- Traffic scores legal outgoing lanes for congestion. Pursuing police query nearby vehicles and people rather than repeatedly scanning the full city. Ambulances obey lane routing and vehicle clearance and cannot drive destroyed vehicles.
- Blood droplets and merging ground traces have fixed capacities and lifetimes. Bullet marks fade and use distance budgets. Battery/offscreen effects continue aging and cannot accumulate indefinitely.
- Original skeletal animation remains in use. Limb-solving scratch values are reused; distant animation advances with the elapsed simulation time rather than silently losing phase.
- Street rendering classifies NPCs once and removes a redundant nearest-civilian sort. The simulation retains all 2,802 NPCs, 5,601 traffic vehicles and 41 police units.
- All 15 shops retain their original horizontal positions. Rooms and collisions share one terrain height; five hillside shops receive bounded instanced stairs inside their existing footprint. Walking tests cover every entrance, side-wall obstruction, low ceilings and excessive steps.

## Validation

The automated regression entry point is `node scripts/verify-tirana-overhaul.mjs`. It exercises simulation, actual transpiled engine/rig classes, pointer and HUD behavior, the focused Tirana TypeScript project and whitespace validation. It does not substitute for a real WebGL/device test.

Final focused run: **302 Node tests passed, 7 opt-in canvas cases skipped, 12 React tests passed, focused TypeScript passed, and `git diff --check` passed.** Coverage includes confirmed-hit blood, walls blocking shots, bounded effect queues, all 15 shop entrances, dealer height after both simulation paths, extraction interruption and save/reload during vehicle recovery. Two stale baseline Blackwater assertions were updated to match buildings and the unchanged weapon factory already present on `main`; the city source and weapon factory were not modified.

`cd webapp && node --max-old-space-size=3072 node_modules/vite/bin/vite.js build` passed in **4m 1s**. The emitted city bundle was checked for the final shared shop height, generated shop height and old-save dealer-height repair. Existing large-chunk and non-module external-map script warnings remain.

### Repository-wide limits

- `cd webapp && node node_modules/typescript/bin/tsc --noEmit --pretty false` reports **500 existing diagnostics**. A checkout of the exact base reports the same 500 diagnostic signatures after normalizing checkout paths and source line numbers; no new signature was introduced. The complete application type gate remains enabled in CI.
- `cd webapp && npm run verify:external-assets` fails because the local offline asset import is incomplete, including missing `public/assets/external/url-map.json` and inventory/metadata entries. A Vite compile alone does not verify the full `npm run build` prebuild/package pipeline. Its asset checks remain enabled.
- Seven existing `blackwaterOperation.test.mjs` cases require the opt-in `BLACKWATER_ENGINE_BUNDLE` canvas harness and remain skipped. The added combat-loop tests invoke the actual transpiled engine methods, but do not exercise WebGL output.
- Browser access to the local preview was unavailable in this session. The interactive preview uses the production mission director and readout and is covered by React tests; it is a mission-HUD preview, not a rendering or FPS demonstration.

### Device acceptance still required

On representative Android and iOS phones, check portrait layouts, simultaneous move/look/fire input, entry/exit/retry flows, warm-cache loading, and sustained combat in each quality setting. Capture CPU and GPU frame times, draw calls, triangles and memory after warmup, including the slowest frames during pursuits and effects. No guaranteed 60 FPS, GTA-level visual fidelity or GPU speedup is claimed from the CPU benchmark below.

## CPU benchmark

Run `node scripts/benchmark-tirana-runtime.mjs --scenario spawn` or `--scenario max-wanted`; supply `--source-root PATH` to compare a checkout. Each process creates the full population, warms up 120 ticks and measures 600 simulation ticks at 60 Hz. The pursuit scenario refreshes the stationary player's wanted level, health and armor while natural police dispatch runs. It does not add or teleport actors. Tests/builds were stopped during these measurements.

The raw [benchmark results](tirana-combat-career-benchmark.json) retain all 12 initial measurements and 4 follow-up measurements. These are Node CPU simulation times on this shared host, not browser frame times or GPU FPS. The initial pursuit results were mixed, prompting additional cooldown gating and dispatch-query caching.

Final follow-up after review repairs:

| Run | Revision | Mean tick (ms) | p95 (ms) | p99 (ms) | Ticks over 16.67ms / 600 |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | main | 11.32 | 15.77 | 25.78 | 26 |
| 1 | revised | 8.64 | 13.50 | 16.71 | 7 |
| 2 | main | 11.33 | 16.19 | 26.55 | 28 |
| 2 | revised | 9.94 | 16.69 | 47.71 | 31 |

Average simulation time improved in both follow-up pairs. Tail latency did not improve consistently: the revised second run has worse p95/p99 and more ticks over 16.67ms. The initial idle medians were close (median-of-run p95: 13.13ms on main versus 12.88ms revised). These results support reducing repeated AI work, but they do not establish a stable 60 FPS target or a blanket rendering speedup. All runs retain 2,802 NPCs, 5,601 traffic vehicles and 41 police units.
