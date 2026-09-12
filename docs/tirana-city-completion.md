# Tirana Streets: mapped city completion

This update fills omissions in the existing urban scene using the repository's
12 September 2026 OpenStreetMap extract. It preserves the world origin, all road
centrelines, building footprints, source levels, mission locations and portrait
controls. It is a substantial detail expansion, not a surveyed digital twin of
every object in present-day Tirana.

## Added coverage

| Feature | Added |
| --- | ---: |
| Trees, including inferred spacing on mapped tree rows | 7,484 |
| Shrubs and hedge segments inside mapped vegetation | 8,937 |
| Traffic signal assemblies | 282 |
| Stop / give-way signs | 509 / 62 |
| Source speed-limit signs | 49 |
| Destination boards using OSM destination text | 78 |
| Parking signs | 311 |
| Litter bins / larger waste containers | 85 / 600 |
| Street lamps | 1,185 |
| Surface parking polygons / fitted bays | 326 / 3,845 |
| One-way road arrows | 6,306 |
| Complete source-footprint Blender buildings | 8 |

The importer excludes existing mapped tree ownership and nearby existing signal
assemblies. New fixture centres are checked against rendered carriageways,
building polygons and water. Source conflicts remain in
`assets-source/tirana-city-completion/coverage.json` (1,691 omitted candidates).
Parking paint stays inside surface, lane or street-side parking; underground
parking and private facilities are not painted. Bay layouts are estimates,
with an access aisle where a wide lot supports it. One-way arrows use the source
way direction; destination signs use the matching source way, not a nearest
unrelated road. Exact sign placement and mounting direction are unverified.

## Architecture and assets

`CityCompletionLayer` uses shared Blender geometry, material instances and one
sign atlas. The new trees reuse `MatureTreeLayer`'s leaf-card near tier and coarse
far tier. Updates are throttled and use spatial selection. Every added bin,
post and trunk has a matching collision envelope in the existing shared street
collider. Shrub leaves, signboards above head height and tree crowns do not
create invisible wall boxes.

`FacadeCompletionLayer` adds recessed window surrounds, sills, balcony slabs,
railings, air-conditioning units and ground-floor entrances to nearby source
shells. Entrances are visual facade details; they do not add interior access. Known landmark,
aged-housing and authored-building owners are excluded. The floor rhythm follows
the existing shell; buildings whose heights are unknown remain unresolved.
Levels-derived heights retain the existing 3.2 m visual floor-height assumption.
These are local architectural interpretations, not measured facade replicas.

Eight blocks also have complete native Blender models and game GLBs. The IDs,
unchanged source footprint/height and local export origins are recorded in
`building-input.json`, `buildingRegistry.mjs` and `building-metrics.json`. They
load within 240 m (120 m in battery mode), with the mapped shell retained until
loading succeeds. All assets use standard glTF without decoder dependencies.
The GLBs use multiple shared-material meshes, not one scene object per window.

The reusable kit's compact mesh payload is baked from the same evaluated
Blender geometry as `city-completion-kit.glb`. Rebuild from the repository root:

```sh
node webapp/scripts/build-tirana-city-completion.mjs
blender -b --python-exit-code 1 --python tools/blender/tirana_city_completion.py
blender -b --python-exit-code 1 --python tools/blender/tirana_completed_buildings.py
node webapp/scripts/build-tirana-completion-preview.mjs
```

The checked-in building input is the explicit authoring selection, so rebuilding
does not silently choose different buildings as the city dataset evolves.

## Source evidence and its limits

- **Current mapped inventory:** 35 OSM API tiles acquired on 12 September 2026.
  The importer verifies every compressed archive-part checksum and the combined
  SHA-256 `dca70c5d585b90c6c042b033bb4bfb001da8b297d7767b2cd927bb1875611602`.
  Original source records and receipts remain under `assets-source/tirana-urban`.
  Origin: latitude 41.3275, longitude 19.8188. Attribution: © OpenStreetMap
  contributors, [ODbL](https://www.openstreetmap.org/copyright).
- **Aerial cross-check:** [ASIG orthophoto WMS](https://geoportal.asig.gov.al/service/orthophoto_2015/wms?service=WMS&request=GetCapabilities),
  `OrthoImagery_8cm`, central Tirana bbox 19.816,41.325,19.823,41.330. The actual
  image was inspected. This is **2015 imagery** and shows the old square layout;
  it is historical context, not evidence to overwrite the current pedestrian
  square. It was not packaged as a game texture. No current satellite elevation
  or photogrammetry was acquired.
- **Current-square design:** [51N4E's project page](https://51n4e.com/projects/skanderbeg-square/)
  describes the pedestrian centre and planted perimeter gardens. This supports
  retaining the existing square and garden layout rather than restoring the
  old aerial photograph's traffic arrangement.
- **Street-level photographic references:** the existing licensed
  `boulevard-mature-trees.jpg` and `city-twin-towers.jpg` were visually inspected
  for canopy proportions, facade depth and street scale. Their original source
  credits remain in `public/assets/tirana-streets/references/ATTRIBUTION.md` and
  `city-buildings-attribution.json`. The boulevard source is the
  [2022 Wikimedia photograph](https://commons.wikimedia.org/wiki/File:D%C3%ABshmor%C3%ABt_e_Kombit_Boulevard_aka_Bulevardi_D%C3%ABshmor%C3%ABt_e_Kombit,_Tirana,_Albania.jpg).
- **Street View:** Google Maps loaded, but a usable Tirana street panorama could
  not be opened in this session. The eight new buildings have **not** had an
  individual Street View facade match. No Google imagery or geometry was
  extracted or redistributed.

Signals outside the original gameplay signal set are visual traffic controls
with alternating cardinal phases and all-red intervals. They do not add new
authoritative traffic-AI stopping rules. Exact survey positions of every pole,
species, shrub, sign, parking line, facade opening and rooftop remain unknown.

## Validation

- Production Vite build passed; the existing application still reports large
  bundle-size warnings.
- Targeted TypeScript checks passed for the completion layers and React preview.
- 37 tests passed across city-completion placement/assets, actual Three/GLTF
  batches and lifecycle, existing street detail, and neighbourhood runtime.
- Tests cover source ID ownership, road/building clearance, parking containment
  and holes, unknown-height exclusions, GLB hashes, collision, bounded instance
  counts, finite transforms, atlas bounds, repeated disposal and late updates.
- The portrait React + Three.js preview uses these production layers, the real
  mapped context and a compact embedded copy of the actual building GLB. It has
  three location views and a previous-detail toggle.
- Browser UI/GPU and physical-phone FPS are **unverified**: this session's cloud
  browser blocks local preview URLs. The automated runtime checks use real
  Three geometry/GLTF parsing with a stubbed text canvas, not a WebGL renderer.

Runtime caps: 900 detailed window bays, 180 balconies, 180 AC units and 180
entrances (320/50/50/50 in battery mode), 96 fixtures per model, 220 shrubs, 128 sign faces, 240 visible
parking bays and 160 road arrows. The tree layer has its existing independent
640/260 tree budget. These caps limit added scene work; they are not a measured
guarantee of a particular phone frame rate.
