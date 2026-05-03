# Bowling Realism Asset Notes

## Recommended open-source GLTF assets

- Bowling pins (CC0): Poly Pizza "Bowling pin" GLB.
- Bowling furniture (tables/chairs): Poly Pizza / Kenney Furniture Kit (GLB/GLTF exports).

## Real-world mechanism references reviewed

- HowStuffWorks pinsetter breakdown (sweep bar, table lift, deadwood cycle).
- Brunswick service manuals for GS/A2 machine sequencing and ball return separation.
- Bowling mechanic references showing: pit -> accelerator/lift -> gravity return rack.

## Scene wiring checklist

1. Replace old pin mesh prefabs with a single high-quality GLTF pin prefab.
2. Connect `BowlingPinDeckMechanism` parts:
   - `sweepBar`
   - `pinTable`
   - `deadwoodCollector`
3. Connect `BowlingBallReturnSystem`:
   - all active balls in `bowlingBalls`
   - under-lane spline anchors in `returnWaypoints`
   - waiting rack anchors in `ballStorageSlots`
   - user pickup anchor in `playerPickupPoint`
4. Add Murlan Royal table + chairs GLTFs near the bowler area.
5. Connect `BowlingSeatingController`:
   - `throwStandPoint` aligned to lane start
   - `chairSitPoint` matching Murlan Royal seating framing
   - navmesh agent + animator
