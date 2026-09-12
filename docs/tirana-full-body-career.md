# Tirana Streets: full-body Street Career

Implementation for the uploaded `Tirana-Streets-Career-Prompt-SQ.txt`, dated 12 September 2026. This is an integrated local-career change in React 18, Three.js 0.164 and TypeScript, with headless `.mjs` simulation contracts. It is a draft for gameplay review, not a claim of AAA animation quality or completed phone certification.

## Base and integration

The initial audit and implementation started at main `b0623c4bdd3662a127424b3687b8fd4f34f1dead`. Main advanced during implementation; the branch was rebased onto `247f7ea11707c92223e7a5c273f707e533f9280c` (PR #25857). Its urban expansion, Blender cabin, canonical driver sockets, emergency response and rendering improvements are retained.

Branch: `codex/tirana-full-body-career`. Target: `main`. No merge or deployment is authorized by this work.

The existing application route is `/games/tiranastreets?mode=ai&activity=street-career`. Lobby → Tirana Streets → **STREET CAREER · DRIVE + COMBAT** reaches `blackwater/ui.tsx` → `StreetCareerGame` → `StreetCareerRuntime` → `StreetRenderer`. The existing online guard still takes priority. There is no separate demo or model gallery. CITY STORIES, Explore, Operation, multiplayer, Racing Royal, payments and account balances keep their existing entry points and contracts.

## Changed responsibilities

| Files under `webapp/src/games/tiranastreets/` | Responsibility |
| --- | --- |
| `street-career/StreetInput.ts`, `StreetCareerGame.tsx`, `street-career.css`, `settings.ts` | Independent pointer ownership; movement plus fire-drag; contextual controls; portrait layout and settings |
| `street-career/playerCore.mjs`, `spatialCore.mjs` and declarations | Physical player motor; 3D obstacle queries; step-up, jump, crouch and vault clearance |
| `street-career/StreetSimulation.mjs` and declaration | Layered actions, 3D weapons, melee, interaction validation, mission events and adapter to the existing city engine |
| `street-career/FirstPersonBody.ts`, `weaponPose.mjs` and declaration | Existing full-body skeleton, head masking, private animation clips, limb IK, held models and shared muzzle coordinates |
| `street-career/vehicleCore.mjs` and declaration | One-driver transfer, driver/cabin anchors and safe exits |
| `street-career/checkpointCore.mjs`, `campaignCore.mjs` and declarations | Versioned phase checkpoints inside the existing profile and storage key |
| `street-career/StreetCareerRuntime.ts`, `StreetRenderer.ts`, `SharedHumans.ts`, `StreetArsenal.tsx` | Active-loop integration, local presentation, feedback, retry and save handling |
| `shared/engine.mjs`, `shared/cityLife.mjs`, `shared/engine.d.mts`, `cityBaseRenderer.ts`, `livingVisuals.ts`, `audio.ts` | Optional extension points; old callers retain defaults; height-aware effects and bounded audio |
| `test/tiranaFullBody*.test.mjs`, `test/tiranaStreetCareer.test.mjs`, `.github/workflows/tirana-street-career.yml` | Simulation, actual-rig, input and existing-route regression checks |

### Player, actions and controls

The player collider and eye height change together. Jump uses vertical velocity, gravity, grounded checks, a 90 ms coyote window and 120 ms input buffer. Crouch checks headroom before standing. Movement accelerates/brakes, uses analog magnitude, normalizes diagonals and follows view yaw. Sprint and heavy melee consume stamina. Pause, damage, death and vehicle transitions clear appropriate actions and held inputs.

`StreetWorld` indexes the existing collision footprints, elevated canopy geometry and detail posts in spatial cells. Weapon rays account for polygon holes and height; cars use oriented bounds. Walking uses swept substeps, sliding and 0.28 m step-up. Vault has a validated raised path and landing. The original river/lake/world-boundary rules remain in use. This retains the city's existing elevation representation; it does not introduce a new terrain mesh or general terrain physics.

The typed action descriptors include `id`, `label`, `visible`, `enabled`, `disabledReason`, `targetId`, `priority` and `mode`. Both HUD presentation and execution use the simulation rules; target identity, range, visibility, inventory and transitions are rechecked at execution.

Touch layout keeps movement at bottom-left and stable action slots on the right, with safe-area padding and 48–64 px configurable targets. A right-hand fire pointer can also adjust look while the left pointer moves. Aim is a toggle; firing/melee remains available without a target. Vehicle controls replace on-foot controls. Capture loss, pointer cancellation, blur, page visibility and pause release inputs. Menus remain scrollable.

Desktop retains WASD/arrows, mouse, F/E/R/H/Shift/Q/Escape and adds Space jump, C crouch, V kick, B guard and Z aim. FOV, sensitivity, head-bob, camera shake, touch size/opacity, volume and optional light aim assist have local settings.

### Body and animation audit

The actual bundled `living/human.glb` has the Mixamo skeleton and Idle, Walk, Run and TPose clips. Its forward-facing convention was measured from bones; the local body uses the matching orientation instead of the old renderer's additional half-turn. The same skeleton supplies arms, legs and torso. Head/neck-weighted triangles are excluded from a private mesh index, while the original geometry supplies a shadow-only pass. No skeleton is destroyed or screen-mounted decorative legs added.

Private Idle/Walk/Run clips cross-fade and scale with movement speed. Horizontal hip translation is removed from those copies so simulation remains the movement authority. Original shared clips are unchanged. Two-bone IK supplies arm/leg targets and finger articulation. Crouched feet stay above the ground; the kick extends forward; driver hands reach the existing cabin wheel and respond to steering independently of look direction.

Jump/fall/land, crouch, directional locomotion adaptation, punch/kick, hit response, equip/holster, aim/fire/reload, door reach and driving use procedural poses over the available clips. These are explicitly fallbacks, not newly captured or fully art-reviewed animation clips. There is no new cross-skeleton retargeting. Fine grip placement for every weapon, foot sliding, elbow limits at extreme aim angles and vehicle transition silhouettes still need actual-game visual review.

### Combat, cars and missions

Punches have alternating hands, recovery and one hit window; kicks have a stamina cost. Distance, arc and line of sight gate damage. Guard has directional/stamina rules. Reactions and bounded knockback use the existing damage/crime path. Civilians keep the existing flee behavior.

Weapons keep the current inventory IDs and bundled model mappings. A camera ray uses yaw and pitch, followed by a muzzle-to-target obstruction check against the same 3D world. Held-model and simulation muzzle coordinates share a contract. The gun retracts near walls. ADS, cadence, recoil, reload cancellation, flash, impacts and ammo conservation run through the simulation; loading a model cannot change damage timing. Loot has a unique identity, range/capacity checks and duplicate protection, with actual dropped weapon models.

`HYR`, `MERR MAKINËN` and `DIL` depend on a stable, valid nearby target. Entering approaches a checked door, waits for the timed transition and transfers the original vehicle object to the controllable list once. There is no duplicate traffic copy. Safe exits try both sides and require clearance at low speed. The existing driving physics remains authoritative.

The cabin and model-specific driver eyes introduced on main are reused. The cabin is an authored generic interior, not a scanned OEM cockpit for each car. Common door/exit offsets remain authored fallbacks for models without detailed door sockets. The original city-car's named doors can open; models without articulated door meshes retain the reach/seat transition and need an asset pass.

All nine mission IDs remain unchanged. Deliveries require parcel interaction; combat extraction requires its action; race and pursuit gates require an entered vehicle; the final escape marker requires wanted level to clear; Boulevard defense includes a timed hold. Proximity alone does not complete the new action gates. The first shift has small event-driven onboarding prompts. Enemy/police tracking adds last-seen/heard memory and reaction delay to the existing AI instead of a second NPC simulation.

### Saves and performance

`tirana-streets:street-career:v1` and the profile version remain unchanged. An optional **version 2 phase checkpoint** stores validated mission progress, loadout, health, position, vehicle identity, parcel/training state, defeated mission opponents and claimed-loot identities. Old profiles without a phase checkpoint retain mission-start retry. Malformed checkpoint data falls back safely. Saves happen at phase changes, periodically, on pause and on exit. Existing first-completion reward idempotence is retained.

Free roam retains the existing loadout persistence contract. Unclaimed loose drops and every ambient NPC transform are not serialized. Storage failure is displayed without disabling session play. No local result credits TPG or the online economy.

There is one RAF and one renderer. Simulation uses 1/60 s steps with 100 ms maximum catch-up; the local camera follows the authoritative body without delayed lerp, and shared scene presentation retains its smoothing. React publishes at 10 Hz. Existing NPC budgets, city LOD/instancing and effect bounds remain in use. Held models have a two-load concurrency limit, cache, abort, timeout, failure suppression and disposal. No new asset binaries, remote URLs, decoder dependencies or manifest hashes are introduced by this branch. Existing Mixamo, CC BY and CC0 credits remain applicable; these assets are not relicensed.

Audio uses the existing procedural engine, footsteps, sirens and weapon cues plus bounded door/melee/landing/block/loot feedback and volume control. A surface-specific footstep/breathing recording set is not supplied. Long-form audio and motion polish remain follow-up work.

`StreetRenderer.metrics` samples actual render intervals over 240 frames and exposes p95, draw calls, triangles, geometry and texture counts. These counters are instrumentation, not measured phone results.

## Validation and review status

The initial baseline build passed. The initial test run had 45 passes and two failures: an existing whitespace-sensitive source assertion and an unavailable local server-test dependency. The dependency was supplied outside the repository; the source test now verifies that both route branches exist and preserves their ordering without depending on spaces. Behavioral tests exercise the actual adapter in addition to source checks.

Final verification on the rebased implementation:

| Check | Result |
| --- | --- |
| `node --test test/tiranaFullBodyCareer.test.mjs test/tiranaFullBodyPresentation.test.mjs test/tiranaStreetCareer.test.mjs test/tiranaStreetCareer.integration.test.mjs test/tiranaCityLife.test.mjs test/tiranaCareerExpansion.test.mjs test/tiranaStreets.test.mjs test/tiranaRealism.test.mjs` | **123 passed, 0 failed, 0 skipped** |
| New headless gameplay tests | 23 pass: movement, jump/headroom, transitions, melee, 3D aim/obstructions, ammo/loot, ownership/exits, save/reward and actual mission gates |
| New actual-rig/input tests | 7 pass: real GLB geometry/skeleton, visible feet projection, punch/kick/crouch, private clips, two-pointer cancellation, keyboard/pause and wheel alignment while steering/looking |
| Existing career, city, legacy/online and latest-main realism regressions | 93 pass |
| `npm run build --prefix webapp` | Pass after rebase, including asset verification/manifest prebuild. Final Vite production build rerun directly after steering alignment: pass in 28.26 s. Existing bundle-size warnings remain. |
| `webapp/node_modules/.bin/tsc --noEmit -p webapp/tsconfig.json` | Fails with **188 existing diagnostics**, versus **189** on clean current main using identical dependencies; **0 new diagnostics** after normalizing file roots and line positions |
| `git diff --check` | Pass |

The typecheck comparison removes one existing `Effect.y` diagnostic because effect height is now declared. Other pre-existing errors are not suppressed or excluded; the full CI gate remains. The presentation tests load the real GLB skin, skeleton and clips, omitting texture decoding in Node. They test numeric bone positions/camera projection and input ownership, not a rendered gameplay screenshot. The mission completion/save test drives actual engine gates but relocates the player between checkpoints; it does not establish manual mission accessibility.

A Node/Linux CPU sample over 600 fixed ticks after 60 warmup ticks in the real expanded free-roam city (69 NPCs, 31 traffic vehicles, 35 cars) measured 0.589 ms median, 0.942 ms p95 and 2.245 ms maximum simulation tick; state plus 3D-grid initialization took 121.24 ms. This excludes rendering, asset decoding, networking and phone thermal behavior. A separate retained-heap sample after explicit garbage collection measured 566.7 MiB, compared with 544.7 MiB for current main plus its existing detail-post dependency. The new 46,939-solid/31,751-cell index adds memory to an already large imported city. These are single container samples, not a statistically controlled benchmark or a phone memory budget. Browser/GPU memory and session growth remain unmeasured.

A Vite dev server started locally on port 4173. The connected browser rejected both the forwarded `terminal.local` route URL and loopback route URL with `net::ERR_BLOCKED_BY_CLIENT`. Therefore no successful browser gameplay, in-chat rendered preview, console/asset inspection, portrait screenshot or video is claimed. No unrelated gallery or invented deployed URL substitutes for that evidence.

### Required visual review before merge

Use the same application/runtime at `/games/tiranastreets?mode=ai&activity=street-career` from this branch. Run `npm run dev --prefix webapp` in an environment with browser access.

At each of **360×800, 390×844 and 430×932**, perform: start first shift → walk/look down → sprint/jump/crouch → punch/kick → draw weapon → aim up/down → fire/reload → enter/take a car → steer/look/brake/exit → complete delivery → close/reopen and confirm phase/progress/reward behavior. Include movement plus fire-drag using two pointers, cancellation of either pointer, unsafe exits, blocked headroom, firing beside a wall, pause during reload/entry and menu scrolling with safe areas enabled.

Capture the hands, feet, crouch, melee, ADS/reload and vehicle entry/exit from that route. Check console errors and failed model requests. Record at least a sustained driving/combat session's p95 frame interval, draw calls and memory/texture growth, then repeat on a physical Android/iPhone. No 30/60 FPS or physical-phone stability claim is made before those checks.
