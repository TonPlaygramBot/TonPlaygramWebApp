# Racing Royal — ten roads to Parliament

Racing Royal now uses the same `FpsCity` scene layer as Tirana Streets. It keeps
six CC0 kart choices, driver/chase cameras, touch and keyboard controls, Web Audio
engine/crash/tire effects, forgiving gradual crash damage, AI, career and the
existing authoritative TPG matchmaking and stake settlement.

Every race is a point-to-point mission to the Assembly plenary building's public
forecourt approach on Rruga Xhorxh W. Bush (George W. Bush Street). This is the
mapped Assembly building, OSM way 256162012, not its separate administrative HQ.
A random departure is selected on opening the garage; players can choose or
randomize all ten missions. Career contains all ten in order.

| Mission | Departure area | Route distance |
| --- | --- | --- |
| Skënderbej | Skanderbeg Square west side | 1.51 km |
| Blloku | Sami Frashëri / Abdyl Frashëri | 1.75 km |
| Lana | Gjergj Fishta riverside | 1.61 km |
| Pyramid | Piramida / Ismail Qemali | 1.05 km |
| Nënë Tereza | Mother Teresa Square | 1.47 km |
| Myslym Shyri | Western Myslym Shyri area | 1.72 km |
| Pazari i Ri | New Bazaar area | 1.57 km |
| Toptani | Abdi Toptani district | 1.68 km |
| Farka | Eastern Tirana / Farkë approach | 8.90 km |
| Surrel | Surrel, in the hills northeast of Farka | 8.64 km |

Routes use connected OSM road segments and share the final Bush Street approach.
They preserve one metre per world unit, east +X and south +Z. They never close
across the city from the finish to the start. Street-event one-way restrictions
are ignored. Road widths are constrained to a 6.2m racing corridor. Twenty-metre
ordered progress gates and bounded arc movement reject shortcuts, teleports and
finish oscillation. The server owns movement, damage, finish order and rewards.
The race timeout is 15 minutes for the longer routes. Retired karts remain DNF.
Legacy track IDs still normalize; career credits/medals are retained, while old
circuit best times are cleared when loading the new mission save format.

## City, crowd and police

The central city retains 8,265 road/path segments and 1,377 footprints, native
landmarks, continuous pavements, crossings, signals, street furniture and the
Lana landscape. `racingRegion.mjs` adds 4,034 nearby road segments and 1,309 mapped
building footprints along the outer routes, using the same facade generator.
The FPS keeps its original world by default; Racing passes the extra geometry
into the same scene constructor. The regional map is kept outside FPS collision
and gameplay data.

Protesters reuse the Table Tennis Royal male/female Quaternius humans and five
new original, skinned Blender characters: **Edi Rama, Belinda Balluku, Erion Braçe,
Ulsi Manja and Blendi Gonxhe**. These are stylized fictional portrayals. The models
have distinct head shapes, hair/beards and clothing; no portrait image is embedded.
Near characters hold Albanian flags and use anatomical IK for windup, release and
follow-through. Distant people use baked instances of these same meshes. The
animated crowd pool is bounded to 14 and reduced in performance mode.

Eggs and tomatoes use gravity arcs, predictive aim and swept moving-kart collision.
Impacts produce shell/yolk or pulp/droplet fragments and spreading, dripping
splats. At most two side-of-visor splashes remain, clearing within 2.65 seconds.
Food never changes health, handling, progress or rewards. Crash damage remains
forgiving: impacts below 3.5m/s closing speed cause no damage; a severe hit is
capped at 14 integrity, with a 300ms cooldown. Impulse and suspension feedback
remain independent from damage.

Police form roadside lines, turn toward nearby throwers, raise an arm and use
brief short-range spray effects. At Parliament, an original Blender police water
truck aims its turret at a recent nearby thrower after a short reaction delay.
A 2.1-second water jet, spray and impact droplets play, followed by a cooldown.
The affected protester recoils and temporarily stops throwing. Police/crowd/water
are local presentation; no racer or wallet state is accepted by their response
module. Pause freezes these effects; scene changes dispose their bounded pools.

## Sources and reproducibility

- Central city source/provenance: [Tirana FPS city](tirana-fps-city.md).
- Additional streets: [OpenStreetMap Overpass API](https://overpass-api.de/api/interpreter),
  query `way[highway](41.31,19.81,41.35,19.915);out geom;`. Snapshot timestamp and
  SHA-256 are embedded in the derived region data.
- Additional buildings: [OSM map API](https://api.openstreetmap.org/api/0.6/map),
  tiled bounding boxes from longitude 19.826 to 19.915 and latitude 41.31 to 41.35.
  The published `tirana-region.json` and `tirana-routes.json` are the redistributable
  derived databases under ODbL 1.0. Visible OSM attribution is retained.
- Surrel location: [OSM node 728423562](https://www.openstreetmap.org/node/728423562).
- Assembly identity: [OSM way 256162012](https://www.openstreetmap.org/way/256162012),
  [Architecture Fund in Albania](https://tiranatriennale.com/pages/building.html?id=assembly-plenary-sessions-building).
- Portrait source pages, reuse notes and asset hashes are in
  `webapp/public/assets/kart-royale/cast/SOURCES.md` and `manifest.json`.
- Editable Blender source: `webapp/art-src/racing/tirana-cast.blend`.
  `cast-review.png` is a CPU studio render of the authored models, not gameplay.

```sh
python webapp/scripts/build-racing-missions.py roads.json buildings.json
# Blender's bpy 4.5.3 LTS module, Python 3.11:
python webapp/scripts/build-racing-cast.py --render
node webapp/scripts/generate-tirana-street-furniture.mjs
node webapp/node_modules/typescript/bin/tsc -p webapp/tsconfig.kart.json
node --test test/racingRoyalTirana.test.mjs test/racingParliament.test.mjs test/kartRoyale.test.mjs test/kartTpgMatchmaking.test.mjs test/kartStake.test.mjs
node scripts/verify-racing-scene.mjs
npm --prefix webapp run build
node webapp/node_modules/vite/bin/vite.js build --config webapp/vite.kart.config.js
```

Ordinary builds use checked-in models and derived map data. They make no map API
request and require no Blender install. Kart and crowd assets remain local, with
Scaranto/Kenney/Quaternius CC0 and flag-icons MIT attribution preserved.

## Review and release limits

The scene uses real road and footprint geometry; facades, pavement detail outside
the central kit, cast likenesses and prop placements remain authored approximations.
Terrain is planar: Surrel's actual elevation/gradients are not reconstructed. This
is not photogrammetry or soft-body destruction. Browser/WebGL rendering, sound on
physical phones, portrait touch feel and GPU/thermal performance need device review.
CPU scene construction and full simulation tests do not establish those results.

Publish client and game server together because the shared track/progress format
has changed. The standalone private preview supports AI and local career; paid
online races stay inside authenticated TonPlaygram. Stake reservations, account
binding, transactional settlement, refunds, reconnect and no-finisher handling
remain in the existing services. Run one authoritative process until room ownership
is distributed. The optional Mongo replica-set gate needs a disposable test database,
never production wallets. The GitHub draft does not itself merge or deploy production.
