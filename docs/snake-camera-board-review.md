# Snake board and camera presentation adjustment

Following the requested follow-up to the Ludo presentation baseline:
- Reduce the Snake board root uniformly to 90% of its former size. Keep table, chairs, humans and fixed 78-degree lens unchanged.
- Raise the resolved seated-eye camera by 0.12 world units. A failed eye resolution leaves the existing fallback untouched, so loading/missing/invalid heads cannot accumulate height across resets.
- Increase the die's local geometry inversely to the board scale change. Body, pips, rims, grip half extent, landing height and die spacing retain their former world size.

Validation: focused Node presentation checks and the complete Snake Vitest suite, including repeated valid/missing/invalid eye resets and actual THREE die geometry/landing bounds. These are mathematical and headless scene checks, not rendered-device QA. Imported-table variants, reach and collision appearance still need visual inspection. No gameplay rules, RNG, network/reward behavior, or other game scenes changed.

This is a review-only change. No deployment or claim of mobile/WebGL visual verification.
