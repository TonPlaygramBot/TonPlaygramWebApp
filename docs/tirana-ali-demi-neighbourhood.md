# Tirana Streets: Njësia 2, Ali Demi and Qyteti Studenti

The previous regional work supplied source import tools and distant scenery, while the playable road/building dataset still ended at the central district. This change imports six real OpenStreetMap neighbourhood extracts into the shared gameplay world and adds actual Blender exports at mapped sites.

## What is included

| Data | Added in this change |
| --- | ---: |
| Building footprint records | 4,298 |
| Road/path segments after central overlap removal | 14,530 |
| Mapped places retained for search/review | 2,301 |
| Source-linked storefront placements | 190 |
| Blender building models | 4 |
| Reusable Blender storefront models | 7 |
| Covered UKT reservoir outlines | 3 |

The shared world now contains 5,675 footprint records and 22,795 road/path segments. Segments are consecutive OSM-node pairs, **not distinct streets**. Buildings can include building parts and multipolygon components, so these counts do not establish that every physical property is mapped.

The original central coordinates, footprint/road arrays, mission locations and graph prefix remain intact. Bounds expand from `[-805,-380,660,1150]` to `[-805,-380,2642.94,3093.56]` in the existing east/south metre frame. The source envelopes cover Njësia 2, Todi Shkurti/ish Tregu Elektrik, Ali Demi, Grand, Pjetër Budi and much of Qyteti Studenti. Tile filenames are acquisition labels; `flabina.osm` is **not** evidence identifying a school building.

## Source identity and visual evidence

| Site | Geometry / place identity | What was verified; what remains authored |
| --- | --- | --- |
| Njësia Administrative Nr. 2 | OSM way `1227869701`, node `10950616148` | Municipality address and a March 2023 Maps photo: yellow two-storey facade, white window bars, entrance/ATM context. The 7 m height, bay spacing and unseen sides are estimates. |
| Bar Britaniku, Todi Shkurti | OSM way `682723386`, node `6824084784` | July 2020 Maps ground photo: dark glazing frames and red awning. OSM tags the containing apartment building as 11 storeys. The tower facade is a generic interpretation, not a verified photograph of every floor. |
| Kompleksi Grand | OSM way `548100908` | Actual irregular footprint, nine tagged storeys, existing project reference research for green bands/pink surrounds. Storefronts include Farmaci Grandi, Berber Grandi and AnnA Market. Balconies, window rhythm and 28.8 m height are authored estimates. |
| Spitali Amavita | OSM way `548098442` | Source hospital identity, Pjetër Budi address and four tagged storeys. Generic clinic facade; no complete exterior photo survey. |
| Depozitat e ujit UKT, Ali Demi | OSM ways `461382518`, `461382620`, `461382635` | Published `man_made=reservoir_covered` outlines and UKT operator. Surface covers follow these outlines on the existing flat datum; no invented tank depth or internal systems. |

References reviewed on 2026-09-11:

- [Bashkia Tiranë, Njësia Nr. 2](https://tirana.al/njesia-administrative/njesia-nr-2/info): Rruga Petro Nini Luarasi, former Shtëpia e Rinisë.
- [Bashkia Tiranë, Njësia Nr. 1](https://tirana.al/njesia-administrative/njesia-nr-1/info): Ali Demi public-area context.
- [Njësia 2 Maps listing](https://www.google.com/maps?cid=13402915096727283990): dated exterior gallery photo reviewed visually.
- [Britaniku Maps listing](https://www.google.com/maps?cid=7252632064735531134): dated ground photo reviewed visually. Maps and OSM place pins differ by roughly 21 m; the OSM point and uniquely containing footprint govern placement.
- [Britaniku restaurant reference](https://www.youtube.com/watch?v=xMtmqJyzsM8): Todi Shkurti address.
- [Grand reference](https://wikimapia.org/14185230/sq/Kompleksi-Grand): existing project exterior research.
- [Former Flabina area listing](https://duashpi.al/en/profile/67406bbd4441f2f98b0e82e2/lejla-next-door.html): Pjetër Budi / Qyteti Studenti. This establishes an area, not a verified footprint. The [older Wikimapia entry](https://wikimapia.org/8081920/Kolegji-Flabina) is explicitly tentative and about 16 years old. No unrelated school is renamed Flabina.

The Maps gallery offered a “Street View” labelled thumbnail which opened a dated ground photo. A navigable street panorama and a complete satellite facade survey were **not** obtained. Google images are not copied into the repository or used as textures. Coordinate geometry comes from OSM, not traced Google pixels.

## Reproducibility and accuracy

`assets-source/tirana-neighbourhood/source.osm.json.gz` contains 81,930 unique normalized OSM objects. Acquisition URLs, six bounding boxes, UTC times and original XML SHA-256 receipts are retained in the archive and `source-receipts.json`. Contributor usernames/UIDs and changeset identifiers were removed; object IDs, versions, edit timestamps, tags and geometry references remain. Overlap conflicts were rejected. All 13 selected building/water multipolygon relations had complete referenced members.

Run from the repository root:

```sh
node webapp/scripts/build-tirana-neighbourhood.mjs
blender -b --python tools/blender/tirana_neighbourhood.py
python3 tools/blender/pack_neighbourhood_textures.py
```

The committed editable `neighbourhood.blend` was built and exported with **Blender 4.2.9 LTS**, not generated by a substitute GLB writer. It contains 11 named collections and packed source materials. Source footprints use the established local metre projection and 1 cm rounded coordinates; this is not a survey-grade CRS.

Height provenance is explicit: 3 new records have OSM heights; 2,282 use OSM storeys × 3.2 m; 2,012 have unknown heights and display one-storey 3.2 m placeholders; Njësia 2 uses a two-storey, 7 m visual estimate. The full source tags remain available. No random extra floors are presented as measured geometry.

Storefronts use a unique containing building, a sufficiently wide source wall, and non-overlapping frontage slots. There are 52 markets/food shops, 12 pharmacies, 16 barbers, 3 produce shops, 102 cafes/restaurants/bars, 2 civic services and 3 clinics. Category geometry is reusable and approximate. The nearest wall is an authored frontage estimate; a POI pin does not identify a surveyed doorway. Another 225 candidates remain as mapped places because their footprint or facade placement is ambiguous/overlapping.

## Gameplay and rendering

- Source node IDs define the new road graph. Matching an entire duplicated road segment proves central seam correspondence; nearby or coincident unrelated crossings are not joined. New driving edges preserve tagged one-way direction and exclude private/no motor access. Original core direction rules remain unchanged.
- New bridges/tunnels/elevated roads retain source metadata, but are excluded from navigation because the current game has no surveyed grade surface. Underground roads are not drawn on top of the ground. This remains a flat city expansion: it does not implement measured Dajti slopes or full Tirana/Rinas/Farkë coverage.
- Multipolygon courtyards stay open in rendered shells, map paths, street collision/sight lines and FPS collision coordinates. Building minimum heights are retained. New waterway segments use a spatial collision index, and standalone water polygons preserve holes.
- A single shared layer renders new source shells in 240 m cells. Window planes are nearby-only; untagged-height placeholders receive no invented upper-floor window rows. Prior generic facade kits are excluded from new footprints.
- Four Blender hero buildings load near the player, replacing their fallback shell only after successful load. Seven instanced storefront kits share textures and use at most 48 nearby placements (24 in battery mode), plus one name atlas. Async completions after retirement are disposed.
- All 11 GLBs total 4,462,500 bytes. Three shared 1K PBR images total 609,736 bytes. The full editable Blender file keeps the packed 2K originals. The runtime uses same-origin files without Draco or external model services.

## Review and validation

The portrait React + Three.js inspection page is `webapp/tirana-neighbourhood-review.html` when running Vite. It uses the same GLBs and frontage coordinates as the game, with all-direction orbit and touch zoom. This developer review entry is separate from the normal production app entry.

```sh
node webapp/scripts/build-tirana-neighbourhood-preview.mjs
blender -b assets-source/tirana-neighbourhood/neighbourhood.blend --python tools/blender/render_neighbourhood.py
node --test test/tiranaNeighbourhood.test.mjs test/tiranaNeighbourhoodRuntime.test.mjs test/tiranaMap.test.mjs test/tiranaRegionSource.test.mjs test/tiranaBlenderSource.test.mjs test/tiranaGrandCircuits.test.mjs test/tiranaCityLife.test.mjs test/tiranaStreets.test.mjs test/blackwater.test.mjs
webapp/node_modules/.bin/tsc -p webapp/tsconfig.neighbourhood.json
```

The embedded conversation review uses 1 cm quantization and 256 px textures to fit its transfer budget; game assets are unchanged. Blender CPU renders were inspected for Njësia 2, Grand and the produce frontage. Automated checks cover source integrity, actual source routes to three focus areas, false crossing rejection, one-way edges, courtyard collisions, source-bound frontages, GLB/PBR hashes, actual GLTF geometry decoding, instance budgets and late-load disposal. Canvas text is stubbed in the Node lifecycle test; that test is not a WebGL browser benchmark. A focused Vite production build compiles the street renderer, FPS renderer, shared enhancements and portrait review.

Recorded result on 2026-09-11: **95 tests passed, 0 failed** across the nine suites above; focused strict TypeScript passed; focused Vite build passed; `git diff --check` passed. The Vite build reports a large shared geography chunk (about 1.48 MB gzip including the existing registry). Geometry remains locally available for deterministic gameplay; this is a remaining initial-load cost to measure on phones.

Remaining review limits: no physical-phone performance measurement or live-game browser run in this environment; no complete exterior survey; no verified Flabina building pin. These limits should guide the next source refinement, rather than representing the imported area as a complete photoreal reconstruction.
