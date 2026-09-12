# Tirana Streets: eastern neighbourhoods and Dajti

This change extends the active Street Career / Free Roam game on `main`. The
existing central coordinates and progression remain in the same metre frame.
No account balances, purchases, or payout rules are changed.

## Shipped coverage

- 1,821 additional source-footprint buildings and 22,422 additional road/path
  segments after seam deduplication. Total: 47,742 buildings / 149,566 segments.
- Playable envelope: 18.275 km × 15.580 km, approximately 285 km² (previously
  approximately 107 km²). This is an acquisition/game boundary, not a municipality.
- Sourced Farkë e Vogël, Farkë e Madhe, Surrel and Linzë settlement references;
  the existing Kinostudio coverage connects to the eastern extension.
- Walking routes reach the Dajti upper terminal and Maja e Tujanit. Driving
  routes reach Surrel and Farkë; the upper cable platform and summit are walking
  destinations, not claimed to be accessible by car at the exact pin.
- 104 complete mapped forest/wood polygons, including additional Krujë/Krrabë
  horizon coverage. Incomplete forest relations are listed in `coverage.json`.
- 43 additional mapped frontages in the eastern extract. Produce and supermarket
  Blender kits also improve already-mapped city shops. Frontages use unique
  containing footprints; the exact shop-door side is estimated. Unresolved
  businesses stay unresolved rather than being attached to arbitrary buildings.

## Terrain and performance

42 public Mapzen Terrarium tiles at zoom 12 supply a 30 m eastern grid and a
100 m wider grid. The live 60 m triangle surface and collision sampler agree.
The wider Krujë/Krrabë silhouette uses a 300 m mesh. No individual-tree accuracy
is claimed: canopy instances are distributed inside mapped forest polygons,
exclude mapped roads, and use estimated tree heights.

The pre-existing urban rectangle remains at its established flat gameplay datum.
A 900 m transition **outside** that rectangle joins the DEM. Outside that seam,
height is DEM elevation minus the sampled city datum (110.67 m). This is not a
survey-grade whole-city elevation reconstruction. DEM grid sampling, vertical
quantisation, the urban transition, estimated building heights and architectural
finishes are recorded as adaptations.

The terrain is two draws / 133,166 triangles. CPU geometry construction measured
about 440 ms in this workspace, not a phone benchmark. Nearby forest foliage and
trunks use two capped instanced draws; housing details stream through the existing
cell job queue. Distant city massing uses the 3,395 mapped buildings at least 8 m
tall instead of constructing 47,742 individual extrusions on first ascent.
The lossless 2-D delta format reduces the terrain JS payload from about 631 KiB
to 345 KiB without dropping elevation samples.

Player movement, terrain ray tests, building foundations, car entry/exit, driver
camera, vehicle presentation, human presentation, checkpoint restoration and
mountain shadows now use the same height datum. Articulated buses reserve eligible
wide-road spawn positions before ordinary traffic; expanding the graph no longer
causes startup to fail while randomly searching mostly narrow roads.

## Blender models

`webapp/scripts/blender/build_tirana_east.py` ran in Blender 4.3.2. The compressed
`.blend` is included with editable source-footprint walls and a modular library.
676 evaluated detail models include 662 convex-footprint hip roofs, traditional
shuttered windows, modern glazing, doors, three coloured campus-window variants,
modern recessed-style campus balconies, grocery frontages, gondola, terminal and
hotel massing. The game composes these with its existing footprint shells.
902 explicitly typed private houses and 21 named Qyteti Studenti footprints are
eligible for the new treatment. Concave/courtyard roofs and explicit flat roofs
are not covered by an invented convex roof. Unknown storey counts retain their
existing explicitly estimated massing.

The runtime uses Blender-exported, vertex-coloured triangles synchronously, with
no second asynchronous texture/model replacement. Close finishes remain a visual
interpretation. Photographs informed geometry and colour; their pixels are not
redistributed as game textures. Godina 15/18 use a modern bay treatment, Godina
9/10 uses the observed coloured window-frame vocabulary, and other dormitories
retain separate source heights and neutral finishes.

