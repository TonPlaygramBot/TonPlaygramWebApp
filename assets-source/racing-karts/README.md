# Racing Royal kart source

The eight current game models are authored by `tools/assets/modernKartModel.ts`.
Run `node tools/build-modern-racing-karts.mjs` from the repository root after
installing the existing `webapp` dependencies. This deterministically replaces
the same eight high/low GLB pairs and updates their manifests.

The earlier `.blend` files in this directory and `future/` remain the previous
artwork, not the source of the current kart revision. The articulated
`race-driver` model remains the existing Blender asset from `future_karts.py`.

The current meshes preserve the original IDs, seat/hand mount, axle centres,
animation node names and common fitted race footprint. They use original
geometry and PBR materials with no external texture requests. The portrait
preview executes the same TypeScript authoring function as the GLB exporter.

Visual construction references and validation: `docs/racing-royal-corners-and-karts.md`.
