# Pool Royal — Spinning Controller Physics (Realistic)

This spec defines a physically grounded spinning controller for the cue ball. Spin is expressed as an **offset (x, y)** on the cue ball contact disk (not a curved trajectory hack). The strike produces **linear impulse + torque impulse**, and the resulting behavior emerges from **sliding friction → rolling**, plus normal collision response.

## Task 1 — Spin directions (offsets on the cue ball disk)

> Coordinate convention: offset `(x, y)` on the cue ball contact disk, where **x = left/right** and **y = top/bottom** relative to the player’s screen aim direction. Positive values are to the right / top on screen.

A) **STUN** — `(0, 0)`
- Effect: Cue ball leaves the cue with **no initial spin**. It tends to **slide**, then quickly transitions to **rolling** and typically stops near the impact point after contact with the object ball.

B) **TOPSPIN / FOLLOW** — `(0, +y)`
- Effect: Cue ball has **forward spin**. After impact and friction, it **continues forward** (follows through) more than a stun shot.

C) **BACKSPIN / DRAW** — `(0, -y)`
- Effect: Cue ball has **backspin**. It first **slides forward**, may enter **stun** when slip is near zero, then **draws back** once rolling reverses its direction.

D) **LEFT ENGLISH** — `(-x, 0)`
- Effect: Cue ball spins **left around vertical axis**, causing **sideways deflection** on cushions and subtle swerve during sliding (depending on surface friction), and it changes rebound angles off rails.

E) **RIGHT ENGLISH** — `(+x, 0)`
- Effect: Symmetric to left english; **rightward spin** alters **rail rebound** and produces lateral bias while sliding.

F) **TOPSPIN + SIDESPIN** — `(±x, +y)`
- Effect: **Forward roll with side spin**. Cue ball **follows** after impact and gets **english** on cushion rebounds.

G) **BACKSPIN + SIDESPIN** — `(±x, -y)`
- Effect: **Draw with side spin**. The ball **slides, stuns, then draws back**, and **rail rebounds** are influenced by the side component.

### Typical offsets (tuned for maxOffset = 0.70)
- **Stun**: `(0.00, 0.00)`
- **Light follow**: `(0.00, +0.25)`
- **Strong follow**: `(0.00, +0.65)`
- **Light draw**: `(0.00, -0.25)`
- **Strong draw**: `(0.00, -0.65)`
- **Light left/right**: `(-0.30, 0.00)` / `(+0.30, 0.00)`
- **Strong left/right**: `(-0.60, 0.00)` / `(+0.60, 0.00)`
- **Follow + left/right**: `(-0.35, +0.45)` / `(+0.35, +0.45)`
- **Draw + left/right**: `(-0.35, -0.45)` / `(+0.35, -0.45)`

## Task 2 — Realistic input mapping (deadzone + gamma curve)

User input gives `offsetRaw = (x, y)` in a unit disk `[-1..1]`. Map to physical offset:

- `maxOffset = 0.70`
- `deadzone = 0.10`
- `distance = sqrt(x^2 + y^2)`
- `t = clamp((distance - deadzone) / (maxOffset - deadzone), 0..1)`
- `gamma = 1.8` *(1.6–2.2 for tuning)*
- `scaledMagnitude = t^gamma`
- `offsetScaled = normalize(x, y) * (scaledMagnitude * maxOffset)`
- If `distance = 0`, then `offsetScaled = (0, 0)`

**Why this feels more realistic than linear:**
- **Near the center**, players expect **fine control** and minimal spin; the deadzone + gamma curve reduces accidental spin.
- **Farther from center**, spin ramps up **nonlinearly**, matching the tactile feel of a real cue tip moving toward the edge.
- Prevents **binary feel** where small input changes cause large spin changes.

## Task 3 — Strike (linear impulse + torque impulse only)

A cue strike must apply **linear impulse** and **torque impulse**. Do **not** add artificial backward velocity or curve hacks.

