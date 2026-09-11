# Real geometry import and Blender authoring

This follow-up to merged PR #25845 fixes source-data omissions. **It does not
deliver the requested full playable Tirana reconstruction.** No regional OSM
extract, DEM, new Blender scene or new glTF city assets were acquired/generated
in this environment. Existing game geometry still covers the central district.

## What this change implements

- Acquisition includes building multipolygon relations, building parts and all
  office types, including private companies. Roads retain private access and full
  tags; unspecified access remains unknown instead of being assigned `yes`.
- Building relations retain their multiple outer rings and courtyard holes.
  Relation outlines do not become duplicate independent buildings. Building
  heights, levels, roof tags, minimum heights, names and addresses retain source
  provenance. Unknown heights are not converted from a random floor count.
- Local `.osm` XML and `.osm.pbf` file selection preserves complete objects and
  recursive relation references across the collection envelope. It retains a
  road crossing the envelope even if both endpoints are outside. Bounding-box
  overlap can retain extra geometry; this is not an administrative boundary clip.
  Private roads and buildings are not filtered out. The original input SHA-256
  remains in the selected JSON alongside the subsequent review-input hash.
- Blender input groups whole buildings into 500 m authoring tiles without
  simplifying their vertices. Courtyard roof triangulation retains open holes.
  Road source linework is batched per tile, preserving node and way identities.
- The Blender script writes editable `.blend` files and separate glTF files with
  shared **existing** Poly Haven plaster diffuse, OpenGL normal and roughness
  maps. It checks the repository's CC0 source receipts and hashes, uses sRGB for
  diffuse and Non-Color for data maps, and applies 4 m UV repeats to wall surfaces.
  These are generic material proxies, not measured facades for individual sites.

The authoring scene explicitly uses an unresolved, flat review plane. It is not
terrain. Unknown-height buildings stay footprint linework. Heights in OSM are
source tags, not a guarantee of surveyed accuracy. Pitched roofs without eave/
roof measurements stay unresolved; no guessed gable is generated. Only an
explicit flat roof without additional roof height receives a roof cap. Building
parts remain separate source records for subsequent outline/part reconciliation.
Roads stay centerline linework because tagged width alone cannot resolve grades,
bridges or tunnels. No runtime loader or collision expansion is activated by
this authoring command.

## Run with a supplied source extract

The [official Geofabrik Albania page](https://download.geofabrik.de/europe/albania.html)
offers the complete Albania OSM PBF extract. The page was accessible on
2026-09-11; the actual download was blocked by the cloud browser URL policy.
No alternative route around that policy was attempted. The selected envelope is
19.680–19.980 E, 41.240–41.460 N; it covers the requested named areas but does not
prove all real-world buildings are present in OSM.

Run from the repository root, with dependencies installed in the normal authoring
environment. PBF reading uses [pyosmium](https://docs.osmcode.org/pyosmium/latest/user_manual/01-First-Steps/);
XML reading has no third-party Python dependency. The selection pass holds the
extract in memory, so use a desktop/authoring machine, not a game client.

```sh
python -m pip install osmium
python webapp/scripts/tirana/read_osm_extract.py /data/albania-latest.osm.pbf /data/tirana-source.json
node webapp/scripts/import-tirana-region.mjs /data/tirana-source.json /data/tirana-review.json https://download.geofabrik.de/europe/albania-latest.osm.pbf ACTUAL-ACQUISITION-ISO-TIMESTAMP
node webapp/scripts/prepare-tirana-blender.mjs /data/tirana-review.json /data/tirana-blender.json
blender --background --python webapp/scripts/blender/build_tirana_region.py -- /data/tirana-blender.json webapp/public/assets/tirana-streets /data/tirana-authoring
```

Replace the timestamp with the actual acquisition time. Keep the original source
file and receipt. Do not substitute the current time for an unknown acquisition
time. The exporter requires a fresh destination and marks incomplete runs with
an `.incomplete` directory. Its manifest retains `runtimeReady:false`, the
unresolved datum and counts of missing dimensions. Objects use the existing WORLD
origin and projection; this local approximation is not a survey-grade CRS.

## Validation and remaining blockers

Executed locally: 91 Node tests across the existing regional/atlas/career/panorama
suites and the new source/Blender-input suite; 4 Python source-selection tests;
Python syntax compilation. Tests cover courtyard area and roof normals, unknown
heights/roofs, geographic tile reconstruction, private tags, cross-boundary roads,
recursive references and missing-member failures. Fixtures are synthetic test
data and are not exported as Tirana assets.

**Not executed:** PBF parsing with pyosmium, Blender import/export, glTF viewer
validation or any full-city/phone performance check. Blender/bpy is absent and
the available Python package index offered no installable bpy distribution for
the attempted version. A syntax check is not an export validation.

To complete the user request, first supply the regional extract and a licensed
terrain elevation dataset with its coordinate and height datum. Then reconcile
building parts and missing heights/facades against suitable source data, generate
and inspect the actual Blender/glTF assets, connect streamed geometry to the
shared renderer/navigation/collision world, and verify routes to Rinas, Vaqarr,
Sauk, Farkë and Dajti in both game modes. The Dajti panorama requires real terrain
and coastline/visibility validation before it can be called geographically exact.
