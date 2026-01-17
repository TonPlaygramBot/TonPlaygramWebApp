# Pool Royal cue shot animation + replay trigger

This document defines the **cue-stick animation logic** and **camera lock** that must run for **every shot** (player or AI) and must also **play at the start of the Replay**. The goal is to keep **one source of truth** for both animation and physics: **power → pull distance → impulse**.

## Scope & goals

- **Always play** cue-stick animation for player and AI shots.
- **Replay must start** with the same cue animation that produced the shot.
- **Single source of truth** for impulse and animation distance.
- **Camera locked** during the critical strike window (no orbit/pan/zoom changes).
- **Modular**: input, cue animation, physics, camera, and replay each live in separate systems.

---

## State machine (cue stick)

### States

1. **IDLE**
   - Aiming state; cue stick at rest.
   - Stick aligned to **aim direction**.
   - No motion except idle stabilization.

2. **CHARGING**
   - Stick moves **backward along its local length axis**.
   - Pull distance follows **live slider input** (or AI power selection) with smoothing.

3. **RELEASE**
   - Stick accelerates forward **faster than CHARGING**.
   - **Power is frozen** on entry so animation and impulse match.

4. **STRIKE**
   - Happens the frame the **cue tip** reaches contact distance.
   - Apply **impulse J** to cue ball (derived from the same pull distance).

5. **FOLLOW_THROUGH**
   - Stick continues forward **10–25% of pull distance**.
   - Then stops.

6. **RECOVER**
   - Stick returns to rest position at moderate speed.

### Transitions

- `IDLE → CHARGING` when player starts slider drag or AI begins power selection.
- `CHARGING → RELEASE` when player releases slider / presses shoot, or AI commits shot.
- `RELEASE → STRIKE` when cue tip reaches **contact distance** to cue ball.
- `STRIKE → FOLLOW_THROUGH` immediately after impulse is applied.
- `FOLLOW_THROUGH → RECOVER` after forward follow-through distance completed.
- `RECOVER → IDLE` when rest position reached.

---

## Power → pull distance → impulse (single source of truth)

### Core mapping

- **Normalize power**
  - `powerNormalized = clamp(sliderValue, 0..1)`

- **Non-linear curve** (natural feel)
  - `curve(p) = p^gamma`, where `gamma ∈ [1.5, 2.2]`

- **Pull distance**
  - `pullDistance = lerp(minPull, maxPull, curve(powerNormalized))`

- **Impulse** (derived from pull distance)
  - `J = mapPullDistanceToImpulse(pullDistance)`
  - Must be **monotonic** and **capped**.
  - **No independent scales** for animation vs physics.

### Example mapping (conceptual)

- `pullT = (pullDistance - minPull) / (maxPull - minPull)`
- `J = lerp(Jmin, Jmax, pullT^impulseGamma)`
  - `impulseGamma` can be `1.0–1.4` to keep high-end control.

---

## Timing rules (realistic cadence)

- **CHARGING**: smooth backward motion following power updates in real time.
- **RELEASE**: fast forward motion; do not allow power changes.
- **STRIKE**: occurs at cue tip distance threshold (very small, e.g., mm-level).
- **FOLLOW_THROUGH**: add 10–25% of pull distance forward.
- **RECOVER**: moderate return to rest.

---

## Orientation & spatial constraints

- Cue stick always oriented to **aim direction**.
- Movement **only along local length axis**; no sideways drift.
- Contact uses **cue tip** position; never use mesh center.

---

## Camera lock rules

- On **RELEASE start**:
  - Capture camera position + rotation (store).
  - **Lock input** (no orbit/pan/zoom) until strike window ends.
- Lock must persist **through STRIKE + buffer** (`0.15–0.30s`).
- Optional: **micro-shake** at STRIKE, but keep framing unchanged.

---

## Triggering the shot (player & AI)

- **Player shot**: begins when slider released or shoot button pressed.
- **AI shot**: begins when AI selects power and commits shot.
- **CHARGING**: power changes allowed (live follow).
- **RELEASE**: freeze power; animation/impulse must match exactly.

---

## Replay integration (mandatory)

### Capture

When a shot is committed, store a **ShotRecord** with:

- `timeStamp`
- `aimDirection`
- `powerNormalized`
- `pullDistance` (or recompute from power using same curve)
- `cueStickRestTransform`
- `cameraTransformAtRelease`
- `timings` (releaseSpeed, followThroughRatio, recoverSpeed)

### Playback at Replay start

1. **Reset** cue stick and camera to `ShotRecord` start state.
2. **Run state machine** from `CHARGING → RELEASE → STRIKE → FOLLOW_THROUGH → RECOVER` using recorded power.
3. **Apply impulse** at STRIKE exactly once.
4. **Camera lock** during the strike window (same as live shot).

> Result: Replay begins with the same visually consistent cue animation and physics impulse.

---

## Minimal system ownership (modular architecture)

- **Input System**: player power slider + shoot trigger.
- **AI System**: power selection + shoot trigger.
- **Cue Stick System**: state machine + animation offsets.
- **Physics System**: impulse application using pull distance.
- **Camera System**: lock/unlock + micro-shake.
- **Replay System**: shot recording + deterministic playback.

---

## Recommended update order (game loop)

1. **Input / AI**
2. **State machine update** (charging/release/strike transitions)
3. **Physics** (apply impulse at STRIKE)
4. **Animation** (stick transform update)
5. **Camera** (lock/shake)
6. **Render**

This preserves deterministic timing and prevents visual/physics drift.
