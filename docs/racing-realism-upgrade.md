# Racing Royal realism pass

## Scope
- Garage retains VS AI and multiplayer races. Career, time trial and combat selectors and career entry points are retired. Legacy mode requests normalize to a race; historical progress data is not deleted.
- Visible front steering is stronger, with a low-speed rack taper and inside/outside wheel angles. This is visual steering only: authoritative simulation, stakes and rewards are unchanged.
- Each kart has a rear exhaust outlet with a fixed five-puff smoke pool and a two-layer boost flame. Exhaust responds to throttle, braking, boost and retirement, and suppresses smoke in reduced-motion mode. No per-frame mesh creation or point lights are added.
- Driver-eye fallback cameras now look nearly level down the circuit, matching the Turi eye view rather than aiming steeply at the road.
- GLTF kart and driver cloning preserves arrays of authored materials and their original texture maps. Existing adult-driver/world-metre fitting is retained instead of arbitrarily shrinking the driver.
- Generic Tirana facades use existing licensed texture maps and corrected vertical-wall UVs. See `racing-tirana-surface-upgrade.md` for exact scope and limitations.

This is not a full photogrammetry replacement of Tirana. Roads, footprints and landmarks retain the existing city data. Procedural road/scenery elements remain. Original textured glTF assets must be measured and licensed before substituting real landmarks; random imported buildings do not establish geographic realism.

## Validation
`node --test test/racingExhaust.test.mjs test/racingPaceUpgrade.test.mjs test/tiranaBuildingSurfaceUV.test.mjs`

Run the standalone kart Vite entry for a visual check, then test actual mobile devices. Pool tests establish bounded effects and state gating, not appearance/FPS. No production purchase or deployment is part of this pass.
