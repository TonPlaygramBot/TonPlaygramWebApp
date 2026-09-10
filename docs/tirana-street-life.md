# Tirana street life and monument reference record

Researched 10 September 2026. This extends the existing map; it does not change
WORLD's origin, bounds, roads or building footprints. Public-source identities
are kept separate from artistic interpretation. This is a photo-informed game
recreation, not a survey, photogrammetric scan, or promise of identical facades.

## Included

| Feature | Count | Placement / model basis |
| --- | ---: | --- |
| Named shop, café, restaurant, bar and fast-food frontages | 348 | OSM tenant points/ways matched to an unambiguous existing street-facing wall |
| Outdoor café seating | 30 | `outdoor_seating=yes`, with enough clear pavement for the authored furniture |
| Bus-stop markers | 44 | Separate OSM source IDs, including opposite-direction stops with the same name |
| Bus shelters | 29 | Explicit `shelter=yes` and enough clear space for the model; uncertain sites retain a pole |
| Petrol-station identities | 5 | ESP & Oil (Vaso Pasha / Kavaja), EIDA (Gjergj Fishta), Kastrati (Myslym Shyri), Bolv-Oil (Hoxha Tahsin) |
| Open petrol canopies | 2 | Explicit OSM `building=roof` polygons, replacing the old solid 9 m / 21 m shells |
| Mature tree replacements | 929 | Existing mapped trunk positions, 156 along Bulevardi Dëshmorët e Kombit and 773 in/around the square's peripheral gardens |
| Roadside poster frames | 24 | Authored placements checked against roads/buildings/other fixtures; original TIRANË posters |
| Skanderbeg monument | 1 | New photo-informed sculpture with a 31,672-triangle near mesh and 3,210-triangle distant mesh |

## Source data and reproducibility