## Dajti Ekspres

The cable follows OSM way 103710384 (25 line vertices), including 21 explicitly
mapped pylon positions. Terminal and pylon heights, sag, station dimensions and
hotel offset are authored estimates fitted above the DEM; they are not engineering
measurements. The modelled cable has approximately 4.45 km of 3-D length after
terrain adaptation. Thirty cabins circulate; a player's dedicated cabin stays
synchronised with the simulation. Boarding uses the existing INTERACT action.
The 900-second journey matches the operator's approximately 15-minute duration.
Both directions finish with a collision-checked dismount and allow walking onward.
Pause freezes simulation time. Death cancels the ride.

## Research and provenance

- Municipality: [Qyteti Studenti dormitory renovation](https://tirana.al/artikull/perurohen-godinat-e-reja-ne-qytetin-studenti).
- WBIF: [Five renovated dormitories, 30 October 2024 inauguration](https://www.wbif.eu/news-details/energy-efficient-dormitories-inaugurated-albania).
- Photographic references: [Godina 15](https://shqiptarja.com/lajm/tirane-perurohet-godina-e-re-ne-qytetin-studenti-veliaj-punimet-me-standarde-europiane-projekti-i-lanes-do-te-behet),
  [Godina 9/10](https://shqiptarja.com/lajm/rikonstruktohen-godinat-9-dhe-10-ne-qytetin-studenti-perfitojne-600-studente).
- Traditional home reference: [Sali Shijaku villa](https://www.visit-tirana.com/locations/sali-shijakus-old-villa/).
- Contemporary Farkë typology: [Barkea Villa A, developer project image](https://dijonalbania.com/en/portfolio/barkea-resort-vila-a/).
  This is a typology reference, not proof that every mapped house has that design.
- Operator: [Dajti Ekspres technical information and journey duration](https://dajtiekspres.com/about-us/).
- Source geometry: [Dajti Ekspres OSM way](https://www.openstreetmap.org/way/103710384).
- Terrain: [AWS Terrain Tiles registry](https://registry.opendata.aws/terrain-tiles/),
  [Terrarium encoding](https://github.com/tilezen/joerd/blob/master/docs/formats.md),
  [attribution terms](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- Mountain appearance references: [Krujë–Qafë Shtamë photo](https://www.wikiloc.com/car-trails/kruje-qafe-shtame-57685117)
  and archived OSM forest masks. DEM, rather than an artist-drawn ridge, supplies
  the Krujë and Krrabë geometry.

OSM data © OpenStreetMap contributors, ODbL 1.0. Europe terrain produced using
Copernicus data and information funded by the European Union — EU-DEM layers;
SRTM/GMTED2010 courtesy of USGS; Mapzen. Attribution is also visible in the game.
Archives, acquisition timestamps, source-response hashes, caveats and Blender
metrics are under `assets-source/tirana-east/`.

## Reproduction and checks

From the repository root:

```sh
python webapp/scripts/acquire-tirana-east.py
python webapp/scripts/acquire-tirana-horizon.py
node webapp/scripts/build-tirana-east.mjs
blender -b --python webapp/scripts/blender/build_tirana_east.py -- "$PWD"
node webapp/scripts/build-tirana-east-preview.mjs
node --test test/tiranaEasternTerrain.test.mjs test/tiranaFullBodyCareer.test.mjs
./webapp/node_modules/.bin/tsc --noEmit -p webapp/tsconfig.tirana-living.json
```

The portrait React/Three/TypeScript preview uses the production terrain and housing
geometry code with a compact source subset, not unrelated mock models. It offers
house, two campus, produce, cableway, Dajti panorama, Krujë and Krrabë views.
Validation passed: 67 domain/integration tests, the Tirana TypeScript project,
the production Vite build, Blender rendering, and CPU geometry checks. Downward
rays through the actual Three.js mesh also match collision heights at all four
playable corners and on the Dajti slope (within 3 mm, allowing for the deliberate
45 mm visual offset). The build retains the repository's large-chunk warning.
Local browser verification is unavailable in this session. Actual mobile frame
rate remains unmeasured.
