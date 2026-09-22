# Tirana Streets mobile runtime review

Based on `main` at `1ec545d3ba04be976e9d7c6c32d2ad8d70f81bbf`.
Review branch: `codex/tirana-mobile-runtime`, prepared for a PR against `main`.
No production deployment.

The full city was doing expensive traffic and crowd work in synchronized bursts.
The revised runtime spreads that work across simulation steps, shares pooled
spatial indexes, and builds police crew membership once per step. Close actors
retain frequent updates; distant actors retain their accumulated simulation time.
The map, population targets, original models, textures and motion data are unchanged.

## Player-facing changes

- Street Career and City Stories use a pointer-owned movement stick that handles
  simultaneous movement, looking and actions without rerendering the HUD on every
  pointer move. Pointer cancellation, lost capture, pause, hidden tabs and blur
  release movement. Up remains forward and right remains right. Sprint touches
  no longer start joystick movement in Street Career or Operation.
- Saved controls add aim sensitivity, a radial joystick dead zone, left-handed
  layout, control opacity, camera shake, reset-to-defaults and an optional
  performance overlay. Existing saves receive validated defaults. City Stories
  now applies its look sensitivity and has working automatic graphics selection.
- Imported walking/running clips accept common name aliases, keep stride phase
  across blends and use separate run entry/exit thresholds to prevent flicker.
  Crowd roots and headings interpolate, and gait speed follows actual movement
  after collision resolution so blocked pedestrians stop walking in place.
  Offscreen skeletons skip expensive posing while remaining in the scene.
- Frightened pedestrians remember a recently seen threat briefly and reach each
  sidewalk corner before continuing through connected escape paths. Police patrol
  movement and traffic still obey
  nearby collision/yielding rules; active police responses retain full-rate updates.
- All three runtimes bound the framebuffer to two million pixels and render
  paused menus at 15 FPS. Paused/hidden frames do not lower automatic quality.
  A 390 × 844 phone at the High profile still uses its existing 1.8 pixel ratio;
  large desktop screens use lower framebuffer resolution to respect the budget.
  Original texture quality, meshes and map coverage are retained.
- Street Career filters distant traffic once before the fleet renderers. The
  authoritative simulation keeps the entire population. Map controls and city
  guides load when opened, with a retry action on failure; essential shared city
  data remains part of gameplay loading.

Animation continues to use Three.js (MIT), existing native clips and the shipped
CC0 Quaternius Universal Animation Library motion samples. See
[`HUMANOID-MOTIONS-LICENSE.md`](../webapp/src/games/tiranastreets/street-career/data/HUMANOID-MOTIONS-LICENSE.md).
Character geometry and textures retain their existing, separate licenses.

## Measured simulation performance

Three alternating fresh processes per revision, Node v24.19.0, stationary player
at the free-roam spawn, 120 warmup steps followed by 600 measured steps at 60 Hz.
Every run retained 2,802 NPCs, 5,601 traffic vehicles and 41 police units.
Values below are medians of the three per-run statistics from the initial runtime
revision `63db9ff`, before the follow-up sidewalk and blocked-gait fixes.

| CPU time per simulation step | Main | Revised |
| --- | ---: | ---: |
| Mean | 12.94 ms | 7.73 ms |
| Median | 6.41 ms | 7.43 ms |
| p95 | 49.23 ms | 10.87 ms |
| p99 | 69.32 ms | 12.38 ms |
| Maximum | 189.92 ms | 15.98 ms |

The mean fell about 40% and p95 about 78%. The median rises because work is now
spread across frames instead of accumulating in occasional very expensive frames.
Measured steps over 16.67 ms fell from 78–85 of 600 to 0–2 of 600.
This measures simulation CPU time on this executor. It excludes rendering, GPU
time, input latency, asset loading and phone thermal behavior. It does not establish
a device frame rate. The 60 FPS frame budget is 16.67 ms for **all** frame work.
Two additional runs after the follow-up fixes measured p95 of 17.76 and 11.18 ms
(maximum 116.56 and 15.54 ms), showing that occasional CPU stalls remain possible.
Both results are retained in `postReviewRuns` in the raw data.

Raw runs: [`tirana-mobile-runtime-benchmark.json`](tirana-mobile-runtime-benchmark.json).
Reproduce against two source checkouts with:

