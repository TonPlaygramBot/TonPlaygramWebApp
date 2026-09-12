# Tirana Streets: business logos and recognizable buildings

Prepared from `main` commit `060f53e9b7245840b1e6eb07cdcd6434b1e2feec`. Sources inspected 12 September 2026. This extends the previously merged tree, pavement, flag and neighbourhood work.

## Runtime changes

- **27 additional logo brands**, taking the packaged catalog to **31**. There are **251 placements using the new brands**, and **299 logo placements overall** across the bank/hotel boards and both mapped storefront registries. These are snapshot identities, not a live occupancy survey.
- The new bank/hotel registry resolves **402 identities** from 438 source places: **231 hotel identities and 171 bank identities**. It reuses individual mapped footprints, preserves different tenants in a shared building, deduplicates matching chain aliases, and stacks same-facade boards only where the actual wall has room. The runtime has **406 business boards** including four existing catalog fallbacks. These counts do not mean 402 new buildings or 402 new brand logos; other businesses retain their mapped text names.
- **42 source/placement issues** remain explicitly recorded. A campus may describe several individual buildings, so identity counts and source-place counts are not interchangeable. There is no nearest-building substitution. Authored visual parts are excluded from source matching.
- Eight existing mapped buildings receive distinct exterior treatments, plus a separate authored rear tower at Xheko Imperial. Generic shell/facade kits and duplicate hotel labels relinquish these buildings. Schools and other institutions sharing a building keep their own names and flags.
- Each sign layer loads artwork only for brands it uses. The new bank/hotel atlas measures **2048 × 1584 pixels** in the final CPU check (below 4096). Nearby bank/hotel signs use one instanced draw, capped at 48 boards, or 24 in battery mode. The 27 PNG assets total **372,010 bytes**. The nine reference volumes use **23,088 triangles across 39 merged material draws**, with existing distance culling. This is a geometry budget, not measured phone FPS.

## Logos and provenance

