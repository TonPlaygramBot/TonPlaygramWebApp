# Tirana public buildings expansion

Adds **34 building outlines at 25 sites** to the existing 15-site catalogue: 40 selectable sites, 83 catalogued building volumes, plus eight earlier institution profiles. The same geometry is used in the game and the portrait Buildings inspector. The inspector allocates and disposes only the selected site's meshes and flags.

## Geometry and accuracy

Footprints come from the OSM extracts dated 2026-09-10. Existing in-map outlines are retained exactly. Relation 6785985 supplies both Kryeministria courtyards; relation 6786176 supplies St Paul's inner court. Their holes remain open in roofs, FPS player collision and bullet rays. Replaced inner members cannot generate solid buildings or rooftop decoration. Newly modelled outlines wholly within WORLD also receive FPS collision; regional outlines never extend the driving area.

The Polytechnic uses six separately tagged buildings, including the 23 m central tower. Its university campus boundary is not a building. The Archaeological Museum and Albanology Academy share one footprint. The Orthodox annex gets a separate low model, without a duplicated dome. Its freestanding bell tower and chapel await separately matched outlines.

These are original, photo-informed game interpretations, **not identical digital twins**. Sources establish visible colors, arches, pilasters, balconies and roof forms; window counts, ornament dimensions, terrain, hidden elevations and untagged heights remain approximations. Source height provenance stays attached to every building. No Google tiles, Street View captures, satellite images or video frames are bundled; no Street View/photogrammetry survey was completed for this batch.

- Gallery: explicitly depicts the September 2014 facade. OSM marks construction with check_date 2026-07-14.
- Xheko: models the mapped lower street wing; the newer rear tower has no matched outline here.
- ABA: OSM says 83 m; CTBUH says 81 m. The model retains OSM height and discloses the discrepancy.
- MonarC: OSM six-level count retained as an estimate; the dated August 2026 image confirms the facade, not floor count. Commercial-use permission for that photo is not assumed, so it is reference-only.
- Agriculture and Infrastructure are separate, near-mirrored wings. Their distinct skyline backgrounds and opposite neighboring red buildings corroborate the photo identities.
- Tonin Harapi hall is a separate mapped volume with a simplified facade; the Jordan Misja photo depicts the school.

## Added sites

