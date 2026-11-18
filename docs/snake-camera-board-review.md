# Snake board and camera presentation adjustment

Following the requested follow-up to the Ludo presentation baseline:
- Reduce the Snake board root uniformly to 90% of its former size. Keep table, chairs, humans and fixed 78-degree lens unchanged.
- Raise the resolved seated-eye camera by 0.12 world units. A failed eye resolution leaves the existing fallback untouched, so loading/missing/invalid heads cannot accumulate height across resets.
- Increase the die's local geometry inversely to the board scale change. Body, pips, rims, grip half extent, landing height and die spacing retain their former world size.

Validation: focused Node presentation checks and the complete Snake Vitest suite, including repeated valid/missing/invalid eye resets and actual THREE die geometry/landing bounds. These are mathematical and headless scene checks, not rendered-device QA. Imported-table variants, reach and collision appearance still need visual inspection. No gameplay rules, RNG, network/reward behavior, or other game scenes changed.

This is a review-only change. No deployment or claim of mobile/WebGL visual verification.

## Default production table geometry follow-up

A separate fixture now uses the actual default table radius (`TABLE_RADIUS * TABLE_VISUAL_SCALE`), production root height (`surfaceY - 0.0025`), and table parent. At each of the four cardinal seats, conservative die and board AABBs have about 0.00345 world units of horizontal separation, and die footprint corners remain within the default tabletop outline. This checks the production default, not imported-table geometry or rendered appearance. The die AABB extends about 0.00098 below the table surface (transformed pip bounds); this pre-existing conservative-bound result is not proof of triangle penetration and the requested original landing height is unchanged.
