# Snooker Royal: uploaded billiards engine

Snooker Royal now runs the physics from the user-supplied `billiards-master.zip`
(archive commit `b446544206c6d0d7f32e718649afbb679351e986`, tailuge/billiards).
This supersedes the narrower bot-only proposal on `codex/snooker-tailuge-logic`.

The active table loads the archive's `snooker.min.gltf` and binary from local
public assets. Straight rail sections are extended to Royal's existing table
footprint without scaling the pocket mouths or replacing ball materials. A
geometry-derived table is available while loading and if the model fails.
Snooker Royal retains its React page, layout, menus, lobby, ball materials,
cameras, cues/characters, score display, career checkpoints and replay/online
snapshot envelopes. Decorative tables remain part of the existing room scenery.
The active playing table has the imported fixed base; existing base options
continue to apply to decorative tables. Cloth and wood finish controls remain
connected to the active table materials.

## Runtime boundaries

- `TailugePhysics.ts` owns the headless upstream `Table`/`Ball` simulation.
  It runs at 480 Hz through the existing bounded 120 Hz render accumulator.
  Upstream metre-based XY/Z-up coordinates are mapped to Royal's XZ/Y-up scene;
  Royal's ball radius and table footprint determine the conversion. Full angular
  velocity, sliding/rolling friction, collision throw, cushions, knuckles and
  falling pockets come from the supplied engine. The old live motion and pocket
  capture loops have been removed.
- `TailugeSnookerRules.ts` ports upstream `controller/rules/snooker.ts` into
  Royal's serializable `FrameState`, using upstream outcome/foul analysis.
  Browser Session, Controller, account and network side effects are not imported.
  Fixes include checking first contact against pre-shot colours, nominated-colour
  fouls, the colour after the last red, blocked respots, and a deciding black.
  Existing free-ball flags/nominations can be carried by the adapter; automatic
  referee decisions about misses or free balls are not implemented by upstream.
- `TailugeTable.ts` uses the imported model, the same dimensions and pocket
  geometry as the simulation, and the existing official baulk/colour spot layout.
  The table's Blender source is available in upstream `dist/models/snooker.blend`
  at the pinned archive revision.
- The geometric bot adapter derives from upstream aiming calculations pinned at
  `e6ed0dba43e09177540f176ad7a62b1ef6f64415`. Legal target selection, blocked paths,
  bank escapes, layout caching and guarded scheduled shots are preserved from
  the bot proposal. Power is calibrated to the new metre-based physics. This is
  geometric planning, not a complete simulation search or a guarantee to pot.
- Ball meshes are presentation state. A shot captures them into the engine at
  cue contact; the engine then writes positions back. Remote and replay snapshots
  retain the existing envelope and are captured at the same boundaries. Neither
  upstream accounts nor upstream matchmaking are used.

## Verification

Run from the repository root:

```sh
npx jest --runInBand test/snookerTailugeEngine.test.js test/snookerTailugeTable.test.js test/snookerTailugePlanner.test.ts test/snookerAiLifecycle.test.js test/snookerLiveStrike.test.js test/snookerShootingScope.test.js test/snookerPhysicsClock.test.ts test/snookerRoyalQuality.test.js test/snookerCareer.test.ts test/snookerDecidingBlack.test.ts
npx tsc --noEmit --skipLibCheck --target ES2020 --moduleResolution node --strictNullChecks --noImplicitAny false webapp/src/games/snooker/TailugePhysics.ts webapp/src/games/snooker/TailugeSnookerRules.ts webapp/src/games/snooker/TailugeTable.ts
npm run build --prefix webapp
```

Upstream's TypeScript uses `noImplicitAny: false`; that setting is retained when
checking its vendored files. New tests compile the actual adapter with esbuild
and run it with Three.js. They exercise maximum-power full-rack settling, real
collision/pot events, spin, cushions, respot placement, frame scoring, 147
clearance, nominations, duplicate pots and deciding-black flow. Existing live
release tests now drive the actual Tailuge solver at cue impact.

For a visual review, run Vite in `webapp` and open `/snooker-review.html`, which
mounts the actual Snooker Royal page. Check portrait aiming/release, the GLTF
cushion/pocket alignment, cloth/finish changes, ball-in-hand, replay and a second
online client. The cloud browser could not open the local preview
(`net::ERR_BLOCKED_BY_CLIENT`), so device rendering and two-client play remain
manual review items; they are not claimed as tested.

## Licence and source

The imported engine, model, AI adaptation and integrated game are distributed
under GPLv3 requirements. Copies of the licence and provenance are in
`vendor/tailuge`, `ai`, and `/licenses/snooker-tailuge/`. The project's existing
MIT notices and separately licensed assets retain their respective notices.
Corresponding source for the combined game is this public repository; upstream
source is https://github.com/tailuge/billiards/tree/b446544206c6d0d7f32e718649afbb679351e986.
