# Tirana Streets: second business expansion

This extends the business and hotel work merged in #25865. It adds 33 original operator identities at 67 existing mapped boards, bringing the combined registry to **64 logo brands and 366 logo placements**. The 402 bank/hotel identities and 406 building boards remain stable. No anonymous shop receives a guessed chain identity.

## Artwork and loading

The new packaged PNGs total **132,163 bytes**, at most 256 × 128 pixels each. The sign atlas already uses 256-pixel cells, so larger downloads would add little visible detail. Transparent margins were cropped, proportions retained, SVGs rasterized, and the final PNGs use a 192-colour palette. Original and prepared SHA-256 hashes, source pages, image URLs, crop rectangles and dimensions are recorded in `webapp/public/assets/tirana-streets/signs/city-business-sources.json`.

The 33 additions cover 23 hotel identities, two shopping centres and eight retail/food/telecom identities. They include Marriott Tirana, Hilton Garden Inn, Radisson Collection Morina, Arka, Mulaj, Opera, Black Diamond, Diambe, Neranxi, Rossmann & Lala, Pizza Hut, Intersport, Adidas, Vodafone, ONE, QTU and TEG. Exact names and aliases are in `cityBusinessSignReferences.mjs`; the complete per-brand placement counts are regenerated in `docs/tirana-business-logo-counts.json`.

Residence Inn uses the independent Tirana hotel's own artwork, not Marriott Residence Inn branding. Diambe comes from its parent company's published operator reference; the image URL date does not establish current occupancy. The original logo identities and OSM locations are not a live business survey. Brand assets remain owner-controlled and are not CC0. Exterior reference photographs are not redistributed or used as textures.

`StreetLifeLayer` paints readable text first. It requests a brand only when one of that brand's signs enters the selected nearby set. A shared cache across city layers deduplicates in-flight requests, starts at most four image loads concurrently and retains at most 32 decoded images with LRU eviction. Errors leave the text intact; completed loads cannot repaint disposed/retired atlases. Image downloads at construction change from every registered brand to **zero**. Bank/hotel labels retain a 2048 × 1584 atlas and the existing 48/24 visible-board limits. This reduces startup requests; it is not an FPS measurement.

## Thirteen exterior interpretations

All thirteen existing footprint polygons remain in place. Eight one-level placeholders receive documented visual height estimates in the shared world used for collision and sign mounting. Bay counts, metric heights, hidden elevations, mounting points and some roof/wing shapes remain interpretations rather than photogrammetry.

| Building | Changes | Height treatment | Exterior reference |
| --- | --- | --- | --- |
| Black Diamond | Dark glass panel grid, glazed corner strip and tall entrance | 25.6 m visual estimate | [Operator](https://blackdiamond-hotel.com/) |
| Hilton Garden Inn Tirana | Terracotta wing, pale window frames, glazed base | Simplified 19.2 m shell; taller wings not separately reconstructed | [Operator gallery](https://www.hilton.com/en/hotels/tiagigi-hilton-garden-inn-tirana/) |
| Privilege Hotel & Spa | Pale portal walls, timber stair bay, upper terrace band | 12.8 m visual estimate including lower entrance level | [Operator](https://hotelprivilege.al/) |
| Bonsai | Timber vertical panel, green ribbed balconies, narrow stair fins | 9.6 m estimate from three visible levels | [Operator](https://bonsai.al/) |
| Residence Inn Hotel | Cream cornices, dark window guards, glazed central bay | 9.6 m estimate from three visible levels | [Independent operator](https://residenceinn.al/) |
| Chateau Linza | Stone-coloured base, white balcony frames, coral inserts | 9.6 m visual estimate for the interpreted wing | [Operator](https://chateaulinzaresort.al/) |
| Moncafe | Broad dark balcony bands, central living wall, roof pergola | Existing 12.8 m retained | [Published hotel exterior](https://www.thehotelguru.com/best-hotels-in/albania/tirana) |
| Iliria | Olive-grey bands, framed windows, dark Juliet panels | 16 m estimate including shallow upper level | [Published exterior](https://wikimapia.org/14140782/Iliria-Boutique-Hotel) |
| Opera | Pale entry cladding, tall lower windows and canopy | 38.4 m mapped shell retained; lower 6.4 m interpreted from photo | [Operator](https://hotelopera.al/) |
| Vila Verde | Lime balcony surround, green spandrels, glazed stair strip | 22.4 m visual estimate including raised entry | [Published exterior](https://www.expedia.com/Tirana-Hotels-Vila-Verde-Hotel-Tirana.h9127677.Hotel-Information) |
| Colosseo | Pale balcony rails, classical bands, upper glazing | Existing 12.8 m retained; special details clipped to 32 m around tenant anchor on shared block | [Operator](https://hotelcolosseotirana.com/) |
| Sar'Otel | Warm facade, dark balcony rails, stair windows, entrance canopy | Existing 21 m retained; lower 12.8 m interpreted from photograph | [Published exterior](https://au.hotels.com/ho480910/sar-otel-boutique-hotel-tirana-albania/) |
| Boka | Pink walls, pale cornices, green shutters and awnings | Existing four-level 12.8 m shell retained | [Published exterior](https://www.expedia.co.uk/Tirana-Hotels-Hotel-Boka.h91382451.Hotel-Information) |

Exact image URLs and uncertainty notes are attached to each entry in `cityBusinessProfiles.mjs`. The 13 models add **21,824 triangles in 65 merged material meshes**, before proximity culling. The regression ceiling is 30,000 triangles / 90 meshes. Thin cladding stays as two-triangle planes; projecting slabs and rails retain solid geometry. The reference ownership registry suppresses duplicate generic shells in both Tirana adapters.

## Reproduction and validation

```sh
node webapp/scripts/build-tirana-businesses.mjs
node --test test/tiranaCityBusinessExpansion.test.mjs test/tiranaBusinessExpansion.test.mjs test/tiranaNeighbourhoodRealism.test.mjs test/tiranaStreetLife.test.mjs test/tiranaNeighbourhoodRuntime.test.mjs test/tiranaCitySource.test.mjs test/tiranaPublicBuildings.test.mjs test/tiranaCanopyStreaming.test.mjs
node webapp/node_modules/typescript/bin/tsc -p webapp/tsconfig.neighbourhood.json
node webapp/scripts/run-vite-build.mjs
node webapp/scripts/build-tirana-business-preview.mjs --city /workspace/tirana-city-businesses.html
```

Validation covers 53 targeted checks across those suites. A below-ground spandrel found by the new geometry check was corrected; the six new checks then passed, alongside the previously passing 47 checks. TypeScript and the production build pass. The existing large-chunk build warning remains. The runtime test's optional park-furniture load has its existing Node-relative-URL fallback message.

The portrait React/Three.js/TypeScript review has 13 selectable buildings, uses the actual production facade code, and embeds 29 nearby logo brands plus surrounding roads, footprints and trees. It is a limited review area, not the whole city. Both this review and the preceding eight-building review stay below 1 MB. No source photos or online business requests are needed at runtime.

Local browser navigation was blocked by environment policy in the preceding verification attempt; it was not retried through a different route. CPU geometry, lifecycle, attribution, atlas dimensions, module bundling and production compilation were checked. GPU rendering, physical phone FPS and current on-site business occupancy remain unverified.
