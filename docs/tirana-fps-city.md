# Tirana Streets — combined FPS city

Tirana Streets is the single catalog entry. `/games/tiranastreets/lobby` offers
MK18 / MP9, Recruit / Veteran, free solo operations and 2–4 player TPG rooms.
The `/games/blackwater` URLs redirect to the corresponding Tirana Streets URLs,
including their query strings. Existing `blackwater:` socket events, table types,
stake records and reconnect storage are retained for compatibility. Publish the
client and server together because they share the new city collision layout.

The game uses Blackwater's input, weapons/hands, humanoid opponents, recoil,
reloads, audio, damage, wave progression, upgrades, extraction and authoritative
online match simulation. It uses one renderer, camera and animation loop.
Tirana's legacy driving sandbox source remains available for reference; it is
no longer the primary game route.

## City and performance

- All 8,265 road/path segments and 1,377 OSM building footprints retain their
  coordinates and metre scale. East is +X; south is +Z. The previous Blackwater
  translation is applied once. The initial operation is in Skanderbeg Square.
- `FpsCity.ts` replaces repeated Blackwater building archetypes with extruded
  Tirana footprints, district palettes, individual windows, balcony rails,
  shopfronts, roof edges and air conditioners. Courtyards remain open.
- Bank of Albania, City Hall, Palace of Culture and Tirana International Hotel
  have identified OSM profiles. Six shared native landmarks remain visible;
  museum portico cadence/ochre panel, mosque tiled arcade roof and Eyes tower
  finishes have been updated from the references below.
- The existing preview's continuous pavement GLB, curb ramps, tactile tiles,
  traffic signals, zebra crossings, street names, drains, shelters, bike racks,
  planters, trees and Lana riverbanks are now part of the GitHub game. Fixture
  positions are authored dressing, not surveyed infrastructure coordinates.
- Pavements follow the union of road widths with buildings and carriageways
  removed, including lowered crossing approaches. Road paint avoids signal
  approaches. The pedestrian square uses mixed stone paving and perimeter
  benches, bollards and lights instead of an invented central vehicle road.
- Repeated details are instanced in spatial cells. Window/balcony detail and
  nearby shadows are distance limited; native landmarks and trees use LODs.
  Local Draco decoding uses one worker. River material loading is deferred
  until approaching the southern district. No Google geometry or texture is
  downloaded at runtime.
- FPS movement, bullet occlusion and AI navigation now use actual building
  polygons. Separate native-landmark volumes cover the generated meshes,
  including an open museum courtyard. These volumes approximate curved roofs
  and sculptures. Bus shelter openings and river railing gaps stay open.

## Reference register — reviewed 7 September 2026

Street View was inspected interactively. Its capture date is distinguished from
the upload/review date. Only observations were used; no Google images or mesh
extracts are distributed. Colors below are visual approximations, not sampled
survey values. Building heights without reliable measurements retain the OSM
estimate; the Palace's apparent 18 m height is an explicitly authored correction
to the old 50 m shell, not a measured building height.

| Building / area | Applied detail | Reference and date / limits |
| --- | --- | --- |
| Tirana International Hotel / north square | Pale horizontal bands, dark blue ribbon windows, slim black lights, benches and bollards | [Street View](https://www.google.com/maps/@41.3292771,19.8183301,3a,90y,180h,90t/data=!3m7!1e1!3m5!1sCIHM0ogKEICAgICkjMLj0QE!2e10!7i6432!8i3216), Greenterprise Albania, captured July 2017 |
| South square civic buildings | Ochre plaster and cream trim | [Street View shared panorama](https://maps.app.goo.gl/JV9KBZbRQG1Pw5eC7), Besnik Llupo, captured February 2014; historical colors only, road layout predates reconstruction |
| Skanderbeg Square / Palace of Culture | Pedestrian stone plaza, planted perimeter, pale colonnade, flat roof beam | [51N4E architect](https://51n4e.com/projects/skanderbeg-square/) and [Palace photograph](https://51n4e.com/site/assets/files/1479/12.1600x0.jpg), project phases 2017/2019, individual photo undated |
| Bank of Albania, OSM way 236566880 | Auburn brick palette, pale surrounds, tall floor spacing, original curved footprint | [Official Bank architectural booklet](https://www.bankofalbania.org/rc/doc/The_Building_of_the_Bank_of_Albania_3282_2_6832.pdf), publication year unconfirmed; distinguishes this square building from another bank office |
| National History Museum | Pale wings, gold/ochre front panel, six front piers | [EU4Culture restoration article](https://eu4culture.al/restored-albanias-iconic-mosaic-regains-its-original-shine-on-tiranas-main-square/), 17 May 2023. Relief remains original abstract art; source-footprint identity is unresolved and placement uses its mapped site center |
| Et’hem Bey Mosque | Pale arcade, terracotta eaves, slender balcony minaret | [TİKA restoration](https://tika.gov.tr/en/detail-ethem_bey_mosque_in_albania_restored_by_tika_opens_for_worship/), 19 October 2021 |
| Pyramid of Tirana | Retained stepped concrete silhouette and colored pavilions | [MVRDV architect](https://www.mvrdv.com/projects/312/the-pyramid-of-tirana), realized 2023; original approximate game mesh retained |
| Eyes of Tirana | Blue-gray glazing, dark vertical fins and horizontal divisions | [Zanetti supplier](https://www.zanettisrl.it/en/project/eyes-of-tirana/), labeled 2023; reference photo shows construction, final present-day condition unverified |

This is a substantial authored city reconstruction. It is not photogrammetry.
Historical imagery does not establish present-day paint, construction status,
road works or signage throughout Tirana. Generic residential façades, estimated
heights, some monument dimensions/yaws and street furniture placement need a
current local survey for exact replication.

## Assets and reproduction

Existing Kenney vehicles and original game assets retain their licenses. The
added texture and Draco licenses/provenance live under
`webapp/public/assets/tirana-streets/`; see `STREET-KIT-ATTRIBUTION.md` and the
material source JSONs. All imported image bytes and the pavement GLB are
unchanged from the user's existing Tirana preview.

`npm --prefix webapp run generate:tirana-assets` produces the street furniture.
The retained pavement source is reproducible with the Blender/Shapely pipeline:
`webapp/scripts/export-tirana-street-layout.mjs`,
`build-tirana-street-kit.py` and `externalize-street-textures.py`.
The original source map and attribution remain in the shared Tirana module.

## Verification

Run `node scripts/verify-blackwater.mjs` for the solo engine, actual Three scene,
shared collision, Socket.IO, reconnect and transactional stake regression tests.
Run `node --test test/tiranaFpsCity.test.mjs test/tiranaNativeLandmarks.test.mjs`
for concave footprints, native landmark cover, catalog consolidation, local
asset dependencies and mesh validation. Run `npm --prefix webapp run build`
for the complete app. The standalone preview renders `FpsPreview.tsx` using the
same `Game` and `GameEngine`; paid multiplayer stays in the authenticated app.

Verified for this change: 56 targeted tests pass (19 FPS/online/stake plus 37
city/landmark checks), strict TypeScript checks pass, the complete webapp
production build passes and the standalone preview production build passes.
The deterministic solo run completes all 18 eliminations and extraction.

Automated verification cannot establish physical-phone GPU performance or the
current visual accuracy of every city block. The compatibility renderer is a
reduced visual fallback and does not demonstrate WebGL rendering quality.
