# Tirana city source data

Geography © OpenStreetMap contributors, available under the Open Database License
(ODbL) 1.0: https://www.openstreetmap.org/copyright .

`sourceData.mjs` is a filtered derivative of the source URL recorded in its metadata.
It retains original node/way identity, version, edit timestamp and relevant tags.
The download completion time and SHA-256 identify the input used by
`webapp/scripts/import-tirana-city-details.py`. The raw response is not required at
runtime. No Google imagery, tiles, video frames or photogrammetry is distributed.

OSM data is not a survey and can contain stale identities. Missing heights,
widths, crown sizes, species and facade details are not verified measurements.

`landmarkData.mjs` is a second ODbL derivative containing the regional building footprints, stadium relation rings and Taivani fountain from the 2026-09-10 extracts. It records source file hashes and height provenance; see `docs/tirana-landmark-expansion.md` for selections and reproduction.

`cityBuildingData.mjs` adds 34 ODbL building outlines and relation holes. `allLandmarks.mjs` combines the two datasets. The supplemental raw Polytechnic response is retained in `webapp/scripts/fixtures/tirana-city/polytechnic-geometry.json`; see `docs/tirana-public-buildings.md` for source selections, limitations and reproduction.

`businessSites.mjs` is an ODbL derivative of the archived Tirana OSM source,
with exact identities, matched footprints and documented placement omissions.
See `docs/tirana-business-expansion.md` and `docs/tirana-business-coverage.json`.
`businessBuildingProfiles.mjs` contains authored facade interpretations and one
explicitly labeled, estimated visual building part; it is not surveyed OSM data.
Brand artwork is separately identified in
`webapp/public/assets/tirana-streets/signs/business-sources.json`; it remains
brand-owned and is not covered by any CC0 claim for original game assets.