Bank artwork comes from the [Albanian Association of Banks member list](https://aab.al/en/): ABI, BKT, Credins, Fibank, Intesa Sanpaolo, OTP, ProCredit, Raiffeisen, Tirana Bank, UBA and Union Bank. These are the files published by the association when retrieved; artwork age varies.

Markets use [Big Market](https://bigmarket.al/), [Conad Albania](https://www.conadalbania.al/) and [Eco Market](https://ecomarket.al/). Food brands use [Sophie](https://www.sophiecaffe.com/), and the [Toptani tenant directory](https://toptani.com.al/en/) for KFC and Burger King. Hotel logos come from the public operator pages for [Xheko Imperial](https://xheko-imperial.com/), [Rogner](https://www.hotel-europapark.com/), [Maritim Plaza](https://www.plazatirana.com/), [Tirana International](https://tiranainternational.com/), [Mondial](https://www.hotelmondial.al/), [Dinasty](https://dinastyhotel.al/en/), [MonarC](https://www.monarc.al/), [Senator](https://hotelsenator-al.com/), [Gloria](https://www.hotelboutiquegloria.al/) and [Elysee](https://hotelelysee.al/).

Exact image URLs, retrieval dates, original and packaged SHA-256 hashes, crop rectangles and dimensions are in `webapp/public/assets/tirana-streets/signs/business-sources.json`. Only blank margins were cropped; artwork proportions and colours are preserved. Xheko's SVG was rasterized. White Rogner artwork uses a dark sign backing. The logo files remain brand-owned, not CC0, and are excluded from any general license claim for original game assets. Architectural photos are references only and are not bundled or turned into facade textures. The old Lot Boutique URL was omitted because it now serves unrelated content.

## Building interpretations

| Building / source ID | Source and modeled features | Accuracy limits |
| --- | --- | --- |
| Mondial / 196893237 | [Operator](https://www.hotelmondial.al/): pale bands, arches and rooftop terrace | Six-level estimate of 19.2 m replaces the 3.2 m placeholder in both render and collision world. |
| MonarC / 382410981 | [Operator](https://www.monarc.al/): cream corner block, stone base, brown shutters, roof pergola | Mapped footprint and height retained; bays estimated. |
| Credins headquarters / 400645195 | [Bank](https://www.bankacredins.com/): turquoise walls, narrow side openings, glazed front and upper screen | Mapped height retained; concealed elevations and screen dimensions estimated. |
| Dinasty / 56015564 | [Operator](https://dinastyhotel.al/en/): stacked pale balconies, dark rails, brown columns and canopy | Irregular outline and height retained; curved balcony edges simplified. |
| Xheko Imperial / 400647876 | [Exterior gallery](https://www.expedia.com/Tirana-Hotels-Xheko-Hotel-Tirana.h2813077.Hotel-Information): arched lower podium and separate rear tower | Podium 19.2 m and tower 44.8 m are estimates. The authored tower polygon is clipped inside the parent outline and has a `visual-part/` ID, never a fabricated OSM ID. Curved bays and top crown are simplified. |
| Gloria / 357208310 | [Exterior gallery](https://www.agoda.com/en-sg/hotel-boutique-restaurant-gloria/hotel/tirana-al.html): brick walls, white pilasters, projecting glass bays and rooftop restaurant | Existing height estimate retained; roof pitch and unseen elevations simplified. |
| Senator / 405907464 | [Exterior gallery](https://www.momondo.in/hotels/tirana/Senator-Hotel.mhd2597813.ksp): ochre walls, strong white trim, narrow windows and restrained sides | Existing five-level height retained; frontage orientation and bays estimated. |
| Elysee / 295491009 | [Operator courtyard photos](https://hotelelysee.al/): stone base, pale walls, white balcony rails and vertical glazing | Courtyard views do not verify every exterior elevation. |

Exact reference image URLs are also stored alongside the building profiles. None of these models is photogrammetry, a surveyed reconstruction, or a verified current construction/permit record. The citywide tree census and per-building survey remain outside this expansion.

## Reproduction and validation

The existing OSM archive SHA-256 is `dca70c5d585b90c6c042b033bb4bfb001da8b297d7767b2cd927bb1875611602`. The generator verifies the archive and all part hashes before producing the runtime registry, coverage issues and logo counts. Geographic derivatives remain © OpenStreetMap contributors, ODbL-1.0.

```sh
node webapp/scripts/build-tirana-businesses.mjs
node --test test/tiranaBusinessExpansion.test.mjs test/tiranaNeighbourhoodRealism.test.mjs test/tiranaStreetLife.test.mjs test/tiranaNeighbourhoodRuntime.test.mjs test/tiranaCitySource.test.mjs test/tiranaPublicBuildings.test.mjs test/tiranaCanopyStreaming.test.mjs
node webapp/node_modules/typescript/bin/tsc -p webapp/tsconfig.neighbourhood.json
node webapp/scripts/run-vite-build.mjs
node webapp/scripts/build-tirana-business-preview.mjs
```

The portrait React/Three.js/TypeScript review reuses runtime meshes and offers eight building viewpoints with orbit/pinch and screen-relative panning. It embeds a limited surrounding map and relevant packaged logos, omitting gameplay and traffic. The earlier school/canopy review continues to embed its original four brands to stay below the inline file limit; the new business review contains the expanded artwork.

All 47 targeted checks passed across the seven test files above; the final bank/hotel and institution changes also passed the 13 affected checks. The neighbourhood TypeScript check and production build passed. Validation covers checksum/dimension limits, exact brand matching, source/footprint identity, shared-facade separation, roof-height limits, nested tower containment, finite geometry, material/triangle budgets, mobile atlas dimensions, nearest-label caps and disposal after late image loads, plus existing trees/pavements/flags/school regressions. Browser navigation to local previews was blocked by the environment's URL policy; GPU rendering and physical phone FPS have not been verified. Production build retains the repository's existing large-chunk warning.
