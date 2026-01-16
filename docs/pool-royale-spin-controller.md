# Pool Royale – Spin Controller Directions (Physical Offsets)

Spin input is defined as a **2D offset on the cue ball contact disk** (cue-tip impact point).

- **Coordinate frame (screen-space)**: `x` is right, `y` is up on the player’s screen.
- **Normalized**: offsets are clamped to a circle with `|offset| ≤ 0.7`.
- **Physics intent**: the offset only applies **impulse + torque at impact**; no artificial curve is added mid-flight.

## Directions A–G (cue-tip contact offsets)

**A) STUN (no spin)**  
**Offset**: `(x=0, y=0)`  
**Effect**: Cue strikes the centre of mass. The ball initially slides with no spin, then transitions to pure rolling from table friction. After contact, it neither follows nor draws noticeably.

**B) TOPSPIN (follow)**  
**Offset**: `(x=0, y=+0.7)`  
**Effect**: Strike above centre creates forward roll (spin around horizontal axis). After contact, the cue ball continues forward.

**C) BACKSPIN (draw)**  
**Offset**: `(x=0, y=-0.7)`  
**Effect**: Strike below centre creates backward roll (spin opposite travel). After contact, the cue ball slows, stops, and draws back.

**D) SIDESPIN LEFT (left english)**  
**Offset**: `(x=-0.7, y=0)`  
**Effect**: Strike left of centre creates side spin around the vertical axis. Primary effect is on cushion rebounds and cut-induced throw.

**E) SIDESPIN RIGHT (right english)**  
**Offset**: `(x=+0.7, y=0)`  
**Effect**: Strike right of centre creates side spin around the vertical axis in the opposite direction. Affects cushion rebounds and throw.

**F) TOPSPIN + SIDESPIN (combination)**  
**Offsets**: `(x=±0.5, y=+0.5)`  
**Effect**: Follow plus english. The cue ball rolls forward after impact while side spin alters cushion rebound and cut throw.

**G) BACKSPIN + SIDESPIN (combination)**  
**Offsets**: `(x=±0.5, y=-0.5)`  
**Effect**: Draw plus english. The cue ball draws back after impact while side spin changes cushion rebound and cut throw.
