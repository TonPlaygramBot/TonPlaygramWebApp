# Tirana Streets: apartment details and entrance corrections

Work in progress against `main`, 12 September 2026. This is a partial implementation of the requested city realism update, not a completed city survey or district expansion.

## Implemented

- 232 existing mapped apartment footprints receive authored aged plaster/exposed-brick finishes. The material combines the already bundled CC0 [Poly Haven plaster](https://polyhaven.com/a/plastered_wall_02) with an analytic brick/chipped-plaster shader; it is not a photograph of these buildings.
- 1,378 cylindrical rooftop tanks across these footprints: 5–7 per building, stable between reloads, placed inside the roof with clearance from edges and courtyard holes. Supports, tank bands, lids and short pipes are merged by material.
- Window frames, sills, selected balconies, condenser bodies, fan discs, grilles and brackets. Approximately 95% of authored window bays have an AC unit. These quantities follow the requested visual direction; they are not measured inventories.
- Both the FPS and legacy/street renderers own the same apartment-detail class. The FPS attachment also serves the existing social exploration view. Existing collision footprints remain intact.
- Kryeministria now selects the exterior boulevard frontage before wall length, merges its contiguous source segments, and places the triple entrance/balcony towards the southern portion. This prevents the longer recessed wing from being mistaken for the entrance. Door grids, balcony sides and broader steps use photo-estimated dimensions.
- The municipality receives a framed corner doorway, triangular pediment, metal door ornaments and steps based on the existing dated photograph.
- Rogner receives a glazed main entrance and projecting canopy aligned to [OSM entrance node 6498475597](https://www.openstreetmap.org/node/6498475597). Its original curved footprint remains. Canopy dimensions are authored estimates, not a measured replacement model.

## Construction dates are not established

The current source tags supply **no construction dates for the 232 selected buildings**. Every current selection is explicitly `typology-estimate`, using residential/apartment use, 3–7 levels, compatible roof and usable roof area. The classifier excludes known post-1990 dates, pre-1945 dates, institutional/hotel/commercial uses, construction, pitched roofs and building parts. A matching future construction-date tag will be recorded separately as `source-date`.

OSM edit timestamps are never interpreted as construction years. A complete inventory of all communist-era buildings is still outstanding; some selected buildings may be newer. This classification requires photographic/cadastral review before it can be described as historical identification.

## Performance and ownership

Only the nearest 24 buildings within 260 m are detailed (12 within 150 m in battery mode). Models are merged into five material batches each; at most 36 building models are retained. Distance selection updates at 4 Hz. There are no per-window lights or animations. The original simple shells remain as distant massing. These are configured budgets, not measured phone FPS guarantees.

The neighbourhood renderer suppresses its generic windows only for non-racing profiles where the apartment layer is present. Racing's neighbourhood windows retain their prior behaviour. Resource disposal is idempotent, including late texture loads. Apartment detailing does not change simulation bounds, navigation, career state or multiplayer.

## Sources inspected

- [Bashkia Tiranë](https://tirana.al/), [schools](https://tirana.al/pikat-e-interesit/shkolla), [kindergartens](https://tirana.al/pikat-e-interesit/kopshte), and [Kosova school reconstruction](https://tirana.al/artikull/rilind-shkolla-kosova). The category pages did not establish a complete building-by-building inventory.
- [Ministry of Education](https://arsimi.gov.al/) and [Prime Minister's Office](https://kryeministria.al/). Visiting these sources does not establish measured school/entrance geometry.
- [Rogner official site](https://www.hotel-europapark.com/): boulevard location and Mediterranean garden context. Existing dated repository photographs were visually inspected for Rogner, the municipality and Kryeministria. Their attribution remains in the existing profiles/catalog; no new third-party image is redistributed.
- Existing OSM footprints and source tags: © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright).

## Still required for the full request

- [ ] Verify the historical apartment inventory against dated building records and exterior references.
- [ ] Obtain and link the full official schools, kindergartens and new-building inventory to unambiguous real footprints, then author source-specific facades.
- [ ] Acquire, validate and commit complete source geometry for Kombinat, Astir, the Lake area and Sauk, including connecting roads.
- [ ] Extend playable bounds, source-identity navigation, collision and water/terrain handling, with continuity tests. **This PR does not expand the playable map.**
- [ ] Complete Rogner's source-specific hotel/garden reconstruction and visually compare all three corrected entrances in the game.
- [ ] Full application build, live gameplay, portrait-browser and physical-phone memory/FPS checks; in-chat preview remains outstanding.

## Validation

`node --test test/tiranaAgedHousing.test.mjs test/tiranaPublicBuildings.test.mjs test/tiranaCitySource.test.mjs`

The new tests exercise construction-date exclusions, every selected roof's actual geometry, tank separation/courtyard clearance, real Kryeministria frontage selection, actual Three.js model construction, AC density, visibility/cache caps and resource disposal. The three edited/new facade renderer modules also pass dependency-aware TypeScript checking. These checks do not establish that the GPU shader or the entire game has been visually verified.
