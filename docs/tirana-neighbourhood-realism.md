# Tirana Streets: neighbourhood greenery and building identities

This follow-up builds on the canopy, pavement and streaming changes documented in `tirana-canopy-and-streaming.md`. It is based on `main` at `271848bf5961e8eed59f93cdedc2b64c0e1f0aa8` and the preceding local commit `bf54b7de345eef366ebeaf8d1d1474db76b0b241`. Reference inspection date: 12 September 2026.

## What changes in the game

- **1,918 additional trees** occupy **193 mapped green spaces**: 1,903 in parks/gardens and 15 in woodland. These are estimated trunks within source polygons, not an inventory of observed trees. Roads, footpaths, existing trunks, buildings, water, sports courts, parking and construction surfaces exclude placements. Polygon holes and a boundary clearance remain empty. Existing mapped trunks retain their positions. The spatial selection and three tree detail levels retain the existing instance limits.
- **397 building identities** are associated with 308 named mapped education features; **350 identities are additions** to the central source registry. The categories are 252 school, 48 kindergarten, 86 university and 11 college building identities. These are source categories, not independently verified enrolment statistics or 397 new facade models. Existing individual outlines are used; a campus boundary never becomes a solid block. Fifteen source features have no unambiguous footprint. Private institutions do not automatically receive a national flag.
- **Five mapped building volumes** gain individually authored details from the references below. The original outlines, courtyards and render ownership remain intact. Servete Maçi's source one-storey placeholder gains a documented, estimated three-level height in both the rendering and collision world.
- Explicit source building colours and materials take precedence over the generic palette at every level of detail. The current archive supplies such finishes on 44 buildings. Low buildings and mapped educational buildings now receive first-floor windows instead of a blank wall below an unreachable 4.7 m window row. Finishes without source evidence remain estimates.
- **Flags use bundled SVG artwork**, independent readiness per country, double-sided animated cloth and a mount beyond facade details. One country's missing image no longer delays Albania's flag. The full institution sign atlas is **2048 × 4070**, below the 4096-pixel mobile texture dimension used by the regression test. There are 591 total institutional identities, of which 297 request a flag.
- Official **SPAR, Mon Chéri and Toptani** artwork joins the existing Mulliri logo. Artwork is applied only to matching mapped business names. The central storefront dataset has one matching SPAR, five Mon Chéri and eight Mulliri signs. Ten catalogued mall/hotel volumes gain identity boards; buildings without supplied artwork retain their real names as text. Placements and board sizes are authored, not surveyed. Atlas aspect-ratio handling prevents stretching the same logo across differently sized boards. The 1,319 distinct neighbourhood labels now pack into a **4096 × 3984** atlas rather than exceeding 4096 pixels in height, preserving their existing bounded instanced draw.

## Building references and limits

