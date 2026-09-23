# Tirana Streets unified urban upgrade

This update targets `main` at `edbd167e30dd4d9155270b5652bd6a63420cb421`.

## Play flow and compatibility

The lobby has one solo city campaign. Default, legacy career and Battlefield links enter `StreetCareerRuntime`. Six urban combat operations join the existing eleven city jobs: approach the district, fight the hostile crew, collect dropped equipment and hold extraction. Starting an operation and returning to exploration retain the current player, inventory, vehicle damage, traffic and city state. Mission clocks use their own start time.

Playable police units, their progression and panels are removed. NPC police, civilian protection behavior and wanted responses remain. The Jobs journal separates story jobs from combat operations. Portrait controls place movement, contextual actions, firing and driving pedals in distinct areas, with mirrored handedness and safe-area support.

Current city campaign saves remain on the existing versioned key. Free-roam position and vehicle are saved; rural or obstructed checkpoints safely fall back to the city. Earlier City Stories progress appears as read-only history in the journal when present. Those distinct story objectives do not grant current mission completion or rewards. Retired police saves remain untouched and unused.

Online play remains a server-authoritative operation session reached through Play with friends. It does not pretend to merge multiplayer account results with the device-local campaign economy.

## Rendering and city

Dynamic resolution uses sustained frame-time windows and slower recovery before lowering scene detail. Weather discovery is bounded and weather material changes run at 10 Hz. Shadows follow the camera and elevated roofs in light space; daylight tone is more neutral. Aircraft update before rendering. These are browser-native changes, not NVIDIA DLSS or neural rendering.

The 8.6 × 6.6 km urban cut removes Surrel, Dajti and rural excursions while retaining the central city, Tabakëve, Njësia 2, Ali Demi and existing roof access. The compact gameplay payload drops from 149,566 to 99,544 road segments and from 47,742 to 33,946 buildings. Traffic routes retain only nodes reachable both to and from the city core. Source archives remain available to the generator and are excluded from the gameplay import path. Two original procedural bronze monuments use researched anchors, with shared plinth collision geometry. See [urban world details](tirana-urban-world-update.md) and [sources](tirana-urban-upgrade-sources.md).

## Driving and people

Nine vehicle classes have separate acceleration, braking, grip, steering and speed limits. Bounded internal substeps, progressive steering, brake-before-reverse and controlled handbrake slides replace the generic driving response. Driver cameras use original cabin geometry for six vehicles and clearly documented vehicle-class cabins for the remaining five. Original vehicle bytes are unchanged. Actual GLB raycasts verify the forward view is clear of headrests, including corrected Benz and Ferrari seats. See [vehicle matrix and calibration](tirana-urban-driving-review.md).

Human skin materials retain authored geometry and normal/roughness maps while correcting color-space and nonmetallic skin response. Animation phase continuity, walk/run hysteresis, crouch blending, pause recovery and displacement-based NPC gait reduce visible sliding and abrupt changes. Traffic predicts nearby crossings and uses moving-queue headway; a physically unavoidable last-moment pedestrian incursion still follows the collision path.

## CPU sample

One paired run on Node 24.19.0 in the development environment, fresh processes, 30 warmup steps then 120 simulation steps at 1/60 s. An application build was also running; these figures are indicative and not a device benchmark.

| Measurement | Original main | Updated city |
| --- | ---: | ---: |
| Cold engine/world import | 5,087 ms | 2,894 ms |
| Initial population | 1,581 ms | 804 ms |
| Median simulation step | 11.57 ms | 4.44 ms |
| 95th percentile simulation step | 15.09 ms | 7.75 ms |
| Process RSS after sample | 858 MiB | 643 MiB |

Reproduce with `node scripts/benchmark-tirana-urban.mjs /absolute/path/to/checkout` for each checkout. This measures JavaScript simulation, not GPU render time, display frame rate, startup downloads or phone memory.

## Validation and remaining release check

Targeted tests cover original vehicle hashes and cabin geometry, class handling, pedestrian anticipation and physical impacts, human material ownership and animation, dynamic resolution and shadows, urban routes and boundaries, safe save restoration, mission transitions/extraction and rendered navigation. Focused strict TypeScript and the production Vite build are release checks for this change.

The available cloud browser returned `ERR_BLOCKED_BY_CLIENT` for the local review server. No full-game screenshot, visual sign-off or real-phone FPS measurement is claimed. Before production rollout, play the city on representative portrait phones: check cockpit views and windows, touch overlap, near/far shadows, character skin, mission completion/retry, helicopter/roof access and frame pacing during a fast drive. There is no claim of a complete photoreal reconstruction, manufacturer-exact fallback dashboards, or AAA graphics parity. This branch does not deploy or merge itself.
