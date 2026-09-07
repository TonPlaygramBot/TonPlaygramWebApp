# Tirana landmark asset integration — preparation only

Status on 2026-09-07: **zero model files acquired, zero new models installed, no renderer wiring, no visual verification**. The earlier Tirana catalogue was a list of sources, not a mesh pack. This change must not be described as adding the listed buildings or statues to the games. Existing scenes, collision, missions and production behavior are unchanged.

## Implemented and tested

`webapp/src/games/tirana-landmarks/placement.ts` is a dependency-free TypeScript preflight module. It projects latitude/longitude using the same origin and metre conversion as `webapp/scripts/build-tirana-map.py`, or resolves an existing `WORLD.landmarks` ID without moving it to a nearby road. It preserves a measured model anchor under uniform scaling and yaw. It rejects unknown/ambiguous locations, missing review metadata, source-page URLs, invalid transforms, duplicate physical landmarks and anchors outside the current map.

`assets.ts` intentionally exports an empty immutable approval list. The URL/approval checks validate metadata only: they do not prove file existence, permission, mesh accuracy, terrain alignment or collision suitability.

## The three game coordinate systems

Tirana Streets and **Racing Royal** (the `kartroyale` implementation) use the same Tirana `WORLD` coordinates. BlackWater subtracts its existing `ORIGIN` from them; at the inspected base commit that value is `{ x: -220, z: 600 }`. There is no scale change or rotation. When connecting a real asset, BlackWater must pass the `ORIGIN` exported by its own layout rather than copy those numbers into the shared asset record.

The preflight call is `planGamePlacements(WORLD, approvedAssets, { game: 'tiranastreets' })` or `{ game: 'kartroyale' }`; BlackWater uses `{ game: 'blackwater', mapOrigin: ORIGIN }`. The shared module deliberately does not import BlackWater's full layout into the other games.

Integration sites inspected:

- Tirana Streets: `webapp/src/games/tiranastreets/renderer.ts`.
- Racing Royal: `webapp/src/games/kartroyale/tiranaScenery.ts`.
- BlackWater: `webapp/src/games/blackwater/cityWorld.ts`, with the transform from `shared/layout.mjs`.

These call sites are **not modified** in this preparation change. Existing OSM footprint/landmark anchors are source-data positions, not newly surveyed coordinates. No precise location is invented for an unverified statue. An out-of-map landmark must not be relocated into the playable district to make it appear.

## Blocked asset intake

`tirana-landmark-source-status.json` retains the eleven source listings and their unacquired status. Both clock-tower listings can refer to the existing `clock` anchor, but only one model of that physical landmark should ultimately be approved. All other model locations still require verification against the exact physical object represented by the acquired file.

Completion requires acquiring the original permitted model files and their textures, checking rights/attribution and current appearance, validating each GLB, measuring its units, local ground anchor and orientation, and confirming geographic placement. Only then should the appropriate existing shell be replaced, preserving correct collision and avoiding double buildings. Statues need separate collision decisions; these are not provided by visual-only placement math.

The three live renderers still need loader lifetime/error handling, asset replacement, distance/LOD management, disposal, collision review and visual testing on a portrait viewport. This branch does not implement or certify those steps. There are no invented asset URLs, Google Earth exports, copied third-party meshes, or generated substitute statues in this change.

## Validation performed

Run from the repository root with Node 22 supporting TypeScript stripping:

```sh
node --experimental-strip-types --test test/tiranaLandmarkPlacement.test.mjs
```

Executed locally on Node 22.16.0: **20 tests passed, 0 failed**. Tests use clearly labelled synthetic anchors/model metadata, not downloaded models. They exercise projection/round trips, all three game mapping branches, BlackWater's explicit origin requirement, anchor transforms, bounds and invalid inputs, duplicate rejection, and the empty registry.

No full webapp build, TypeScript compiler check, Three.js rendering, model download, collision test, physical-phone test or gameplay regression run was performed. The local runtime could not resolve GitHub or the npm registry; repository inspection and branch writes use the connected GitHub tool.

Inspected repository base: `d7488a41623f4e9840b008e554e28f8ef6eb6b74`.
