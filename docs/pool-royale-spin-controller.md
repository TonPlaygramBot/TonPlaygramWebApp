# Pool Royale Spin Controller (Cue Ball)

This note defines the **physical** spin directions for a cue ball using a **2D tip-offset disk**.
The spin input is represented as a normalized offset `(x, y)` on the cue-ball contact circle, not
as a trajectory curve. The offset is clamped to a realistic radius (e.g. `|offset| ≤ 0.7`).

## Coordinate model (tip offset disk)

- `x`: lateral tip offset (left/right across the ball).
- `y`: vertical tip offset (up/down on the ball surface).
- `|offset| ≤ 0.7`: avoid extreme edge hits that are not physically controllable.

**Implementation note (conceptual):**
```ts
const clampRadius = 0.7;
const magnitude = Math.hypot(x, y);
if (magnitude > clampRadius) {
  const s = clampRadius / magnitude;
  x *= s;
  y *= s;
}
```

## Required spin directions (A–G)

> Each entry lists the **physical effect** and the **canonical offset vector**. Vectors are given
> as normalized examples; final magnitude should be clamped to `|offset| ≤ 0.7`.

### A) Pa spin (STUN)
- **Physical effect:** tip strikes the geometric center. The cue ball **slides** then naturally
  transitions to pure rolling with **no topspin/backspin**.
- **Offset:** `(x, y) = (0.0, 0.0)`.

### B) TOPSPIN (FOLLOW)
- **Physical effect:** hit **above center**. Produces forward rotation about a **horizontal axis**
  aligned with the shot direction. After contact, the cue ball continues **forward**.
- **Offset:** `(x, y) = (0.0, +0.7)` (any `0 < y ≤ 0.7`).

### C) BACKSPIN (DRAW)
- **Physical effect:** hit **below center**. Produces backward rotation about a **horizontal axis**
  opposite the shot direction. After contact, the cue ball **stops** then **draws back**.
- **Offset:** `(x, y) = (0.0, -0.7)` (any `-0.7 ≤ y < 0`).

### D) SIDESPIN MAJTAS (LEFT ENGLISH)
- **Physical effect:** hit **left of center**. Produces rotation about the **vertical axis**.
  Affects **rail rebound** and **object-ball throw**.
- **Offset:** `(x, y) = (-0.7, 0.0)` (any `-0.7 ≤ x < 0`).

### E) SIDESPIN DJATHTAS (RIGHT ENGLISH)
- **Physical effect:** hit **right of center**. Produces rotation about the **vertical axis** in
  the opposite direction. Affects **rail rebound** and **object-ball throw**.
- **Offset:** `(x, y) = (+0.7, 0.0)` (any `0 < x ≤ 0.7`).

### F) TOPSPIN + SIDESPIN (COMBINATION)
- **Physical effect:** hit **above center** and **left/right**. Adds forward roll **plus** lateral
  spin that changes rail rebound and cut-shot throw.
- **Offsets (examples):**
  - **Top-left:** `(x, y) = (-0.5, +0.5)`
  - **Top-right:** `(x, y) = (+0.5, +0.5)`

### G) BACKSPIN + SIDESPIN (COMBINATION)
- **Physical effect:** hit **below center** and **left/right**. Adds draw **plus** lateral spin for
  controlled sideways effect after contact and on cushions.
- **Offsets (examples):**
  - **Bottom-left:** `(x, y) = (-0.5, -0.5)`
  - **Bottom-right:** `(x, y) = (+0.5, -0.5)`

## Realism constraints

- **Clamp offset magnitude** to prevent unrealistic edge hits (`|offset| ≤ 0.7`).
- **No artificial curve** on the cue-ball path; effects come only from **impulse + torque** at the
  hit and **frictional contacts** (table, cushions, balls).
- All physics behaviors should emerge from **initial angular velocity** and **contact response**,
  not from scripted steering.