```sh
node scripts/benchmark-tirana-runtime.mjs --source-root /path/to/main
node scripts/benchmark-tirana-runtime.mjs --source-root /path/to/revised
```

## Verification

- 146 Node tests passed across the simulation, animation, combat, controls,
  infrastructure, city life, patrol/custody, full-body career, gameplay, campaign
  integration and map suites. These include six actual shipped character rigs,
  clip-phase continuity, scheduling/time conservation, traffic yielding,
  close/distant NPC behavior, blocked/sliding movement, sidewalk corner routing,
  mission settlement, vehicles, aircraft and map routes.
- Five React/input tests passed for simultaneous move/look/fire ownership,
  secondary-finger/sprint isolation, cancellation and pause cleanup, settings
  migration and framebuffer limits.
- Focused Tirana TypeScript check passed. `git diff --check` passed.
- Vite production compilation passed with existing large-chunk warnings. The map
  UI is split from the shared city-data chunk; the latter is still approximately
  10.65 MB uncompressed and 7.41 MB gzip. No claim of eliminating that required
  city-data download is made.
- Asset preparation verified 26 original Tirana assets and 11 registered vehicle
  GLBs. No tracked map, texture, model or animation-data files changed.
- The whole-application strict TypeScript check reports 500 diagnostics. The same
  diagnostic signatures were reproduced against the exact unchanged base with
  the same installed dependencies. No new diagnostic signatures were introduced.
- Full `npm run build --prefix webapp --ignore-scripts` compilation succeeded,
  but its subsequent complete-application download generation failed because
  `assets/external/url-map.json` is absent. The whole-app external importer requests
  several gigabytes for unrelated games; complete offline-package validation
  therefore remains open. No build gate was disabled or declared green.
- An earlier broader run also found 18 failures in the existing Racing Royal
  repair-driving suite (track counts, AI finishes and legacy hashes). That suite
  and its kart implementation are unchanged by this branch. They are not included
  in the 151 passing focused checks above.

Commands for the passing focused checks:

```sh
node --test test/tiranaHumanAnimation.test.mjs test/tiranaControls.test.mjs test/tiranaMobileCombat.test.mjs test/tiranaMobileRuntime.test.mjs test/tiranaNpcMotion.test.mjs test/tiranaCityInfrastructure.test.mjs test/tiranaCityLife.test.mjs test/tiranaPatrolCustody.test.mjs
node --test test/tiranaFullBodyCareer.test.mjs test/tiranaGameplayOverhaul.test.mjs test/tiranaStreetCareer.integration.test.mjs test/tiranaMap.test.mjs
npm run test:navigation --prefix webapp -- src/games/tiranastreets/MovementStick.navigation.test.jsx --maxWorkers=1 --minWorkers=1
webapp/node_modules/.bin/tsc -p webapp/tsconfig.tirana-gameplay.json --pretty false
cd webapp
node --max-old-space-size=3072 node_modules/vite/bin/vite.js build
```

The existing Tirana workflow now includes the new simulation and mobile-input
checks so future changes exercise these regressions.

## Remaining gameplay validation

The authenticated browser could not reach this executor's local preview server.
No physical-phone, WebGL image, GPU, touch-latency or thermal results are claimed.
Visual quality and realistic-looking animation remain review gates; automated
bone/clip checks cannot certify their appearance.

Run the existing app dev server from this branch and open its real gameplay entry:

| Mode | Entry |
| --- | --- |
| Street Career | `/tirana-gameplay-review.html?activity=street-career` |
| City Stories | `/tirana-gameplay-review.html?activity=career` |
| Operation | `/tirana-gameplay-review.html` |

On a midrange Android phone and an iPhone, review 360–430 px portrait layouts,
landscape rotation and safe areas. Exercise simultaneous moving/looking/firing,
sprint, menus, map opening/closing, vehicle entry/exit, aircraft, background/resume
and both control layouts. Inspect walk/run transitions, feet on sloped terrain,
held weapons and newly revealed NPCs after turning the camera. Measure crowded
junctions, pursuits and combat after warmup and during a sustained session using
both Automatic and High graphics. Repeat the profile → repair → regression-test
loop for any observed stalls or visual faults before merging the PR.
