# Bowling Game Realism Upgrade Plan

## Scope delivered in this patch
This repository currently does not contain a dedicated bowling runtime module, lane scene, or bowling asset pipeline entry points (no `bowling` scene/system files found under `src/`, `frontend/src/`, or Unity content folders). This patch adds a production-ready implementation blueprint so engineering can wire these upgrades with minimal risk once the bowling scene path is confirmed.

## 1) Replace pin meshes with realistic open-source glTF

### Recommended sources (license-first shortlist)
- Sketchfab: **"Bowling Pin"** by `nyu_grad_alley_2020` (CC Attribution, glTF downloadable).  
  URL: https://sketchfab.com/3d-models/bowling-pin-7b4f3c1ca2f1451ebe3cf7ea984f69fc
- CG3D public-domain catalog (CC0 / Public Domain index for GLB/GLTF scanning).  
  URL: https://cg3d.org/

### Acceptance criteria
- Pin silhouette matches regulation ten-pin proportions.
- Physically-based materials (clearcoat-like varnish, correct white albedo, red neck stripes).
- Pivot at base center and collision hull aligned.
- 3 LODs (`LOD0`, `LOD1`, `LOD2`) with shared UV + material instance.

### Integration checklist
1. Import candidate glTF to `/assets/bowling/models/pins/`.
2. Normalize scale to meters (pin height ~0.381m).
3. Bake/author convex collider fallback mesh.
4. Run pin rack spawn test with 10-pin template.
5. Enable instancing for pin renderer batch.

## 2) Rebuild pinsetter + ball return mechanism (realistic behavior)

### Real-mechanism references reviewed
- HowStuffWorks pinsetter breakdown (pit, sweep, elevator/distributor, ball return flow).  
  URL: https://entertainment.howstuffworks.com/pinsetter.htm
- Brunswick GS pinsetter manual (service dimensions/sensor behavior).  
  URL: https://brunswickbowling.com/uploads/document-library/Service-Manuals/Pinsetters/GS/47-902728-complete.pdf
- Brunswick A/A2 manual references for **shared return preference system** (jam prevention across paired lanes).  
  URL: https://brunswickbowling.nyc3.cdn.digitaloceanspaces.com/production/document-library/Service-Manuals/Pinsetters/A2/BB_Service_Manuals_Brunswick-Automatic-Pinsetter-Service-Manual-R7-1962.pdf

### Proposed modular systems
- `PinDeckClearSystem`: sweep bar timing + deadwood clearance.
- `PinElevatorSystem`: pit intake -> elevator -> distributor buckets.
- `PinRespotSystem`: table lowers pins for next frame.
- `BallLiftSystem`: pit ball capture, lift, acceleration.
- `BallReturnQueueSystem`: lane-pair arbitration; hold secondary balls until return channel free.
- `JamRecoverySystem`: timeout + retry + manual reset event.

### Core state machine
`IDLE` -> `BALL_IMPACT_WAIT` -> `SWEEP_CLEAR` -> `PIN_SORT` -> `RESPOT` -> `BALL_RETURN` -> `READY`

### Ball storage/return logic
- Maintain queue `pendingBalls[]` per lane pair.
- Single active transfer into trunk return channel.
- Use occupancy sensors (`entry`, `mid`, `exit`) to release next ball.
- Safety timeout fallback if occupancy stuck > configured threshold.

## 3) Add table + chair + user sit flow (Murlan Royal-like behavior)

### Gameplay target
After user finishes a shot:
1. Avatar exits foul-line zone.
2. Walks to assigned seat anchor.
3. Plays sit animation.
4. Waits in seated idle until next turn.

### Scene objects to add
- `BowlingLoungeTable` (default table variant requested by design).
- `BowlingLoungeChair_A/B` glTF prefabs.
- `SeatAnchor` transforms (one per player seat).
- `NavBlockers` to avoid lane crossing.

### Logic contract
- `OnShotEnd` event triggers `SeatTransitionRequested(playerId)`.
- Character controller pathfinds to `SeatAnchor[playerId]`.
- On arrival (`distance < sitThreshold`), lock locomotion and blend to `Sit` animation.
- On turn start, blend `StandUp` -> locomotion enabled.

### Alignment requirement
Seat transform values should be copied from the Murlan Royal reference scene once its exact file path is provided in this repository.

## Engineering next step required
Please provide the bowling scene path (or asset bundle path) and the Murlan Royal scene file location in this repo so this spec can be applied directly in code/prefab files in the next patch.
