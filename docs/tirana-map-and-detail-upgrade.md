# Tirana Streets map and shared detail kit

## Scope and route

This change targets main at `e434583bee5dc05fcb8cf91fbfc50897d51f650e`, where
Tirana Streets is already the combined FPS game. Its active React entry is
`games/blackwater/ui.tsx`, not the retained `tiranastreets/CityGame.tsx` sandbox.
The former active combat UI is preserved byte-for-byte as `baseUi.tsx`. A small
wrapper adds the city map without creating another engine, canvas or camera.
The retired sandbox file is NOT changed by this PR.

## Map implemented

The CITY MAP button opens a native modal dialog. The shared component renders
current WORLD roads, footprints, water and parks, not the old static map image.
It supports finger drag, anchored pinch/wheel zoom, plus/minus controls, north-up
orientation, whole-city fit, player recentering, search, dropped pins, destination
selection, route clearing, named favourites and removal. Arrow keys move the map
content in the same visible direction as dragging. Touch buttons are at least
44 pixels.

Favourites use versioned geographic coordinates and device storage, capped at
50 entries; unavailable storage is disclosed. Invalid entries are ignored.
Pins outside a later map boundary remain saved but cannot be routed to. They are
not silently moved to the city centre.

Personal directions follow the mapped road/path graph and update the ground
route in the active FPS scene. They do not teleport the player, drive a vehicle,
or change combat objectives. Disconnected destinations and pins without nearby
mapped access report an explicit failure. The line ends at mapped access rather
than cutting through buildings to a pin. This is in-game guidance, not a
real-world navigation service. The legacy drive graph has no reliable one-way
metadata; it is not represented as a road-law-compliant routing dataset.

The FPS origin is added for map coordinates and subtracted for scene routes
exactly once. Opening the map pauses/clears solo controls; closing resumes only
an operation that the map itself paused. Online play continues server-side; the
player resumes from the existing pause menu after closing the map.

## Assets implemented

`tirana-detail-kit/recipes.mjs` contains 16 original editable modules, in metres:
rooftop AC, water tank, solar heater, vent bank, roof hatch, vent stack, window
frame, balcony, shop awning, shutter, downpipe, door frame, park bench, cycle rack,
park lamp and bollard. These are original urban dressing, not new surveyed
monument replicas, photographs or downloaded Google geometry.

The active FPS city already has detailed street facades, so it receives the six
rooftop module types only. Its researched civic profiles and native landmarks are
excluded. Racing Royal receives the same roof modules plus window frames,
balconies and downpipes. Thus nine asset types are connected to live scene code;
the other seven are supplied as editable assets, not randomly placed in the lake
area. Actual placement counts on the full WORLD have not been measured here.

Placements use existing building footprints and heights. Roof anchors require
interior clearance; facade normals are independent of polygon winding. Dressing
is deterministic, grouped by building, and refreshed every 400 ms. High detail
is limited to 35 nearby buildings within 170 m; battery detail to 12 within 80 m.
Geometry is instanced by asset/material. Existing map geometry, gameplay
colliders, race rules and FPS networking remain unchanged.

## Blender workflow

```sh
node webapp/scripts/export-tirana-detail-recipes.mjs /tmp/tirana-recipes.json
blender --background --python webapp/scripts/blender/build_tirana_details.py -- /tmp/tirana-recipes.json /tmp/tirana-detail-assets
```

The Blender script creates editable collections, PBR materials, metre-scale
geometry, one GLB per asset and `tirana-urban-details.blend`. It does not fetch
third-party files. **Blender was not available in this environment, so this script
was syntax-checked but not executed, and no .blend file was produced.**

The downloadable 16-GLB review pack was exported independently using Python
trimesh from the same recipes. The current game generates geometry from recipes;
editing a separately exported GLB is not an automatic runtime replacement.
Custom Blender edits must be integrated through the project's model loader in
a subsequent asset-import change, or expressed in the shared recipes.

## Lake district: not shipped yet

The current live WORLD still ends north of the lake. No rough oval, fabricated
road or hand-positioned lake-edge attraction is added. The full source extract
could not be retrieved in this session.

The staging importer requires Tirana lake OSM way 249196321 and Grand Park
relation 3351946. It preserves every provided shoreline node and the park's inner
water holes, joins multipolygon segments by node ID, rejects incomplete ways,
retains road/path source IDs and grade separation, and records unknown heights
and unverified fixture orientations explicitly. A lake polygon alone is not
accepted as an infrastructure expansion.

```sh
node webapp/scripts/prepare-tirana-lake.mjs --fetch /tmp/tirana-lake.review.json
# Or use a saved, complete Overpass JSON extract:
node webapp/scripts/prepare-tirana-lake.mjs source.json /tmp/tirana-lake.review.json
```

This produces a review artifact only, never overwrites the live map. Actual lake
integration still requires the complete extract, client/server WORLD rebuild,
connected routing, park-hole-aware rendering, land/water collision, bridge
checks, race-route review and source-to-scene alignment. The importer does not
certify these unperformed release checks.

## References and precision

The existing `docs/tirana-fps-city.md` register documents Google Street View
observations with capture dates, including 2014/2017 imagery. This change uses
that project context and open geographic data; it does not claim a new live
Google 3D inspection or present-day street-by-street survey. Attempts to open
Google map references and retrieve the full lake extract were unsuccessful.

- Lake identity/shoreline source: https://www.openstreetmap.org/way/249196321
- Grand Park multipolygon: https://www.openstreetmap.org/relation/3351946
- Official district reference: https://tirana.al/pika-interesi/parku-i-madh-i-liqenit-te-tiranes
- Existing source/projection: `webapp/scripts/build-tirana-map.py`

OSM geometry is source-mapped, not a cadastral survey. Generic facades, appliance
positions, estimated heights and existing native landmarks remain artistic
approximations. No model/surface is labelled survey-accurate without evidence.

## Validation in this session

```sh
node --test test/tiranaMap.test.mjs test/tiranaDetailKit.test.mjs test/tiranaLakeSource.test.mjs
```

39 tests passed, zero failed. They exercise pure map transforms, persistence,
network routing, origin conversion, pause ownership, asset recipe validity,
placement limits and strict lake-import topology using labelled synthetic data.
All 16 GLB exports round-trip through trimesh with finite, nondegenerate geometry.
Five changed TypeScript/TSX modules passed transpilation syntax diagnostics.
The Blender Python script passed Python syntax compilation only.

No dependency-aware full TypeScript check, complete application build, actual
React/Three browser interaction, actual WORLD placement count, physical-phone
performance or gameplay/multiplayer regression was run here. The dependency
network and Blender runtime were unavailable. Keep the PR in draft until the
full active game and racing routes are exercised. Main and production are not
updated by creating this review branch.
