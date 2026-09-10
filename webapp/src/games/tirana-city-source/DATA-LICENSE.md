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