| Mapped volume | Reference used | Result and uncertainty |
| --- | --- | --- |
| Sami Frashëri, `relation/14761294` | [Tirana municipality reconstruction report](https://tirana.al/artikull/gjimnazi-sami-frasheri-eshte-gati-veliaj-eshte-shkolla-e-se-ardhmes-basti-i-atyre-qe-bllokojne-punet-dhe-jane-kunder-progresit-eshte-i-humbur); Google Maps gallery exterior by Ermal Rama, December 2023 | Olive wave fins, dark glazing and pale roof edges; mapped courtyard and 12.8 m height retained. This is a dated gallery photo reference, not a completed Street View survey. |
| Servete Maçi, `731114346` | [Studioarch4 project](https://studioarch4.com/portfolio_page/servete-maci-school/) and its [exterior photo](https://studioarch4.com/storage/2018/12/sm3-1-1100x889.jpg) | Pale concrete, turquoise/coral ground floor and narrow upper windows; open U-shaped courtyard. Three visible levels inform a 10.8 m estimate, replacing 3.2 m. Photo capture date and exact dimensions are unknown. |
| Book Building tower, `885643064` | [51N4E project](https://51n4e.com/projects/book-building/) and [official AZHT plan, decision 26 of 20 November 2024](https://azht.gov.al/wp-content/uploads/2025/05/HARTA-E-PLANVENDOSJES-VENDIM-NR-26-DATE-20.11.2024.pdf) | Arched bays and pale balcony details on the existing 77 m mapped volume. Project-informed, not verified as built. |
| Book companion, `885643065` | Same project and approved plan | Arched companion facade on the existing 32 m outline; hidden elevations and exact bay dimensions estimated. |
| Book podium, `885643063` | Same project and approved plan | Rectangular bays and parapets on the existing 12.8 m outline. Project-informed, not a new surveyed structure. |

The official one-page Book plan was downloaded and visually inspected. It identifies the Book Building site between 28 Nëntori and Abdi Toptani, the Clock Tower, footprints, 4/5/11/21-level portions and project renderings. It is evidence of an approved project, not proof that all depicted portions have been built. The map's July 2026 construction tag is retained in the reference metadata. Proposed trees on the plan were not imported as existing trunks.

The municipality's [planning page](https://tirana.al/faqe/planifikim-dhe-zhvillim-territori), [open data](https://tirana.al/faqe/open-data), [kindergartens](https://tirana.al/pikat-e-interesit/kopshte) and [community schools](https://tirana.al/pikat-e-interesit/shkolla-qender-komunitare), plus the ministry's [public higher-education directory](https://arsimi.gov.al/arsimi-i-larte/lista-e-institucioneve-te-arsimit-te-larte-publik-dhe-privat/arsimi-i-larte-publik/), were consulted. These pages do not supply a complete georeferenced facade model of the city. The education import derives names and footprints from the existing OSM archive; no claim is made that the ministry verified all 397 matches.

No Google photo or architectural rendering is redistributed as a texture. New facade geometry is authored from the inspected references. Logo ownership, exact retrieval URLs, dates and file hashes are recorded in `webapp/public/assets/tirana-streets/signs/sources.json`; logos are not CC0. Tree and education coverage, archive hashes and omissions are recorded in `tirana-neighbourhood-canopy.json` and `tirana-education-coverage.json`.

## Performance and checks

The existing larger streamed area remains: 1,800 m for roads/buildings and 1,400 m for canopy at normal quality. The new facades merge repeated geometry by material and use planes for shallow details. The five models together remain below the regression budget of 65,000 triangles. Road frontage selection now uses a spatial index rather than repeatedly scanning all city roads for each sign.

All 41 tests in the targeted suite passed. After the final business-atlas correction, all 17 checks in the affected realism/street-life/neighbourhood files passed, including the additional full-neighbourhood mobile-atlas regression. They cover actual tree placements against source geometry, forbidden green areas, school identity matching, independent flag readiness, double-sided cloth, courtyard holes, render/collision heights, source finishes, low-building windows, the full mobile atlas, and the existing canopy/pavement/streaming behaviour. The neighbourhood TypeScript check and production build passed. These are CPU/build checks, not measurements of phone rendering speed.

```sh
node webapp/scripts/build-tirana-neighbourhood-canopy.mjs
node webapp/scripts/build-tirana-education.mjs
node webapp/scripts/build-tirana-flag-artwork.mjs
node --test test/tiranaNeighbourhoodRealism.test.mjs test/tiranaCanopyStreaming.test.mjs test/tiranaPublicBuildings.test.mjs test/tiranaCitySource.test.mjs test/tiranaStreetLife.test.mjs test/tiranaNeighbourhoodRuntime.test.mjs
node webapp/node_modules/typescript/bin/tsc -p webapp/tsconfig.neighbourhood.json
node webapp/scripts/run-vite-build.mjs
node webapp/scripts/build-tirana-realism-preview.mjs
```

The portrait React/Three.js/TypeScript review embeds a 1.5 × 1.75 km subset with 2,194 mapped building volumes, 8,682 road segments and 3,423 trees. Sami, Servete, Book, a neighbourhood and Toptani views are selectable, with orbit/pinch and battery mode. It uses the changed runtime classes, omits gameplay/traffic and simplifies unrelated landmarks.

Browser policy rejected navigation to the local review file, so the preview was not tested on a browser GPU or physical phone. CPU geometry tests and build success do not establish device FPS. A citywide satellite trunk census and individually surveyed facades for every Tirana building remain unfinished. No merge, deployment or public GitHub write has been performed for this follow-up.
