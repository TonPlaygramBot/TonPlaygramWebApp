# Pool Royal Table & Equipment Dimensions (WPA/BCA Spec)

These measurements follow the World Pool-Billiard Association (WPA) / Billiard Congress of America (BCA) equipment specs for a tournament 9-foot pool table. Values are given in both imperial and metric; tolerances use WPA allowances.

## Playing Surface & Rails
- **Playing field (cushion nose to nose):** 100 in × 50 in (2,540 mm × 1,270 mm).
- **Cushion nose height above slate:** 1.0 in ± 1/16 (25.4 mm ± 1.6); rail rubber apex sits 63.5 mm above the playing surface measured to the nose.
- **Slate flatness:** Deviations ≤ 0.01 in (0.25 mm) across the playfield.
- **Rail width (nose to outer edge):** 4.5–5.0 in (114–127 mm) to allow hand bridge clearance and pocket hardware.
- **Cloth alignment:** Seams run along the long axis; no wrinkles and stretch even on all rails for consistent rebound.

## Pocket Geometry
- **Corner pocket mouth (between cushion noses):** 4.50 in ± 1/8 (114.3 mm ± 3.2).
- **Side pocket mouth (between cushion noses):** 5.00 in ± 1/8 (127.0 mm ± 3.2).
- **Corner pocket angle:** 142° ± 1° at the mouth; facings radiused 1/8–1/4 in (3–6 mm).
- **Side pocket angle:** 104° ± 2° at the mouth; facings radiused 1/8–1/4 in (3–6 mm).
- **Shelf depth (nose to vertical drop line of pocket liner):** Corner 1 7/8 in (47.6 mm); Side 1 11/16 in (42.9 mm).
- **Pocket liners:** Resilient material flush with rail facings; no protrusion into the playfield.

## Balls
- **Diameter:** 2 1/4 in (57.15 mm).
- **Weight:** 5.5–6.0 oz (156–170 g) per ball; cue ball within ±0.5 g of object balls.
- **Roundness & variance:** Diameter tolerance ±0.005 in (±0.127 mm); weight tolerance ±0.005 oz (±0.14 g) per set.

## Markings & Lines
- **Head string ("white line" / baulk line):** Drawn across the table parallel to the short rails at one-fifth of the playing length from the head rail. On a 100 in field, place it 20 in (508 mm) from the head cushion nose.
- **Head spot:** At the midpoint of the head string on the table centerline.
- **Foot spot:** At the longitudinal midpoint of the foot half—80 in (2,032 mm) from the head cushion nose and 20 in (508 mm) from the foot cushion nose.
- **Center spot:** At the exact playfield center—50 in (1,270 mm) from each long rail and 50 in (1,270 mm) from each short rail.
- **Rack outline (reference):** For 8/9/10-ball, center the triangle/diamond on the foot spot with its base parallel to the foot rail; no printed rack permitted unless it meets tournament rules.

## Break & Position Reference
- **Cue ball placement on break:** Behind (toward the head rail side of) the head string.
- **Kitchen depth:** 20 in (508 mm) from the head rail to the head string; used for ball-in-hand-behind-the-line situations.
- **Tolerances for markings:** ±1/8 in (3.2 mm) placement accuracy to maintain fairness and replayable tracking.

## Height & Clearance
- **Bed height (finished table):** 29 1/4 in to 31 in (743–787 mm) from the floor to the playing surface.
- **Lighting clearance:** Bottom of light fixture 32–36 in (813–914 mm) above the playing surface with even, shadow-free coverage.

## Recommendable Coordinate System (for engine setup)
- Origin at table center, +X to the right long rail, +Y toward the foot rail.
- Rails at X = ±25 in (±635 mm); short-rail noses at Y = ±50 in (±1,270 mm).
- Pocket centers at (±25, ±50) for corners and (0, ±50) for sides; apply pocket cut angles and shelf depths above.

## Quick-Reference Table

| Component | Imperial | Metric | Notes |
| --- | --- | --- | --- |
| Playfield (nose to nose) | 100 × 50 in | 2540 × 1270 mm | 2:1 ratio (9 ft class) |
| Corner pocket mouth | 4.50 in ± 1/8 | 114.3 mm ± 3.2 | Between cushion noses |
| Side pocket mouth | 5.00 in ± 1/8 | 127.0 mm ± 3.2 | Between cushion noses |
| Corner shelf | 1 7/8 in | 47.6 mm | Nose to drop line |
| Side shelf | 1 11/16 in | 42.9 mm | Nose to drop line |
| Cushion nose height | 1.0 in ± 1/16 | 25.4 mm ± 1.6 | Rail rubber apex |
| Bed height | 29 1/4–31 in | 743–787 mm | Floor to cloth |
| Ball diameter | 2 1/4 in | 57.15 mm | All balls |
| Ball weight | 5.5–6.0 oz | 156–170 g | Cue ball matches set |
| Head string offset | 20 in | 508 mm | 1/5 table length |
| Center spot | 50 × 25 in | 1270 × 635 mm | From head cushion & long rail |

Use these measurements as the authoritative reference for modeling the Pool Royal table, pocket colliders, spawn points, and UI overlays.
