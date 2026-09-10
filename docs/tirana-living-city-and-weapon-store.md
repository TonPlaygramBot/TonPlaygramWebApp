# Tirana Streets living-city and weapon-store architecture

## Audit and integration

The upgrade extends the existing OpenStreetMap-derived `WORLD` road/footway graph, deterministic `engine.mjs` simulation, pooled `CityRenderer` actors, `LivingVisuals`, street-detail GLB, regional shopfront layer, and environment enhancement layers. It does not replace the Tirana map, missions, career, combat, driving, flight, room snapshots, or portrait controls.

## Existing living city

Pedestrians are generated on mapped `walk` segments and park polygons. The current cast includes ordinary citizens, children, cyclists, dog walkers, café guests, police, soldiers, gangs, and the Arben shopkeeper. Nearby characters use the shipped Adobe/Mixamo human GLB and animation clips; palette/accessory variation is applied by `LivingVisuals`. Simulation is deterministic for network snapshots. Rendering sorts by player distance, caps animated actors, culls distant actors, throttles far animation, reuses loaded geometry, and retires pooled clones.

Civilian, taxi, sedan, sports sedan, city-car, motorbike, police and military-SUV assets are reused from the existing Tirana asset registry. Traffic follows the OSM road graph, selects connected nodes at junctions, maintains headway, reacts to shared traffic-signal phases, and is culled beyond the selected quality radius. Emergency service variants share that simulation rather than duplicating it.

## Environment

The integrated enhancement stack supplies PBR asphalt/pavement/grass materials, modeled curbs, crossing and lane recipes, synchronized traffic lights, correctly oriented road signs, street lights, benches, bins, bollards, planters, bus stops and bicycle racks. Repeated props and vegetation use merged or instanced geometry. Shopfront/café recipes add awnings, shutters, fictional signs, terraces, tables, seats and aligned social groups.

Vegetation zones are based on the existing OSM-derived geography. Both Lana banks form a continuous green corridor; Grand Park/Artificial Lake uses denser trees, shrubs and grass; Dajti uses progressively cheaper forest layers; street trees use road-edge offsets and building/road exclusion tests. Ground materials distinguish urban lawn, park, riverside and mountain cover.

## Original walk-in weapon store

`WeaponStoreInterior` places an original open-front TonPlaygram shop at the existing Arben interaction point. It contains a floor, three walls, counter, display wall, shelves, seven physical displays, shopkeeper position and local lighting. The open threshold keeps the existing player controller and city scene active. The Arsenal overlay is portrait-safe and can only purchase while the player is on foot, alive, nearby and not wanted.

`weaponStoreCatalog.mjs` is imported by both WebGL client and Express backend. It is the only authority for item availability, delivery weapon id, 3D model URL and TPG price:

| Weapon | Price |
| --- | ---: |
| Glock Sidearm | 850 TPG |
| Uzi Spray | 1,750 TPG |
| AK-47 Volley | 2,500 TPG |
| KRSV Burst | 2,850 TPG |
| Tactical Shotgun | 2,200 TPG |
| Mosin Marksman | 3,400 TPG |
| Grenade Launcher | 4,800 TPG |

## Authoritative TPG transaction flow

The client sends only catalog item id and an idempotency key. `POST /api/tirana-store/purchase` requires the existing authentication middleware, resolves the authoritative catalog price, and performs one conditional MongoDB update that checks sufficient `balance`, prevents ownership duplication, debits TPG, adds the inventory unlock, and appends a delivered ledger transaction. A repeated idempotency key returns the original result without charging again. Insufficient balance, duplicate ownership, invalid item, missing account and network errors have distinct responses. Only a successful server receipt is mirrored into the active local run; persistent ownership and balance remain server-owned.

## Quality and performance configuration

The existing `auto`, `high`, and `battery` tiers control DPR, shadows, pedestrian caps, vegetation counts and render radii. Battery mode also disables the store point light. Low/battery retains nearby citizens, traffic and dressing rather than emptying the city. Population, simulation and visual work remain bounded by distance, actor pools, instancing/merging, shared textures/geometries, frustum culling and lazy GLB loading.

## Assets and attribution

No new third-party binary assets were introduced. The store is original runtime Three.js geometry. Existing human/weapon GLBs retain their Adobe Mixamo and Quaternius attribution; existing vehicles retain Kenney/Quaternius attribution; street kit and ambientCG surface licenses remain documented under `webapp/public/assets/tirana-streets/ATTRIBUTION.md`, `living/ATTRIBUTION.md`, and `materials/sources.json`. Geographic placement remains © OpenStreetMap contributors under ODbL 1.0.

## Known limitations

The store uses an open-front seamless interior rather than door animation. Display meshes are deliberately low-cost silhouettes while thumbnails and held weapons use the shipped GLBs. MongoDB transaction behavior requires the deployed database and authenticated TPG account; automated tests cover catalog validation, while a physical portrait device and production database purchase should be included in release QA.
