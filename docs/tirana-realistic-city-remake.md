# Tirana Streets — Realistic City Remake

## Goal
Rebuild the visual city layer of Tirana Streets so central Tirana reads as a real place rather than a simplified procedural shell, while preserving the existing portrait-mobile gameplay, missions, networking, collision and navigation contracts.

## Source and licensing policy

The remake must not scrape, download, reverse-engineer, cache, redistribute or ship proprietary Google Maps / Google Earth photogrammetry or 3D Tiles outside the terms of the relevant Google Maps Platform services.

The production asset pipeline must use redistributable or properly licensed sources. The baseline geography remains OpenStreetMap-derived data under ODbL, with explicit attribution. Higher-fidelity landmarks and facade assets must carry their own source/license records in `public/assets/tirana-streets/ATTRIBUTION.md`.

Google Maps may be used only as a visual reference where permitted; it is not an asset-extraction source.

## Architecture

The remake keeps gameplay coordinates and physics authoritative in `shared/world.mjs` / `shared/engine.mjs` and replaces only presentation-side city construction.

### 1. Geospatial city data

Extend `scripts/build-tirana-map.py` to retain richer OSM tags per building and road:

- `building:levels`, `roof:levels`, `roof:shape`, `roof:height`
- `building:material`, `building:colour`, `roof:colour`
- `addr:street`, `name`, `shop`, `amenity`, `historic`, `tourism`
- road surface, lanes, one-way, lit, sidewalk and parking hints
- natural/tree nodes, barriers, crossings and traffic signals

The generated runtime world should remain compact and deterministic.

### 2. Render tiers

Use distance-based streaming around the player/camera:

- **Hero tier (0–120 m):** landmark GLBs, detailed facade modules, balconies, shopfronts, rooftop equipment, street furniture, high-quality shadows.
- **Near tier (120–350 m):** footprint-accurate extrusions, facade atlas materials, windows/balconies via instancing, medium-detail roofs.
- **Mid tier (350–800 m):** merged building chunks with baked facade color/normal variation and no per-object shadows.
- **Far tier (>800 m):** low-poly skyline / impostor blocks and mountain horizon.

Chunks should be spatially keyed (grid/quadtree) and activated incrementally rather than constructing the entire city into one permanent group.

### 3. Building system

Create a procedural `BuildingRenderer` that uses the exact OSM footprint while choosing deterministic facade archetypes from local tags and geometry.

Each building can compose:

- ground-floor storefront band where appropriate
- plaster, stone, concrete, glass or brick facade materials
- floor slabs and window bands derived from height/level count
- balconies only on sufficiently long facade segments
- parapets, sloped roofs, terraces, water tanks, solar panels and HVAC props
- night emissive window masks with a low fill ratio

Use shared texture atlases and `InstancedMesh`; never allocate one material per window.

### 4. Landmark pass

Replace generic geometry with individually authored or properly licensed models for major central-Tirana anchors, prioritized by gameplay visibility:

1. Skanderbeg Square + Skanderbeg Monument context
2. Et'hem Bey Mosque
3. Clock Tower
4. National History Museum facade massing
5. Tirana International Hotel
6. The Pyramid of Tirana
7. Mother Teresa Square / University frontage
8. Rinia Park edge buildings
9. Blloku signature towers and corner buildings
10. Lana River bridges and embankments

Landmarks must retain the existing game-space coordinate system so missions/navigation do not move.

### 5. Streets and public realm

Add deterministic, batched detail:

- curb/sidewalk separation
- zebra crossings and stop lines
- lane markings from road metadata
- traffic lights and sign poles
- Tirana-style street lamps
- bollards, benches, bins, hydrants, kiosks
- street trees and planters
- bus stops
- parked-car spawn strips outside active lanes
- varied asphalt patches and sidewalk material atlases

### 6. Lighting and atmosphere

Preserve mobile performance while improving physical readability:

- ACES tone mapping
- sun direction appropriate to Tirana latitude
- cascaded-style near shadow strategy simulated with a moving high-resolution shadow box
- baked/cheap ambient occlusion in facade textures and contact-shadow decals
- distance fog matched to the basin and mountain horizon
- optional day/evening presets without changing game logic

### 7. Mobile performance budget

Target portrait phones first:

- adaptive DPR 0.8–1.65
- 30 FPS battery target, 45–60 FPS high target
- texture atlases, KTX2/Basis where practical
- GLB mesh compression (Meshopt/Draco where supported by the current loader path)
- frustum + distance culling
- occlusion-friendly chunking
- instanced repeated props
- no dynamic shadows on mid/far tiers
- total visible draw calls target: <250 high, <140 battery
- avoid loading hero assets until their district becomes relevant

### 8. Gameplay invariants

Do not break:

- `WORLD` origin and mission coordinates
- road graph navigation
- line-of-sight / building collision behavior
- player/car controls
- multiplayer snapshots
- portrait HUD layout
- existing tests asserting >1000 buildings/roads and collision against true footprints

## Implementation phases

### Phase A — renderer foundation

- introduce spatial city chunks
- adaptive visibility tiers
- deterministic facade archetypes
- rooftop generator
- instanced windows/balconies/props
- upgraded streets and vegetation

### Phase B — high-fidelity Tirana anchors

- add landmark registry and independently licensed GLBs
- author district-specific facade palettes for Skanderbeg, Blloku, Lana and Mother Teresa Square
- add central street furniture/signage variants

### Phase C — asset pipeline

- enrich OSM ingestion
- add reproducible asset validation scripts
- add GLB/KTX2 optimization checks
- maintain machine-readable source/license manifest

### Phase D — polish and performance

- dynamic quality controller
- mobile memory budget instrumentation
- scene statistics debug overlay
- visual regression screenshots on representative portrait viewports

## Definition of done

The city should be immediately recognizable as Tirana from street-level gameplay and elevated camera views; landmark silhouettes, street scale, river alignment, blocks and central districts must match real geography. The result must remain responsive on mobile and all distributed data/assets must have a lawful, documented source.
