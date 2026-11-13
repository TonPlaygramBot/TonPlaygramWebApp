# Tirana city realism recreation

This is a new, reviewable improvement on current `main`, not an import of the inaccessible earlier City assets workshop. It does not claim to recreate every workshop change or deliver console-game fidelity.

## Integrated changes

- A genuine CC0 Poly Haven tree scan replaces the close-range representation of mapped **garden/umbrella** trees. Its embedded bark, branch, leaf normal/roughness/color maps and alpha-tested foliage retain real surface detail. The original has over one million triangles; the reviewed mobile derivative has 35,869 triangles and is 3,601,484 bytes, with 512px textures.
- At most **eight** imported trees in normal quality and **three** in battery mode are visible within 65 metres. Mesh geometry/materials/textures are shared through instancing, with three draws for the three source primitives. Battery mode disables their shadow casting. Existing lower-detail trees remain at distance or if loading fails. Upright boulevard trees and cypress columns keep their current representation rather than being incorrectly reshaped from this open-canopy model.
- Sixteen original urban fixture modules are stored as a local **465 KB GLB**. Existing mapped facade/roof placements now load detailed fan guards, service pipes, ribbed tanks, solar-panel frames and vents. The existing selector, update interval and 120-instance per mesh cap remain intact. See `tirana-detailed-fixtures.md`.
- Both loaders preserve original material/UV data, install complete replacements, and clean resources after disposal and late loads. Tree failures leave existing canopy visible; malformed fixture packs do not replace working fixtures.
- No new map cut is imposed: `main` already has a coherent urban crop. Existing roads, tree identities, navigation, collisions, shops, pickups and accessible roofs are preserved. There is no claimed additional 30% reduction.

## Sources and licensing

The tree is [Poly Haven Island Tree 02](https://polyhaven.com/a/island_tree_02), by Rob Tuytel and Rico Cilliers, [CC0](https://polyhaven.com/license). The actual source receipt and derivative SHA-256 are beside the runtime GLB. This is an artistic garden-tree substitute, not surveyed Tirana vegetation. New fixture geometry is original CC0; no new commercial-game assets or unlicensed textures were introduced. Build sources are under `assets-source/tirana-city-realism` and `assets-source/tirana-detail-kit`.

## Verification

- **31 tests passed**: imported-tree loader, actual GLB integrity/alpha/material budgets, detailed fixtures, existing detail-kit placements, urban-world preservation and realism regressions.
- Focused TypeScript passed for ImportedTreeLayer, MatureTreeLayer and UrbanDetailLayer.
- Final actual CityGame browser entry bundles with esbuild.
- Full production Vite compilation passed. Its subsequent application-download packaging reported missing `assets/external/manifest.json` in this checkout. Complete offline packaging/prebuild is therefore **not** verified.
- Exported GLBs were opened and rendered in Blender. `docs/validation/tirana-city-realism/tree-asset-review.png` and `docs/validation/tirana-city-fixtures/asset-review.png` are asset-only reviews, not gameplay screenshots. The first aggressive tree simplification was rejected because it stripped leaf coverage; the shipped derivative was compared against the original.
- Browser/device gameplay was **not** verified: Chromium cannot create its process socket in this execution environment. Physical phone FPS, transitions between tree LODs, final lighting and in-game placement remain review gates. Existing procedural distant canopy and other city buildings remain; this PR is an incremental real-asset upgrade, not a full-city photorealistic replacement.

## Review

Open Tirana Streets on a WebGL2 phone and inspect mapped garden/umbrella trees, then drive/walk beyond 65 metres and switch battery mode. Check that distant canopy remains, nearby trees are not doubled, original upright trees are unchanged, and roof/facade fixtures keep their placements. Repeat entry/exit and test a blocked asset request to verify fallback. Review actual phone frame time before merging.
