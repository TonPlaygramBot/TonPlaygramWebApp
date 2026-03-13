# Unity Pocket Jaw + Capture System (2D/3D)

This module adds production-oriented pocket behavior for corner jaws and capture:

- finite jaw segments (bounded, non-infinite)
- rounded jaw tips (capsule/circle endpoint behavior)
- tunable jaw restitution/friction
- separate capture resolver behind mouth
- shared logic for both 2D and 3D via adapters

## Added scripts

- `Assets/Scripts/Gameplay/Pockets/PocketGeometry.cs`
- `Assets/Scripts/Gameplay/Pockets/PocketJawDefinition.cs`
- `Assets/Scripts/Gameplay/Pockets/PocketMouth.cs`
- `Assets/Scripts/Gameplay/Pockets/PocketCaptureZone.cs`
- `Assets/Scripts/Gameplay/Pockets/PocketCollisionResolver.cs`
- `Assets/Scripts/Gameplay/Pockets/PocketCaptureResolver.cs`
- `Assets/Scripts/Gameplay/Pockets/PocketPhysicsAdapters.cs`
- `Assets/Scripts/Gameplay/Pockets/PocketPhysicsDriver2D.cs`
- `Assets/Scripts/Gameplay/Pockets/PocketPhysicsDriver3D.cs`

## Scene wiring (quick setup)

1. Create a `PocketRoot` GameObject at your target pocket.
2. Add `PocketMouth` + `PocketCaptureZone` to `PocketRoot`.
3. Create two child objects, each with `PocketJawDefinition`:
   - one for near jaw rail segment
   - one for far jaw rail segment
4. Assign these two jaw components in `PocketMouth` (`leftJaw`, `rightJaw`).
5. Add either:
   - `PocketPhysicsDriver3D` for Rigidbody/SphereCollider balls
   - `PocketPhysicsDriver2D` for Rigidbody2D/CircleCollider2D balls
6. Populate the driver ball list (`id`, body, collider).
7. Enter play mode and tune in Inspector.

## Tuning guidance

- Increase `jawRadius` if jaw tips feel too sharp.
- Lower `jawRestitution` when pockets feel pinball-like.
- Increase `jawFriction` to reduce skate/glance escapes.
- Increase `minimumCaptureDepth` to require deeper pocket entry.
- Lower `cleanCaptureSpeedThreshold` to reject more fast glancing shots.
- Tighten `rejectionAngleTolerance` (smaller angle) for harder pocket acceptance.

## Behavior notes

- Collision and capture are intentionally separate systems.
- Jaw collision is solved in table 2D footprint for stability.
- 3D mode applies additional downward velocity once committed.

## Known limitations

- This module focuses on corner-pocket mouth behavior; side-pocket geometry requires separate mouth definitions.
- Driver ball lists are manual in this version (easy to swap to auto-registration if needed).
- Deterministic fast-glance rejection is optional; if disabled it uses probabilistic rejection.
