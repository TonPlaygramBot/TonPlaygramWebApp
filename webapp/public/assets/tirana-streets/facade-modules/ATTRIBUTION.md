# Modular urban facade components

Original: **Modular Urban Apartments Facade**, **James Ray Cock**, Poly Haven.
Source: https://polyhaven.com/a/modular_urban_apartments_facade
Licence: CC0-1.0, https://polyhaven.com/license
Acquired 2026-11-18 from official API and official dl.polyhaven.org asset files.
Commercial use, modification and redistribution are allowed. Credit is retained
for provenance though CC0 does not require attribution.

This derivative selects four wall/window or wall/door pairs, dissolves coplanar
wall tessellation without removing UV/material boundaries, and normalizes each
bay to 3m×3m, centered X, bottom Y=0, backing Z=0, outward +Z. Detailed openings and original
1K PBR maps/glass are retained. It does not replicate a specific Tirana building
and does not replace OSM footprints or roads. There are no balcony source parts
in this derivative. Runtime must instance only a bounded nearby selection.

See `modules.json` for triangle counts and `sources.json` for original download
URLs, verified source checksums and derivative checksum. Reproduce with Blender
using `scripts/assets/export-tirana-facade-modules.py`; set FACADE_SOURCE to the
locally acquired original glTF and FACADE_OUTPUT to the desired output directory.
