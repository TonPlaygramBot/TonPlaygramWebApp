# London 1990 Western Area Rebuild Plan

This document outlines how to replace the existing city content with a 1990-era recreation of western London using only open data and free, open-source GLTF assets.

## Goals
- Remove every existing city object (buildings, roads, pavements, parks, institutions) and replace them with data-driven equivalents for western London as it appeared circa 1990.
- Use only open data (e.g., OpenStreetMap, Ordnance Survey OpenData) and open-source assets that allow redistribution in GLTF/GLB format.
- Keep gameplay performant with modular systems (input, physics, rendering, UI, audio, networking) and clear onboarding/core loop.

## Data Sources (Open & License-Friendly)
- **OpenStreetMap**: road centerlines, footprints, parks. Export via [overpass-turbo.eu](https://overpass-turbo.eu/) or `osmium` to PBF/GeoJSON.
- **Ordnance Survey OpenData**: historic building footprints where available; complements OSM gaps.
- **Environment textures**: HDRIs from [polyhaven.com](https://polyhaven.com/) (CC0) for skyboxes and reflections.
- **Props & vehicles**: CC0/CC-BY GLTF packs from [Kenney.nl](https://kenney.nl/assets) and [AmbientCG](https://ambientcg.com/) for materials.
- **Terrain/elevation**: SRTM/ASTER DEM (public domain) for gentle height variation; downsample for performance.

> Avoid Google Maps/Earth geometry or textures because they are not redistributable.

## Extraction & Conversion Pipeline
1. **Download area extract**: western London bounding box (e.g., Heathrow to Paddington). Save as `data/london-west-1990.osm.pbf`.
2. **Generate base meshes**:
   - Roads/pavements: use `osm2world` or `blender-osm` to convert OSM data to GLTF; set lane widths to 1990 standards (e.g., 3.2m) and enable sidewalk generation.
   - Buildings: extrude footprints by historical heights (use OSM `height`/`levels`; otherwise fallback to area averages by landuse). Export as GLTF with LODs (high/medium/low) per district.
   - Parks/greenery: convert `leisure=park` and `landuse=grass` polygons to simple ground meshes with tiling materials.
3. **Optimize**:
   - Run meshes through `gltfpack` (`gltfpack -i input.glb -o output.glb -cc -kn`) for compression.
   - Bake lightmaps in Blender for static geometry; keep dynamic lights minimal.
   - Generate collision meshes separately (simplified boxes/prisms) and keep them in a distinct GLTF node hierarchy.
4. **Organize assets**: place GLTF/GLB files under `assets/london-1990/{roads,buildings,parks,props}/`. Include a manifest JSON referencing provenance and license of each file.

## In-Engine Integration (Unity or Web/Three.js)
- **ECS-friendly layout**: import GLTFs as prefabs with components for `Transform`, `Renderable`, `Collider`, and `AudioZone`.
- **Streaming**: segment the city into grid chunks (~250m tiles). Stream GLTF tiles in/out based on camera distance; prewarm colliders.
- **LODs**: assign LOD0/1/2 to each building; switch on screen size to maintain FPS on mobile.
- **Collisions**: use dedicated collider GLTF layers to keep physics simple; disable mesh colliders on decorative props.
- **Navigation**: build navmeshes per tile; stitch at chunk borders for AI/traffic.
- **Lighting**: single directional sun + baked GI; per-district reflection probes using PolyHaven HDRIs for 1990 overcast feel.
- **Audio**: ambient loops per zone (traffic, park, market) with distance-based attenuation.

## Art Direction for 1990s London
- Color palette: muted brick reds, concrete grays, dark asphalt; low-saturation shop signage.
- Vehicles/props: 80s–90s era buses, black cabs, phone boxes, sodium-vapor streetlights.
- Road markings: dashed white lane separators, yellow curb lines, 90s-era signage fonts.
- Architecture mix: terraced housing, post-war estates, 80s office blocks around Paddington/Shepherd's Bush.

## Task Breakdown
- **Data cleanup**: normalize OSM tags, fix building holes, ensure topology is manifold before extrusion.
- **Mesh generation**: scriptable pipeline (Node/TypeScript or Python) that ingests PBF and outputs tiled GLTF with LODs.
- **Prefab assembly**: create reusable prefabs for road segments, intersections, terraced houses, shopfronts, and landmarks; attach colliders and LOD groups.
- **Replacement pass**: remove existing city scene references and load new tile manifest; verify gameplay loops (spawn, navigation, interactions) still work.
- **Performance pass**: profile draw calls, memory, and GC; apply batching and texture atlases.
- **QA**: automated scene load smoke test; collision pass; navigation sanity; visual checklist vs. 1990 references.

## Onboarding & UX Considerations
- Keep controls responsive; provide a 20–30s tutorial overlay explaining movement, camera, and interaction hotspots.
- Add contextual cues (icons/audio) when interacting with 90s props (phone boxes, buses, market stalls).
- Ensure accessibility: remappable inputs and color-safe signage contrast.

## Open-Source Compliance
- Maintain a `LICENSES.md` in the asset folder listing each source, license, and attribution text.
- Store raw data downloads and conversion scripts under `tools/london-1990/` with README for reproducibility.

## Next Steps
1. Prototype one 250m tile around Paddington with OSM → GLTF pipeline and measure FPS on target devices.
2. Define asset manifest schema and hook streaming loader to current game loop.
3. Replace remaining tiles iteratively, running smoke tests after each district.