| Site | OSM ways | Reference date | Exterior reference |
| --- | --- | --- | --- |
| Katedralja Ngjallja e Krishtit | 469978008, 469978009 | 2016-09-26 | [Source](https://commons.wikimedia.org/wiki/File:Orthodox_Church_Tirana_2016_albania.jpg) |
| Katedralja e Shën Palit | 459085861 | Capture date unavailable | [Source](https://commons.wikimedia.org/wiki/File:Moderni_katolicka_katedrala_v_Tirane%2C_v_popredi_ricka_Lan.jpg) |
| Xhamia e Namazgjasë | 461375120 | 2022-12-31 | [Source](https://commons.wikimedia.org/wiki/File:Tiran%C3%AB%2C_Albania%2C_2_January_2023_-_Namazgjah_Mosque.jpg) |
| Kryeministria | 384505310 | 2014-10-10 | [Source](https://commons.wikimedia.org/wiki/File:Nd%C3%ABrtesa_e_Kryeministris%C3%AB%2C_Tiran%C3%AB._The_Building_of_the_Prime_Ministry_of_Albania._Foto_by_Dritan_Mardodaj..jpg) |
| Presidenca | 249185540 | 2016-11-05 | [Source](https://commons.wikimedia.org/wiki/File:Albanian_president.jpg) |
| Kuvendi · salla e seancave | 256162012 | 2017-12-26 | [Source](https://commons.wikimedia.org/wiki/File:Kuvendi_i_Shqip%C3%ABris%C3%AB.jpg) |
| Galeria Kombëtare · fasada 2014 | 228337575 | 2014-09-24 | [Source](https://commons.wikimedia.org/wiki/File:Galeria_Kombetare_e_Arteve%2C_Tirana.JPG) |
| Ish-Hotel Dajti · Banka e Shqipërisë | 236570684 | 2023-08-08 | [Source](https://commons.wikimedia.org/wiki/File:Hotel_Dajti_2023_01.jpg) |
| Teatri Kombëtar i Fëmijëve | 236566862 | 2024-12-16 | [Source](https://commons.wikimedia.org/wiki/File:NationalPuppetTheatreAfterRestoration.jpg) |
| Shtëpia me Gjethe | 418943098 | 2018-12-23 | [Source](https://commons.wikimedia.org/wiki/File:Muzeu_Komb%C3%ABtar_i_P%C3%ABrgjimeve%2C_%E2%80%9CSht%C3%ABpia_me_Gjethe%E2%80%9D.jpg) |
| Muzeu Arkeologjik · Albanologjia | 410328914 | 2015-06-20 | [Source](https://commons.wikimedia.org/wiki/File:Tirana%2C_museo_archeologico%2C_facciata_01.JPG) |
| Rektorati i Universitetit të Tiranës | 410328915 | Operator exterior; capture undated | [Source](https://unitir.edu.al/eng/) |
| Universiteti Politeknik · gjashtë godina | 387444374, 410277109, 410277110, 410277119, 410277120, 470298324 | 2014-04-10 | [Source](https://commons.wikimedia.org/wiki/File:Tirana_University_%28April_2014%29.jpg) |
| Ministria e Brendshme | 236566859 | Undated exterior | [Source](https://wikimapia.org/7706520/Ministry-of-Internal-Affairs) |
| Ministria e Shëndetësisë | 405763975 | Undated exterior | [Source](https://wikimapia.org/13856331/Ministry-of-Health-and-Social-Protection) |
| Ministria e Infrastrukturës dhe Energjisë | 462244352 | 2014-08-17 | [Source](https://commons.wikimedia.org/wiki/File:Tirana_-_Ministry_of_Public_Works,_Transportation_and_Telecommunications.JPG) |
| Ministria e Arsimit dhe Sportit | 356918582 | 2018-09-29T17:14:05 | [Source](https://commons.wikimedia.org/wiki/File:Ministria_e_Arsimit_Sportit_dhe_Rinis%C3%AB.jpg) |
| Ministria e Bujqësisë | 460696070 | 2018-06-10T15:44:37 | [Source](https://commons.wikimedia.org/wiki/File:Building_to_the_Ministry_of_Agriculture_and_Rural_Development_of_Albania.jpg) |
| Ministria e Financave | 460695437, 460695962 | 2019-10 | [Source](https://commons.wikimedia.org/wiki/File:Ministria_e_FINANCES_01.jpg) |
| Liceu Artistik Jordan Misja | 568915589, 854883380 | 2023-05-25T16:24:22 | [Source](https://commons.wikimedia.org/wiki/File:Liceu_Artistik_Jordan_Misja.jpeg) |
| Xheko Imperial · godina e rrugës | 400647876 | Operator exterior; capture undated | [Source](https://xheko-imperial.com) |
| MonarC Hotel | 382410981 | 2026-08-12 documentary reference; not redistributed | [Source](https://www.flickr.com/photos/kmacelwee/55515213930) |
| Kullat Binjake | 295492165, 470567604 | 2017-05-14 | [Source](https://commons.wikimedia.org/wiki/File:Twin_Towers_Tirana,_Albania_2017.jpg) |
| ABA Business Center | 449894244 | Exterior photograph; capture undated | [Source](https://www.skyscrapercenter.com/building/aba-business-center/9735) |
| Galeria ETC · European Trade Center | 535208028 | Facade contractor exterior; capture undated | [Source](https://www.metalyapi.com/projects/european-trade-centre) |

## Public identities and assets

Public ministries, museum buildings, university blocks and the school receive the existing local Albanian flag artwork. Private commerce and religious buildings do not inherit civic flags. Existing verified diplomatic tenants retain their own identities, including the EU Delegation at ABA.

Eighteen Creative Commons photographs are bundled at reduced resolution for comparison, each with author, capture date, source, license URL and SHA-256 in `webapp/public/assets/tirana-streets/references/city-buildings-attribution.json`. The Agriculture image additionally credits Fundacja Nomos / Radoslaw Botev, https://www.forumviatoris.org.pl. Nonlicensed operator and documentary references remain source links only. Photos are not applied as facade textures.

## Reproduction

Use the matching `tirana-central.osm` extract recorded by hash in `cityBuildingData.mjs`, plus the retained raw supplemental response:

```sh
python webapp/scripts/import-tirana-public-buildings.py /path/to/tirana-central.osm webapp/scripts/fixtures/tirana-city/polytechnic-geometry.json
node --test test/tiranaPublicBuildings.test.mjs test/tiranaLandmarks.test.mjs test/tiranaCitySource.test.mjs test/tiranaFpsCity.test.mjs test/tiranaMap.test.mjs
node webapp/scripts/verify-tirana-landmark-geometry.mjs
node webapp/scripts/build-tirana-landmark-preview.mjs /workspace/tirana-city-buildings-preview.html
```

The supplemental Overpass selection was `way(41.3159,19.82,41.3183,19.823)[building]; out body geom;`. Closed rings and complete referenced nodes are required; the importer fails on partial outlines. `allLandmarks.mjs` combines both independently generated datasets.

## Validation and remaining work

The complete facade layer currently uses 363 material batches and 564,854 triangles across 91 modeled buildings. The whole-catalog gate is 400 batches / 900,000 triangles; the selected-site inspector is capped at 90 batches. These are geometry budgets, not a measured phone FPS result. Geometry checks exercise every picker selection, courtyard rays, stadium opening and repeated disposal.

Production build and 52 targeted source/map/courtyard checks pass. Broader gameplay checks retain one pre-existing `online guard runs before either local career branch` source-text assertion failure in `test/tiranaStreetCareer.test.mjs`; browser-dependent operation cases are skipped without an opt-in browser run. The repository-wide TypeScript check still reports 189 pre-existing diagnostics, with no added diagnostics. Browser/device visual QA was not run. Existing map bounds, WORLD geometry, base landscaping, tree locations and cycling geometry are unchanged.

QSUT pavilions and the rebuilt Sami Frashëri/Qemal Stafa schools have useful photo references, but this batch did not obtain matched individual outlines. Queen Geraldine, Trauma, the central fire station and Sacred Heart Church need further verified current exterior work. They have not been filled with guessed buildings or stock facades.
