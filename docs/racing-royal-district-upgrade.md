# Racing Royal — Tirana district racing

Prepared from `main` at `46e8fa1a0e737dc32f27453a53967d1d8fed7c54` on 13 September 2026.

The short street loops left little passing space, the suspension was only cosmetic,
and boost did not emit smoke. This change extends the six existing map selections,
widens their event surfaces, adds physical road humps, improves rival decisions,
and swaps the portrait brake and drift buttons.

## Courses

Every extension follows connected edges of the checked-in Tirana street graph.
Skënderbej, Blloku, Lana, the Pyramid and Nënë Tereza remain the district anchors.
The city coordinates, building footprints, original source routes, six track IDs,
career cup IDs and reward rules are retained. These are authored closed race
courses and event obstacles, not current road itineraries or surveyed speed humps.

| Circuit | Previous lap | New lap | Previous / new mean sampled width | Humps |
| --- | ---: | ---: | ---: | ---: |
| Skënderbej | 1.87 km | 3.13 km | 12.5 / 15.3 m | 8 |
| Blloku | 1.06 km | 2.06 km | 10.4 / 13.9 m | 6 |
| Lana | 1.44 km | 2.61 km | 12.3 / 13.6 m | 6 |
| Pyramid | 0.98 km | 1.63 km | 12.5 / 15.3 m | 4 |
| Nënë Tereza | 0.87 km | 1.48 km | 10.8 / 12.5 m | 4 |
| Lana–Pyramid Grand | 1.99 km | 3.50 km | 13.0 / 13.4 m | 8 |

Widths taper at existing buildings; the narrowest remaining section is about
6.65 m. Tests check the sampled road plus the tyre barrier envelope against
building clearance. Arc-length tyre spacing removes bunching at densely sampled
corners, and tyres sit on the road surface. Shared instance batches in 64 m cells
allow the camera to cull distant barriers. This is a rendering design change,
not a measured phone FPS claim.

The offline generator starts and ends detours at actual junctions, filters narrow
or obstructed candidate streets, and keeps the course near its district landmark:

```sh
node scripts/build-racing-district-routes.mjs
```

## Driving, rivals and feedback

- Four tyre contact samples drive damped height, pitch and roll springs on the
  shared simulation clock. The heavier Dajti Cross and Aegis have softer spring
  settings. Fast hump crossings briefly unload grip and lose some momentum.
  Recovery clears stored spring energy without awarding lap progress.
- The hump mesh uses the same height function as physics. Each course has
  striped humps away from the grid, boost pads and tight braking approaches.
- Rivals choose passing lanes, respond to nearby slower racers, use boost more
  readily, and anticipate humps. Pro rivals drift on suitable open bends;
  tighter corners use grip steering. Decisions use one shared pre-step frame.
- Off-axis collisions impart bounded yaw motion while preserving the existing
  normal-velocity impulse, glancing friction, damage cap and recoverability.
  Fragments remain at the impact location instead of following the vehicle.
- A fixed 192-particle pool emits exhaust during actual boost and tyre smoke
  during drifting or hard braking. Finished or disconnected racers stop emitting.
- Portrait screen order is **steering → BRAKE → DRIFT → GAS**, with BOOST above
  the pedals. Independent pointer ownership and the existing slide-up gestures
  are retained. Reduced motion suppresses suspension presentation.

## Verification

**84 checks passed, zero failures or skips.** These exercise mapped connectivity,
building clearance, ordered gates, recovery, manual gas/brake/reverse, pointer
cleanup, drift rewards, collision energy, suspension, deterministic state replay,
actual Three.js geometry, smoke emission, and exported kart/driver compatibility.

```sh
node --test test/racingRoadFeel.test.mjs test/racingPaceUpgrade.test.mjs test/racingKartDynamics.test.mjs test/racingManualDrive.test.mjs test/racing-precision.test.mjs test/racingTouchControls.test.mjs test/racingCityUpgrade.test.mjs test/racingKartRemake.test.mjs test/racingRoyalTirana.test.mjs
node tools/verify-racing-districts.mjs docs/validation/racing-districts/races.json
cd webapp
npx vite build --config vite.kart.config.js
```

The simulation matrix completed **18 six-kart races: 108/108 finishes**, each
through all thirteen ordered gates. Pro mean finish times are faster than Street,
and Street faster than Rookie on every circuit. These are deterministic headless
race results, not human playtesting or GPU measurements. The full results and
test output are in `docs/validation/racing-districts/`.

The standalone production racing build passes. It retains the existing large
city bundle warning. `tsc -p tsconfig.kart.json` still reports ten TS7016 missing
declaration errors in unchanged imported city/social modules; it reports none
in the changed racing modules. Full-app, live multiplayer and physical-phone
testing were not performed. The cloud browser rejected both local preview
addresses with `ERR_BLOCKED_BY_CLIENT`, so visual gameplay QA remains pending.

The in-chat React/Three.js preview contains Blloku and Pyramid, six racers,
Street/Pro difficulty, three existing kart models, the production controls,
shared simulation, suspension, humps, barriers and smoke. City scenery is
simplified for the inline size budget; the production game uses its existing
complete city assembly. Preview controls use the same screen steering directions.

```sh
node tools/previews/build-racing-manual-preview.mjs /workspace/racing-royal-tirana.html
```

## Release

Review and deploy the frontend and authoritative server from the same revision:
they share changed course geometry and driving rules. Merge and deployment are
separate from this review branch. Existing running matches must finish before
switching server revisions. No account, staking or settlement logic is modified.
