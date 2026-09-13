# Snooker Royal: Tailuge logic integration

## Scope

The live `SnookerRoyal.jsx` game now uses a modular TypeScript planner based on
Tailuge's ghost-ball construction and cut-angle scoring. Its existing Three.js
table, ball models/materials, pockets, cameras, character rigs, physics solver,
cue-stroke animation, player input, SnookerRoyalRules and career persistence are
retained. No Tailuge renderer, table or network layer is imported.

The previous embedded pool/UK AI evaluator and its colour-group conversion are
removed. Snooker targets come from the authoritative frame's `ballOn`; blue and
yellow are never treated as interchangeable. Each candidate uses the current
table's radius, cushion boundaries and target-specific pocket entrance.

The planner rejects obstructed cue and object-ball paths using swept ball
clearance, verifies first contact, rejects backwards cuts and checks a tangent
scratch estimate. It compares legal target/pocket pairs and falls back to a
bounded direct/one-cushion/two-cushion contact search. Power uses the existing
game mapping with a cut-loss allowance. Centre-ball spin avoids introducing
uncalibrated side-spin error. No live ball or frame is mutated while planning.

One cached evaluation serves a stationary layout. Changes to ball positions,
active balls, active player, ball-on, completed-frame state or table geometry
invalidate the cache. Renderer adapters return fresh Three.js vectors.

The AI scheduler checks turn ownership, disposal, frame identity, replay and
ball-in-hand before delayed shots. It supplies the captured plan power and
expected shooter to the real `fire` callback. A planner exception goes through
the normal foul/scoring engine instead of silently changing the HUD and granting
ball-in-hand. Offline AI does not replace the online opponent.

## Licence

This is a GPL-3.0-only integration. See `THIRD_PARTY_NOTICES.md`; the original MIT
licence and existing asset notices are retained. Public GPL/attribution copies
are included in the web build. Review the combined game's GPL distribution and
corresponding-source obligations before merging or publishing this change.

## Verification

- 10 focused Jest suites / 68 tests pass, including 18 planner tests and 10 AI
  scheduler tests, plus existing live strike, scope, career, physics clock,
  deciding-black, table and quality regressions.
- Strict standalone TypeScript checking of the new planner/geometry passes.
- Full `npm run build --prefix webapp` passes, including asset verification and
  versioned game-pack generation. SnookerRoyal chunk: 475.34 kB / 159.87 kB gzip.
  Existing large shared-app chunk warnings remain.
- Live game visual inspection was attempted through the local review entry;
  the browser returned `net::ERR_BLOCKED_BY_CLIENT`. No visual/mobile pass is
  claimed. The existing development entry is `/snooker-review.html`.

## Remaining limits

This does not claim a perfect or professional-level snooker opponent. Cushion
routes use geometric reflection, not a full rollout of cushion friction, throw
and spin. A fully blocked position can exhaust the bounded escape search; its
last-resort attempt is explicitly marked `verifiedContact: false`, and actual
foul scoring is still enforced. The planner does not implement multi-shot
break-building or tournament referee judgment. Physical portrait-phone play,
visual cue contact and multiplayer soak testing remain release checks.
