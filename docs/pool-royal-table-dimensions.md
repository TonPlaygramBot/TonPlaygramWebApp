# Pool Royal Table & Equipment Reference

This summary follows World Pool-Billiard Association (WPA) equipment specifications so the virtual table matches a regulation setup.

## Playing Surface (nose-to-nose)
| Nominal size | Metric (mm) | Imperial (in) |
| --- | --- | --- |
| 7 ft | 1981 × 991 | 78 × 39 |
| 8 ft | 2235 × 1118 | 88 × 44 |
| 9 ft (tournament) | 2540 × 1270 | 100 × 50 |

Notes:
- Measurements are taken between the cushion noses (not the wooden rails).
- Cushion nose height above the slate: **37 ± 1 mm** (1 7/16" ± 1/16").
- Slate flatness tolerance: **≤ 0.7 mm** across the playing field.

## Pocket Geometry (WPA)
- **Corner mouth width:** 114–117 mm (4.50"–4.62").
- **Side mouth width:** 120–123 mm (4.72"–4.84").
- **Throat/shelf depth (from mouth line to far cushion nose):**
  - Corner pockets: 47.6 ± 3.2 mm (1 7/8" ± 1/8").
  - Side pockets: 34.9 ± 3.2 mm (1 3/8" ± 1/8").
- **Cushion facings:** 3.2–4.8 mm (1/8"–3/16") thick, 142°–145° included angle at corners.
- **Drop clearance:** Minimum 63.5 mm (2 1/2") vertical clearance from slate to shelf to avoid hang-ups.

## Balls
- **Diameter:** 57.15 mm (2 1/4"), tolerance ±0.13 mm (±0.005").
- **Weight:** 156–170 g; set must be within 1 g between balls.
- **Cue ball:** Same diameter; weight may vary by up to +2 g for bar-box magnet types (avoid in sim).
- **Elasticity target:** Coefficient of restitution (ball-to-cushion) 0.60–0.75 on clean cloth at 20–23°C.

## Cloth & Friction Targets
- **Speed:** A lag shot from head string to foot cushion and back should stop within 15–20 cm (6–8") of the head cushion on a 9 ft table with new cloth.
- **Nap/texture:** Use worsted tournament cloth parameters (low friction) for default; offer a higher-friction bar-cloth variant for casual rooms.

## Markings & Lines (9 ft reference)
- **Long string:** Center line down the table. All spots sit on this line.
- **Head string:** A line across the width **63.5 cm (25")** from the head cushion nose (¼ of table length). Break line for cue-ball placement.
- **Foot spot:** On the long string **55.9 cm (22")** from the foot cushion nose. Rack apex sits here.
- **Foot string:** Line through the foot spot (useful for drills/overlays).
- **Center spot:** Intersection of long and mid-lines at the geometric center (127 cm from either short rail).

## Pocket & Diamond Index (9 ft reference)
- Diamonds are spaced at **12.7 cm (5")** on short rails and **31.75 cm (12.5")** on long rails, measured nose-to-nose.
- Pocket openings align with the diamond grid: corner pockets bracket diamonds 0 and 4 on each long rail; side pockets sit at the midpoint (50" from either short rail).

## Implementation Tips for Pool Royal
- Author cloth friction and cushion restitution as tunable parameters tied to the above targets; validate with automated lag and bank tests.
- Generate collision meshes directly from the numeric specs above (nose height, shelf depth, mouth widths) so art changes cannot desync physics.
- Use the spot and string distances to place overlays (rack template, break box, shot clock arcs) and to seed ball spawns for drills.
- Keep all measurements in meters internally; derive portrait-screen UI distances from the same canonical table rectangle to preserve visual proportions on mobile.