`streetSourceData.mjs` is the selected OSM source record, including version,
last-edit timestamp, retained tags and original point/ring. The source XML was
acquired on the research date; individual shop observations can be older. It
does not prove a business is still trading. Source SHA-256 is recorded in the
generated file. OSM geometry and identities are © OpenStreetMap contributors,
[ODbL 1.0](https://www.openstreetmap.org/copyright).

Run from the repository root:

```sh
python webapp/scripts/import-tirana-street-life.py /path/to/tirana-central.osm
node webapp/scripts/compile-tirana-street-life.mjs
node --test test/tiranaStreetLife.test.mjs test/tiranaNativeLandmarks.test.mjs
node webapp/scripts/verify-tirana-street-life.mjs
```

The compiler deliberately omits 718 places without an eligible, unambiguous,
non-overlapping main-street frontage. Reasons are in `omittedFrontages.json`.
Known rooftop venues and explicit non-ground levels are not painted onto ground
floors. An adjacent property is never substituted for an institution. Matching
is done at build time so phones do not repeat thousands of polygon searches.

## Photographic and operator references

The retained source manifest is `street-reference-sources.json`. Only the two
licensed reference photos below are shipped. Other images were inspected as
visual references; they are not textures or redistributable downloaded assets.

| Reference | What it supports | Limits |
| --- | --- | --- |
| [Fingalo, right-side monument, 11 June 2007](https://commons.wikimedia.org/wiki/File:07Tirana_Skenderbeg-Denkmal02.jpg) | Right foreleg raised, three hooves on the slab, rider posture, saber, cape, rough block pedestal | Historic photograph; scale and hidden surfaces interpreted |
| [CEllen, monument close view, 12 September 2017](https://commons.wikimedia.org/wiki/File:Skanderbeg_Monument_close_view.jpg) | Goat-crested helmet, beard, bridle, breast harness, draped clothing | Alternate viewing angle; not a 3D scan |
| [Ridiculopathy, boulevard, 24 June 2022](https://commons.wikimedia.org/wiki/File:D%C3%ABshmor%C3%ABt_e_Kombit_Boulevard_aka_Bulevardi_D%C3%ABshmor%C3%ABt_e_Kombit,_Tirana,_Albania.jpg) | Long exposed trunks and layered umbrella crowns on both verges | Heights and crown widths estimated; no new tree coordinates inferred |
| [BBB2021, boulevard/Lana, 31 May 2023](https://commons.wikimedia.org/wiki/File:Tirana_Bulevardi_D%C3%ABshmor%C3%ABt_e_Kombit.jpg) | Mix of tall upright and umbrella forms | Not species identification for every tree |
| [51N4E, Skanderbeg Square](https://51n4e.com/projects/skanderbeg-square/) | Twelve perimeter gardens, layered planting, shaded edges and open central paving | Individual tree ages/heights unmeasured; pre-renovation gallery image excluded |
| [Tirana Bank, Green Terraces](https://www.tiranabank.al/eng/d/580/green-terraces-tirana-bank-contributes-to-the-the-greenery-of-the-capital-city) | Slim shelter structure, shallow roof, glazed sides and slatted benches | A particular 2021 sponsored installation; green roofs not generalized to all stops |
| [Sophie locations](https://www.sophiecaffe.com/en/locations/), [Mulliri locations](https://mullirivjeter.al/coffee-shops/) | Operator identity and listed branches | OSM point matching controls placement; photo of one branch does not establish every branch's exterior |
| [Historic Eyes of Tirana hoarding](https://www.imera.fr/en/housing-transformation-in-post-communist-albania-insights-from-smoki-musarajs-article-for-the-american-anthropologist/) | General street advertising construction/form | June 2019 imagery cannot establish a current billboard position |

Shipped derivatives: `skanderbeg-side.jpg` resized from Fingalo's original,
[CC BY-SA 2.0 DE](https://creativecommons.org/licenses/by-sa/2.0/de/);
`boulevard-mature-trees.jpg` resized from an inspected public display capture of
Ridiculopathy's photograph,
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Both retain their respective licenses; credits appear beside the review images.

No Google Street View or satellite imagery is redistributed. Public photos and
OSM were sufficient for source-backed placement and visible design cues, but
not for survey-level dimensions. No licensed exact Skanderbeg 3D scan was found.

## Interpretation and remaining precision limits

Facade bays, glass, awnings, palettes and signs are original category models,
with branch names rendered as text rather than copied corporate logos. Mulliri
and Sophie references informed broad visual cues, not measured branch-by-branch
facades. Fuel pump arrangement and the 4.15 m canopy height are estimates;
BOLV's green/white reference is from another station. No live prices, bus routes,
departure times, opening hours or readable monument inscriptions are invented.

Tree positions are unchanged. Existing measured dimensions take priority;
unmeasured boulevard trees use approximately 13–17 m umbrella forms or 20–26 m
upright forms, with crown width scaled independently. Shape selection is an
interpretation when species tags are absent. Square models vary from 5–12 m.
The code does not scatter extra trunks over the central paved square.

Advertising queries did not produce usable mapped ad points. All 24 new poster
locations explicitly say `authored roadside fixture` in the catalog. Historical
construction signs and obsolete “coming soon” advertisements are not copied.

## Integration and validation

Both city renderers exclude replaced small-tree models and the two solid fuel
shells. Source frontages exclude earlier fictional shop kits. Mapped bus stops
replace the inferred bus-shelter placements in shared street dressing; physical
backs, supports and benches leave their entrances open. Fuel obstacles use
the same support/pump/roof geometry in the driving and FPS metre frames.
Race-ribbon exclusions apply when constructing the new visual layers.

Street geometry uses four instanced draws with a deduplicated sign atlas.
Tree geometry uses sixteen instanced draws across four forms and two distance
levels, limited to 640 nearby trees / 260 in battery mode. Detailed leaf cards
are limited to 96 trees within 65 m. Material and geometry resources dispose
once; there are no asynchronous loads in these layers. This is a CPU/geometry
budget, not a claim of a measured phone frame rate.

The **STREETS** tab in the expanded city map contains nine portrait-friendly
views of the actual street/tree/native-monument layers. Background shells are
simplified in this inspector. Gameplay camera, input axes, player positions,
map bounds and the original `BaseWorldEnhancements.ts` remain unchanged.

Additional exact matching needs dated exterior photos or licensed scans of the
specific branches, surveyed heights and current advertising locations. Browser
visual QA was not run during this change.

Validation at delivery: production build passed; 103 selected feature/regression
tests passed; the actual THREE layer verifier passed all nine viewpoints,
atlas bounds, tree ownership, disposal and race-ribbon exclusion. The wider
integration suite still fails its unchanged lobby `localActivityURL(item.id)`
source-string assertion. TypeScript reports the same 189 existing diagnostics
as the base branch, with no new diagnostics from this change.
