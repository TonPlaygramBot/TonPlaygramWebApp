# Racing Royal: mapped city surface pass

This pass preserves the shared Tirana map, road routes, footprints, landmark
replacements and collision geometry. It does not reconstruct every Tirana
building or claim a current street-level survey.

## Changed

- Corrected texture UVs on the retained generic building shells. Previously all
  vertices used an x/z ground projection, which collapses vertical walls to one
  texture row. Walls now use their face tangent and elevation at a consistent
  four metres per repeat, including diagonal walls. Roofs use x/z mapping.
- Reused the existing `plastered_wall_02` diffuse/OpenGL-normal/roughness maps
  for these shells with their existing palette. Glass and trim retain separate
  materials. Maps are cached per city layer rather than loaded per building.
- Existing mapped/glTF neighbourhoods, reference facades, landmarks and aged
  housing detail remain in place. No source or Google imagery was imported.

## Provenance and scope

These three unchanged maps are already used by the neighbourhood glTF material:
[Poly Haven plastered_wall_02](https://polyhaven.com/a/plastered_wall_02), CC0-1.0.
The source and SHA-256 receipts remain in
`webapp/public/assets/tirana-streets/materials/sources.json` and are checked by
`test/tiranaBuildingSurfaceUV.test.mjs`. This is a generic material proxy, not a
photograph or surveyed material assignment for each building. OSM-derived
footprints retain the repository's existing ODbL attribution.

Replacing all procedural buildings with high-fidelity glTF models is not
completed by this change; replacing mapped footprints with arbitrary catalogue
models would reduce geographic accuracy. It requires individually suitable
assets, verified rights, placement and mobile performance review.

## Checks

- New metric UV/orientation and texture provenance tests: 4 passed.
- Existing environment, city-source and kart-remake tests: 27 passed.
- Existing FPS-city suite: two geometry tests passed; obsolete removed-game
  catalogue assertion failed and generated `street-furniture.glb` was missing
  before the prebuild asset generator. No gameplay visual/phone FPS claim is
  established by these numerical tests.
