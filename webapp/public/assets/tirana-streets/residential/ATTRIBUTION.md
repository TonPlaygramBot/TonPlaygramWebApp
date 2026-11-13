# Residential buildings

Original model: **Modular Urban Apartments Facade** by **James Ray Cock**, Poly Haven.

- Asset: https://polyhaven.com/a/modular_urban_apartments_facade
- License: **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/
- Provider license statement: https://polyhaven.com/license
- Source file manifest: `sources.json` (original URLs, sizes, checksums).

The house, villa and apartment scenes assemble this artist-made modular kit into
complete buildings. They do not represent exact surveyed Tirana architecture.
These are different assemblies of one original kit, not three separately
sourced house models. Original geometry buffers, UVs and 1K PBR textures are
retained without repainting or replacement. Only scene node selection and
transforms change. Gameplay supplies accessible interiors separately.

The original source scene is a catalogue grid of 147 modules; the import script
downloads it for reproducibility and it must not be added directly to the game world. Runtime uses
`house.gltf`, `villa.gltf` or `apartment.gltf`. Their local entrance faces +Z.

Mapped buyable properties use `facade-kit.gltf`: seven unchanged source modules
are laid along the actual mapped footprint edges, with approximately 3m bays
and floor heights and a human-scale entrance at the shared gameplay portal.
The source plaster panel supplies the roof, clipped to the mapped polygon.
Facades retain original textures and are batched by material. These mapped
assemblies match collision outlines; their appearance is authored rather than
a claim to reproduce the real building's architecture.

Rebuild scene JSON and inspect originals: `python webapp/scripts/import-tirana-residences.py`
from the repository root. Production builds use the existing external-asset
vendor pipeline and reviewed SHA-256 source lock to download the 13 original
dependencies. Runtime URLs are same-origin and do not depend on a third-party
host. These binaries are generated build outputs, not committed duplicates.

CC0 permits copying, modification, redistribution and commercial use without
asking permission. Attribution is supplied voluntarily to preserve provenance.
