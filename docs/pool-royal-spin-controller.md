# Pool Royal cue-ball spin controller (physics-based spec)

## Coordinate system + constraints

- Spin is defined by a **2D offset** on the cue-ball contact disk (cue tip contact point), not by curving the flight path.
- Offsets are **normalized** to a unit circle and then clamped to a **max radius** to prevent extreme edge hits.
- Recommended limit: `|offset| ≤ 0.7` (use a circular clamp, not a square clamp).
- Coordinate convention for the controller (screen-space):
  - `+x` = **right** on the player’s screen.
  - `+y` = **up** on the player’s screen.
- Physical meaning:
  - **x** drives **side spin** (spin around the vertical axis).
  - **y** drives **top/back spin** (spin around the horizontal axis along the shot line).

## Spin directions (A–G)

All vectors below are **examples** within the allowed circle. Use the same directions with any magnitude up to the max radius (`≤ 0.7`).

### A) Pa spin (STUN)
- **Offset (x, y):** `(0.0, 0.0)`
- **Physical effect:** Cue tip hits the **center of mass**, generating almost no torque. The cue ball initially **slides**, then transitions to **natural roll** due to table friction. After object-ball impact, it typically **stops near the contact line** (classic stun).

### B) TOPSPIN (FOLLOW)
- **Offset (x, y):** `(0.0, +0.6)`
- **Physical effect:** Contact point is **above center**, creating **forward (top) spin** around the horizontal axis. The cue ball transitions to roll **faster**, and after object-ball impact it **continues forward** (follow) because forward angular momentum adds to translational motion.

### C) BACKSPIN (DRAW)
- **Offset (x, y):** `(0.0, -0.6)`
- **Physical effect:** Contact point is **below center**, creating **reverse (back) spin** around the horizontal axis. The ball initially **slides while spinning backward**; after object-ball impact, remaining backspin causes the cue ball to **stop and pull back** (draw).

### D) SIDESPIN MAJTAS (LEFT ENGLISH)
- **Offset (x, y):** `(-0.6, 0.0)`
- **Physical effect:** Contact point is **left of center**, producing **left side spin** around the vertical axis. Primary influence is on **cushion rebound** (changes rebound angle) and **throw** on cut shots. The cue ball should **not curve in free travel**; effects emerge at **contact** (rails/balls).

### E) SIDESPIN DJATHTAS (RIGHT ENGLISH)
- **Offset (x, y):** `(+0.6, 0.0)`
- **Physical effect:** Contact point is **right of center**, producing **right side spin** around the vertical axis. Mirrors left english: **cushion rebound** changes and **throw** on collisions, without any artificial path curvature during straight travel.

### F) TOPSPIN + SIDESPIN (COMBINATION)
- **Offset (x, y):** `(+0.5, +0.5)` or `(-0.5, +0.5)`
- **Physical effect:** Diagonal contact creates **forward spin + side spin**. The cue ball **follows forward** after impact while also carrying **side spin** into rail rebounds and cut-shot throw.

### G) BACKSPIN + SIDESPIN (COMBINATION)
- **Offset (x, y):** `(+0.5, -0.5)` or `(-0.5, -0.5)`
- **Physical effect:** Diagonal contact creates **backspin + side spin**. The cue ball **draws back** after impact, but still carries **side spin** that influences cushions and off-center collisions.

## Realism constraints (must respect)

- **No artificial curve** in mid-flight: the cue ball’s path is linear until collisions; spin effects arise from **impulse + torque at hit**, then **friction/contacts** with table, balls, and rails.
- **Clamp extreme offsets** (e.g., `|offset| ≤ 0.7`) to prevent unrealistic edge hits.
- Spin should decay over time via friction; **rolling transition** should emerge naturally.

## Minimal controller logic (conceptual)

1. Read input offset `(x, y)` from the spin disk.
2. Normalize and clamp to max radius `rMax` (suggested `0.7`).
3. Convert offset to cue-tip torque at strike and apply to cue ball’s angular velocity.
4. Let physics resolve subsequent effects through **friction + collision response** only.

This spec defines the **full set of spin directions** and their **physical meaning** in a realistic pool model, while keeping the controller strictly offset-based.