**Conceptual function:**

```ts
function strikeCueBall(d: Vec3, power: number, offsetScaled: Vec2) {
  // d is a unit vector in the table plane
  // power is mapped to linear impulse magnitude
  const J = powerToImpulse(power); // N·s

  // linear impulse
  v += d * (J / m);

  // torque impulse from cue tip offset
  const rOffset = vec3(offsetScaled.x * r, offsetScaled.y * r, 0);
  const torqueImpulse = cross(rOffset, d * J);

  const I = (2 / 5) * m * r * r; // solid sphere
  omega += torqueImpulse / I;
}
```

## Task 4 — Sliding → Rolling (critical for proper draw)

In fixed update, compute slip velocity at the contact point. **Backspin should not freeze the ball**: it must slide forward, potentially stun, then reverse.

```ts
function stepCueBall(dt: number) {
  const rc = vec3(0, -r, 0); // contact point vector
  const vRel = v + cross(omega, rc);

  if (length(vRel) > eps) {
    // SLIDING
    const F = normalize(vRel) * (-muK * m * g);
    v += (F / m) * dt;
    omega += (cross(rc, F) / I) * dt;
  } else {
    // ROLLING
    v *= 1 - kRoll * dt;
    omega *= 1 - kSpin * dt;
  }
}
```

**Reasonable starting values:**
- `muK: 0.20–0.30`
- `kRoll: 0.05–0.20`
- `kSpin: 0.02–0.10`
- `g: 9.81`
- `dt: 1/120 or 1/240`
- `eps: ~0.02 m/s`

## Task 5 — What to avoid (why draw “freezes”)

- **Applying a reverse force/velocity** for draw bypasses physical slip; it makes the cue ball **snap backward** instead of sliding → stun → draw.
- **Overdamping ω during sliding** kills the stored angular momentum, so backspin cannot “pay out” into reverse motion.
- **No slip-to-roll check (`vRel`)** removes the key transition; the simulation never knows when the ball should stop sliding and start rolling.

## Task 6 — Minimal pseudocode outputs

### computeOffsetScaled(rawX, rawY)
```ts
function computeOffsetScaled(rawX: number, rawY: number): Vec2 {
  const maxOffset = 0.70;
  const deadzone = 0.10;
  const gamma = 1.8;

  const distance = Math.hypot(rawX, rawY);
  if (distance === 0) return vec2(0, 0);

  const t = clamp((distance - deadzone) / (maxOffset - deadzone), 0, 1);
  const scaledMagnitude = Math.pow(t, gamma);
  const nx = rawX / distance;
  const ny = rawY / distance;
  return vec2(nx * scaledMagnitude * maxOffset, ny * scaledMagnitude * maxOffset);
}
```

### strikeCueBall(d, P, offsetScaled)
```ts
function strikeCueBall(d: Vec3, power: number, offsetScaled: Vec2) {
  const J = powerToImpulse(power);
  v += d * (J / m);

  const rOffset = vec3(offsetScaled.x * r, offsetScaled.y * r, 0);
  const torqueImpulse = cross(rOffset, d * J);
  omega += torqueImpulse / I;
}
```

### stepCueBall(dt)
```ts
function stepCueBall(dt: number) {
  const rc = vec3(0, -r, 0);
  const vRel = v + cross(omega, rc);

  if (length(vRel) > eps) {
    const F = normalize(vRel) * (-muK * m * g);
    v += (F / m) * dt;
    omega += (cross(rc, F) / I) * dt;
  } else {
    v *= 1 - kRoll * dt;
    omega *= 1 - kSpin * dt;
  }
}
```

---

### Integration notes
- Keep this **physics module isolated** from UI and rendering; it should only consume input offsets and produce updated `v`/`omega`.
- For realism, keep the **ball size and mass** consistent across Pool Royal / Snooker Royal variants.
- Tune `powerToImpulse`, `muK`, and `kRoll` empirically using a test scene with slow-motion playback.
