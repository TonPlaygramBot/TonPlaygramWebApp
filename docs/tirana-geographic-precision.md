# Tirana geography and altitude: precision fixes

Follow-up on PR #25776. Applies to the regional-source pipeline shared by the
Tirana Streets / Racing Royal project, not a claim of completed live terrain.

## Implemented in this change

- `import_tirana_dem.py` reads a licensed local elevation GeoTIFF, verifies its
  SHA256, records its actual horizontal CRS/affine transform and explicit height
  datum, and exports a WGS84 grid with sample-centre registration. Longitude and
  latitude are passed explicitly using `always_xy=True`. Missing required CRS
  transformation grids stop the import rather than selecting a ballpark shift.
- The half-pixel offset is applied exactly once through GDAL/Rasterio's affine
  transform. North-to-south rows are preserved. Unknown heights remain null;
  partial source coverage is rejected rather than extrapolated. Source band
  scale/offset and non-metre units must be normalized before import.
- `terrainCore.mjs` provides a typed, shared absolute/scene-height sampler. It
  requires matching source/scene vertical datums. It uses the exact inverse of
  the EXISTING city projection to avoid shifting roads, lakes and buildings
  relative to WORLD. No silent switch to Web Mercator, UTM or another city frame.
- OSM acquisition/import now preserves farmland, meadows, forests, woodland,
  parks and their multipolygon holes. It also handles legacy riverbank polygons
  as areas rather than river centrelines. Bounds include lakes/landcover/buildings,
  not just road endpoints. Original WGS84 node identities are retained.
- Land-use tags never flatten terrain. An `ele` tag alone does not establish a
  lake water level or vertical datum. Both remain review requirements.

## Sources inspected on 2026-09-08

- ASIG's published MDT (2015-2017) 3D: https://geoportal.asig.gov.al/sq/node/878
- ASIG's separate DSM publication: https://geoportal.asig.gov.al/sq/node/954
- ASIG GIS service guidance mentions EPSG:6870:
  https://geoportal.asig.gov.al/sq/node/223
- Copernicus DEM product specification and EGM2008 vertical reference:
  https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- Public GLO-30 distribution and license reference:
  https://registry.opendata.aws/copernicus-dem/
- GDAL/Rasterio pixel-centre convention:
  https://rasterio.readthedocs.io/en/stable/api/rasterio.transform.html
- OSM field semantics: https://wiki.openstreetmap.org/wiki/Tag:landuse=farmland

A publicly viewable service is not automatically a redistribution license. ASIG
source resolution, coverage, vertical datum and reuse permission must be checked
on the delivered dataset, not guessed from the portal's layer name. Copernicus
GLO-30 is a DSM, not bare-earth DTM: buildings and vegetation can affect heights.
Its nominal posting is not a street-detail precision guarantee. Resampling it to
a denser grid does not manufacture more measurements.

## Reproduce the import

Install `numpy==2.3.5 rasterio==1.5.0 pyproj==3.7.2`. Supply a **local acquired**
GeoTIFF and a JSON sidecar with `url`, timezone-qualified `acquiredAt`, actual
file `sha256`, `license`, `surfaceType` (`DTM` or `DSM`), `verticalDatum` and
`units: "metre"`. The sidecar documents the input; it does not grant a license.

```sh
python tools/geography/import_tirana_dem.py source.tif source-metadata.json terrain-review.json \
  --bbox 19.740 41.270 19.945 41.405 --width 620 --height 500
node --test test/tiranaRegionalDetails.test.mjs test/tiranaRegionSource.test.mjs \
  test/tiranaRegionalValidation.test.mjs test/tiranaTerrainPrecision.test.mjs
python test/tiranaDemImport.test.py
```

The grid dimensions above are an example, not an assertion of input resolution.
Large high-resolution source windows must be tiled; the importer rejects an
oversized window instead of silently lowering the source detail.

## Validation actually run

- Node 22.16.0: **63 tests passed**, zero failed/skipped. Includes all 40 preceding
  regional tests unchanged, and 23 new terrain/geography cases.
- Python: **11 tests passed** against actual synthetic GeoTIFF files, including
  sample-centre/PixelIsPoint alignment, north/south order, no-data, source hash,
  metre units and an EPSG:6870 reprojection checked against a known height plane.
- These fixtures test the importer, NOT real Tirana terrain accuracy.

## Not completed / not changed

No actual regional DEM/DTM raster was successfully acquired in this environment.
Outbound GitHub/AWS downloads failed; the ASIG map/service pages could not be
retrieved here as usable elevation data. No new measured terrain grid is bundled.

**The active games' relief, roads, collisions, navigation, WORLD and mountain
scenery remain unchanged.** Neither this sampler nor the importer is wired into
live terrain rendering: both produce/use review data with `runtimeReady:false`.
The legacy city projection remains an approximate local frame, not a surveyed
metric CRS. A future frame migration must move every layer together.

Before enabling corrected ground in both games: acquire licensed ground data;
validate dated lake/Lana shorelines and real fields; establish the scene's height
reference; generate matching visual and collision terrain; seat buildings/roads;
model bridge/tunnel decks separately; check held-out geographic control points,
source error, seams and phone performance. Do not flatten lakes from the median
of surrounding hill heights or reshape hills to fit existing flat roads.

Full webapp build, dependency-aware typecheck, actual-game rendering, physical
phone checks and successful remote CI are NOT newly claimed by this change.
No merge, deployment, balance, networking or repository-permission change.
