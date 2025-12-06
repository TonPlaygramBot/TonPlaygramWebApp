# London 1990 Reconstruction Plan

This document outlines a pragmatic approach to replace an existing city scene with a highly detailed, historically inspired reconstruction of western London circa 1990 using only open data and open-source assets (GLTF/GLB preferred).

## Goals
- Remove the current city content (terrain, roads, buildings, props) and rebuild based on real-world topology for western London.
- Keep the experience performant for a mobile-friendly WebGL/Three.js stack while retaining 1990-era visual cues.
- Maintain modular systems (input, physics, rendering, UI, audio, networking) to simplify iteration.

## Data sources (open-license)
- **OpenStreetMap (OSM)**: roads, pavements, parks, rail lines, river outlines, and building footprints.
- **Ordnance Survey OpenData**: supplemental footprints and height hints where OSM is sparse.
- **Environment textures**: CC0 skyboxes from Poly Haven; CC0 terrain/brick/asphalt packs from ambientCG.
- **Props & vehicles (1990s look)**: CC0/CC-BY GLTF packs on Sketchfab/Poly Pizza; prefer low-poly LOD sets.

> Avoid Google Maps/Earth geometry or textures; use them only as visual references.

## Extraction & conversion pipeline
1. **Roads & pavements**: export western London OSM extract (Geofabrik). Convert to vector tiles or GeoJSON and generate meshes with `osm2world` or `blender-osm` → export GLTF.
2. **Buildings**: use OSM footprints + OS height hints; extrude in Blender with procedural height ranges based on building type (residential/office/retail) to match 1990 silhouettes. Export LOD0 (hero) and LOD1 (blocky) GLTFs.
3. **Parks & water**: derive masks from OSM multipolygons; generate simple height-blended meshes. Apply CC0 grass/water materials.
4. **Street furniture**: place 1990s-appropriate lamps, phone boxes, bus stops from CC0 GLTF kits. Create a placement CSV keyed by OSM node IDs for reproducibility.
5. **Traffic & pedestrians**: use lightweight agent placeholders; later swap with rigged 1990s vehicles/peds GLTFs.

## Scene layout (western London focus)
- Cover key districts (e.g., Kensington, Hammersmith, Notting Hill, Chelsea) to keep scope bounded.
- Use a **tile streaming** grid (e.g., 250–500 m chunks) with origin near the Thames to minimize floating-point error.
- Each tile bundles: terrain patch, road mesh, building LODs, foliage/props list, baked light probes.

## Engine integration (Three.js/WebGL)
- **Import pipeline**: `draco` compressed GLTFs; atlas textures (2048 for hero tiles, 1024 for peripheral tiles).
- **ECS layout**: entities for `Transform`, `Renderable`, `Collider`, `AudioSource`, `Interactable`.
- **Gameloop**: update → physics (fixed dt) → AI → animation → render. Keep rendering decoupled from data streaming.
- **Culling & LOD**: frustrum + distance culling; switch LODs by screen size. Occlusion hints baked per tile.
- **Input**: action-map abstraction for touch/gamepad/keyboard; mobile-first camera (orbit + first-person toggle).

## Visual tone (1990s London)
- Desaturated brick/stone palettes; sodium-vapor streetlights; boxy vehicles and phone boxes as anchors.
- Use baked lightmaps or light probes for static geometry; minimal real-time lights.
- Add period signage/ads via CC0 decals; avoid modern LED screens.

## Build & validation steps
- Bake tiles in Blender via script (Python) to ensure deterministic exports.
- Run GLTF validator on every asset drop; ensure triangle counts per tile stay within budget (hero <150k, peripheral <60k).
- Profiling: measure GPU frame time and draw calls per tile; enforce object pooling for dynamic agents.

## Onboarding & UX
- Short tap-through tutorial: move, look, interact. Provide visual/audio feedback for every action.
- Settings: toggle LOD quality, traffic density, and post-processing (grain/bloom on/off).

## Next actions (suggested backlog)
- Automate OSM → GLTF export for west-London bounding box.
- Prototype tile loader in `src/` with streaming and LOD swapping.
- Integrate CC0 1990s prop pack and set up placement CSV per tile.
- Create a reference moodboard (non-included) from archival photos to drive material tuning.
