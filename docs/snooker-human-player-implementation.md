# Snooker Royal — Human Player Animation + Shot Logic (Three.js)

This guide describes a production-ready plan to add a controllable (or AI-driven) 3D human player for Snooker Royal.

## Online references used

- Three.js `AnimationMixer` docs (animation state playback + blend updates): https://threejs.org/docs/pages/AnimationMixer.html
- Three.js `SkeletonUtils` docs (`retarget` / `retargetClip` for Mixamo to avatar skeleton mapping): https://threejs.org/docs/pages/module-SkeletonUtils.html
- Three.js `CCDIKSolver` docs (IK support for precise hand/cue placement): https://threejs.org/docs/pages/CCDIKSolver.html
- Ready Player Me avatar API (LOD, texture quality, morph target options for web performance): https://docs.readyplayer.me/ready-player-me/api-reference/rest-api/avatars/player-zero/get-3d-avatars
- Snooker bridge fundamentals (open bridge, stable line of cue): https://www.snookercentral.com/snooker-bridge-hand/

## Core architecture (modular)

1. **Input system**
   - Converts mouse/touch/gamepad actions into high-level actions:
     - `MOVE_PLAYER_AROUND_TABLE`
     - `AIM_DIRECTION_CHANGED`
     - `BEGIN_SHOT_ROUTINE`
     - `CANCEL_SHOT_ROUTINE`
2. **Shot-planning system**
   - Computes shot direction, cue contact point, and power.
3. **Locomotion/nav system**
   - Chooses shortest perimeter route around table.
4. **Pose/IK system**
   - Builds snooker-specific stance and bridge/grip hands.
5. **Animation system**
   - Blends locomotion clips with procedural upper-body shot pose.
6. **Gameplay state machine**
   - `idle -> walk_to_shot -> align_stance -> feather -> strike -> recover -> idle`.

## Body mechanics targets for pose logic

Use these defaults (tune per avatar proportions):

- Feet: shoulder-width with rear foot offset to stabilize line of aim.
- Hips/chest: forward hinge (athletic lean), no excessive twist.
- Bridge (front) hand:
  - Open bridge shape (index/thumb “V” channel).
  - Wrist neutral, hand planted on table.
- Grip (rear) hand:
  - Relaxed fingers wrapping cue (not clenched).
  - Elbow acts as hinge for pendulum stroke.
- Head/eyes:
  - Head lowered toward cue line.
  - Keep look vector near cue/impact line.

## Runtime shot cycle

1. **Target generation**
   - Shot system emits `cueBallPosition`, normalized `shotDirection`, and shot metadata.
2. **Stance point solve**
   - Place player behind cue ball using:
     - back offset (0.65–0.85m)
     - lateral offset (0.15–0.25m) according to handedness.
3. **Walk route solve**
   - Build perimeter waypoints around expanded table bounds.
   - Pick shortest clockwise/counterclockwise route.
4. **Alignment stage**
   - Face cue direction.
   - Set low center of mass and stable feet placement.
5. **Feather stage**
   - Add small forearm/hand oscillation before strike.
6. **Strike stage**
   - Fire cue impulse event into existing ball physics.
7. **Recover stage**
   - Return to neutral stance and await next turn.

## Implementation in this repository

A reusable controller is implemented here:

- `webapp/src/pages/Games/snookerHumanController.js`

It provides:

- `loadSnookerHuman(...)`
- `createSnookerHumanController(...)`
- finite state machine constants in `HUMAN_FSM`

## Integration checklist for `SnookerRoyal.jsx`

1. Create refs for cue ball and pending shot:

```js
const cueBallRef = useRef(null);
const shotRef = useRef({
  pendingHumanShot: false,
  direction: new THREE.Vector3(0, 0, -1),
  executeHumanShot: null
});
```

2. Build table bounds and controller:

```js
const controller = createSnookerHumanController({
  scene,
  tableBounds: new THREE.Box3(
    new THREE.Vector3(-tableHalfW, 0, -tableHalfL),
    new THREE.Vector3(tableHalfW, 0, tableHalfL)
  ),
  cueBallRef,
  shotRef
});
await controller.init();
```

3. In your animation loop:

```js
const dt = clock.getDelta();
controller.update(dt);
```

4. At shot-confirm action:

```js
shotRef.current.direction.copy(aimDirectionNormalized);
shotRef.current.pendingHumanShot = true;
shotRef.current.executeHumanShot = () => {
  // call your current cue impulse / spin / power pipeline
};
```

5. On cleanup:

```js
controller.dispose();
```

## Performance notes

- Keep one `AnimationMixer` per avatar.
- Use Ready Player Me URL params (`quality`, `meshLod`, texture options) for mobile/web optimization.
- Update IK only during shot states if needed for extra CPU savings.
- Reuse vector objects in hot paths (avoid per-frame allocation spikes).

## Next production step (recommended)

Replace placeholder walk/idle clip lookup with explicit clips (Mixamo or authored), then retarget to the avatar skeleton via `SkeletonUtils.retargetClip(...)` before runtime playback.
