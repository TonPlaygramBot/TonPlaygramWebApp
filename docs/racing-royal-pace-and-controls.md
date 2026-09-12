# Racing Royal: pace, suspension, and portrait controls

The existing React / Three.js game, kart roster, Tirana circuits, career, and
authoritative multiplayer simulation are retained.

## Driving

- Base cruise cap increases from 31 to 39 m/s; turbo from 43 to 53 m/s before
  the existing kart and AI multipliers (Apex: about 140 / 191 km/h).
- Stronger acceleration and brakes accompany the higher speed. Manual gas,
  coasting, brake priority, and reverse limits remain intact.
- Expiring turbo decelerates smoothly instead of instantly clamping to cruise.
- AI braking looks farther ahead at speed. All six circuits still complete
  three sequentially gated laps in the focused AI test.
- Nitro consumption is 27 energy/second, with 4 passive or 16 drifting recharge.
- Road pads now grant 24 energy and 1.15 seconds of turbo, with a per-racer
  eight-second cooldown. Swept collision detects crossings between updates;
  off-strip, wrong-way, and repeated cooldown pickups are rejected.

## Portrait controls

The screen order is left/right steering, central drift, brake, and gas at the
right edge. Boost sits above both pedals. At a 390px viewport, steering buttons
are approximately 64 × 96px; gas and brake approximately 55 × 76px.

Hold gas and slide that thumb upward to boost. Hold either steering button and
slide that thumb upward to drift; sliding back down releases only the drift.
Separate drift and boost buttons remain available. Each pointer owns its
inputs, with cleanup on release, cancellation, capture loss, blur, hiding,
pause/disable, and unmount.

## Presentation and performance

`KartMotion.ts` supplies damped suspension pitch, cornering roll, small road
movement, wheel rotation, and inside/outside steering angles. It is shared
with the in-chat preview and cannot change race physics. Driver hands retain
their existing two-bone steering-wheel constraint. Turbo slightly extends the
chase camera; reduced motion suppresses body movement and camera surge.

All boost strips are batched into two draw calls:

| Circuit | Boost pads |
| --- | ---: |
| Skënderbej | 20 |
| Blloku | 12 |
| Lana | 15 |
| Pyramid | 12 |
| Stadium | 7 |
| Lana–Pyramid Grand | 21 |

Pads are distributed along straight sections, separated by at least 28m, and
checked against the upcoming braking envelope. Race geometry is unchanged.

## Validation

The following command passes 43 checks:

```sh
node --test test/racingPaceUpgrade.test.mjs test/racingTouchControls.test.mjs test/racingKartRemake.test.mjs test/racingManualDrive.test.mjs test/racing-precision.test.mjs
```

The standalone racing production build passes with the existing large-bundle
warning. The broader `tsconfig.kart.json` check reports six existing missing
declarations in imported city/exploration modules; none is in the changed racing
modules. Live browser visual QA was blocked by the browser URL policy. Input
component validation uses React DOM + jsdom and does not substitute for a phone
playtest.

The portable preview uses the production simulation, controls, suspension,
driver articulation, boost-strip layer, and race effects with embedded kart
models and simplified city rendering:

```sh
node tools/previews/build-racing-manual-preview.mjs /workspace/racing-royal-upgrade.html
```

The preview includes three karts and Blloku; the production game retains all
eight karts and six circuits. Deploy frontend and server from the same revision
because they import the shared simulation.
