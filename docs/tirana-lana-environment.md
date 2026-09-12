# Tirana Streets: recessed Lana and cinematic environment

Base: `c2e853331f479c04d11c8fee482755f6d938df88` (`main`).

The previous FPS ground plane covered the below-ground water. The driving
renderer also drew waterways at street height, and the old landscape cut was
only 3.8 km wide despite the expanded map. This change gives the city renderers
one full-map terrain with real channel openings and consistent river surfaces.

## Included

- 104 exposed OSM river/stream ways reconstructed from the committed,
  checksum-verified source archive, including 16 named Lana ways. Tunnels and
  covered watercourses are excluded. Positions use the existing Tirana origin.
- Lana water at **2.85 m below the road datum**, bed at 3.35 m below it, concrete
  lower slopes and planted upper banks. These vertical dimensions and untagged
  widths are authored visual estimates; no surveyed elevation is claimed.
- Base ground, park detail and regional green/paved overlays cut out the same
  channels. Full existing bounds receive repeating photographic ground cover.
- Structures for all **477 mapped bridge segments**: concrete decks, pedestrian
  paving, kerbs, metal rails, reflectors, and river abutments/soffit beams.
  Sidewalk access remains open. Nearby cells are streamed and evicted.
- Roadside railings use the existing collision placements and an authored local
  `roadside-rail.glb` (with a matching `.gltf` source). One common owner prevents
  duplicated railings in FPS views. At most 900 nearby panels, 320 in battery mode.
- Twelve newly acquired Poly Haven maps (four material sets): concrete pavement,
  rough concrete, weathered brown planks and asphalt 02. All files are local 1K
  JPEGs with source/output hashes, CC0 licenses and source URLs in
  `environment/sources.json`. The 12 maps total 4,365,637 bytes. Existing licensed
  grass/plaster maps are reused. No runtime Poly Haven/CDN dependency is added.
- Finished regional roofs/parapets and improved wall base shading. Generic
  windows and nearby Blender facade modules also finish existing estimated-height
  shells; source heights/footprints remain unchanged. Explicit construction sites
  and authored landmark replacements retain their separate treatment.
- Random session time and five weather states: clear, cloudy, overcast, rain and
  mist. Transitions interpolate over 45 seconds, weather slots last five minutes,
  and a full day lasts 72 minutes. Atmospheric fog, cloud sky, rain, daylight,
  exposure, wet tagged surfaces and tagged window emission use the same clock.
- Moving 1024 px sun shadow box snapped to texels; reduced rain/railing work in
  battery mode. No new physics or gameplay RNG is consumed.
- Integration in driving/Street Career, FPS/City Stories/Battlefield and Explore.
  The CityGame time/weather labels now reflect the rendered atmosphere.

## References and asset provenance

The waterway source archive is under `assets-source/tirana-urban`, SHA-256
`dca70c5d585b90c6c042b033bb4bfb001da8b297d7767b2cd927bb1875611602`.
It retains [OpenStreetMap attribution and ODbL](https://www.openstreetmap.org/copyright).

The [Albanian National Center of Cinematography's Lana bridge location](https://www.qkk.filmmakers.systems/en/public/locations/wooden-bridge-lana-river)
and [Top Channel's pedestrian bridge report](https://top-channel.tv/english/new-pedestrian-bridge-over-tiranas-lana-river/)
provided photographic/context references. Their imagery is not redistributed.
A new-project rendering found in search was not used as evidence of completed
construction or as a basis to reposition existing bridges.

Material pages: [Concrete pavement](https://polyhaven.com/a/concrete_pavement),
[Rough concrete](https://polyhaven.com/a/rough_concrete),
[Weathered brown planks](https://polyhaven.com/a/weathered_brown_planks),
[Asphalt 02](https://polyhaven.com/a/asphalt_02),
[Grass path 2](https://polyhaven.com/a/grass_path_2).

## Validation and remaining limits

- Full application `npm --prefix webapp run build` completed successfully,
  including original-asset and vehicle verification. Existing large-bundle
  warnings remain.
- Dependency-aware TypeScript checks passed for the changed runtime chains and
  the React review component.
- Six new environment tests passed: weather continuity/random coverage, upward
  bank normals, actual Three raycasts proving Lana openings, bounded real-scene
  rain/wetness, texture hashes/GLB decoding, and estimated-height facade finishing.
  Ten existing city-completion/neighbourhood tests also passed.
- The portrait in-chat React + Three review uses the production terrain,
  infrastructure, weather and building geometry with a bounded source-map subset
  and smaller embedded copies of the real diffuse textures. It is a scene review,
  not a networked gameplay session or a replacement game route.
- **Browser/GPU and physical-phone visual/FPS validation were not available in
  this session.** The tests execute real Three geometry and material code, not
  WebGL shader compilation or a physical device benchmark.
- **Grade-separated overpasses remain on the game's existing flat road datum.**
  This PR adds their mapped structural presentation but does not invent elevated
  driving surfaces, ramps or new routing links. True above/below-road traversal
  still needs matching shared navigation and collision changes.
- The source map is not a complete present-day survey of every Tirana bridge,
  facade or parcel. Generic finishes are not photo-matched individual buildings.
  No merge or production deployment is included.

Reproduce:

```sh
python webapp/scripts/import-tirana-hydrography.py
python webapp/scripts/fetch-tirana-environment-materials.py
node webapp/scripts/build-tirana-environment-assets.mjs
node --test test/tiranaEnvironment.test.mjs test/tiranaCityCompletion.test.mjs test/tiranaCityCompletionRuntime.test.mjs test/tiranaNeighbourhoodRuntime.test.mjs
npm --prefix webapp run build
node webapp/scripts/build-tirana-environment-preview.mjs
```
