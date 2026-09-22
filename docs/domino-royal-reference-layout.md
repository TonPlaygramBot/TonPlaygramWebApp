# Domino Royal reference layout

This change starts from main at `391db8b681ccac45a9b6a5e5daaad65be8f9bb32` and uses the table view in PR #25963 (`33a816ed03bba59812e3f4010f100d3becc8fc4a`) as its layout reference. That earlier animation PR is still separate; this change does not merge it.

The game and the React/Three.js review now share `public/domino-royal-layout.js`. The reference table and chairs are constructed at their final dimensions, without the imported default chair's extra enlargement or vertical offset. Ruby procedural chairs are the new default; the previous forced dining-chair default migrates once. Other saved themes remain selectable. Seated humans retain the existing shared rig, seat anchors and presentation scale.

| Dimension | World units |
| --- | ---: |
| Table surface | 0.70892025 |
| Table outer radius | 2.14812 |
| Seat surface / human hip anchor | 0.69017025 |
| Chair width | 1.482975 |
| Chair depth | 1.5653625 |
| Bottom chair distance | 3.39418125 |
| Right / left chair distance | 2.55028125 |
| Top chair distance | 3.12418125 |

The 3D view uses the reference's 48-degree field of view, look direction and target. Its distance fits the occupied chairs, human head anchors, racks and table. Checking actual chair vertices exposed clipping in the original review framing; fitting the chair bounds fixes this at 320×568, 390×844 and 844×390. The view stays steady between turns. Pinch/wheel zoom and the 2D board view remain available. The canvas no longer has an additional 0.97 CSS scale.

## Verification

- 12 geometry/camera checks passed: measured Three.js mesh bounds, seat orientations, independent geometry, and every chair vertex inside the padded view for two/four players at all three viewport sizes.
- 14 existing presentation, graphics-safety, video-layout and online regression checks passed. Updated one stale video-layout assertion that already failed on unchanged main because it expected a removed variable; it now checks the occupied-seat limit.
- Both Domino Arena and public game entries built successfully as minified production ES modules with esbuild. This is a focused Domino build, not a whole-app build or offline asset-package check.
- The interactive React/Three.js preview built successfully below 1 MB. Only avatar image textures are compacted; geometry, skin weights, bones and transforms retain the original non-image SHA-256 `eedda6c6d2f3d9e9712ef7cc2baf77e9ebcc07c3d17407f7b4a26d76d4de036e`.
- Independently executed the production chair factory and camera-position functions with real Three.js and checked their camera constraints.

Commands:

```sh
node --test test/dominoRoyalReferenceLayout.node.mjs
npx jest --runInBand test/dominoRoyalPresentation.test.js test/dominoRoyalVideoLayout.test.js test/dominoRoyalGraphicsSafety.test.js test/dominoRoyalOnline.test.js
node webapp/scripts/build-domino-royal-layout-preview.mjs /workspace/domino-royal-layout.html
```

## Remaining review

The browser rejected the local review URL with `net::ERR_BLOCKED_BY_CLIENT`. Full WebGL gameplay and physical-phone visual checks are therefore pending. The review uses the real original avatar and production layout/rig with simplified lighting and compact original textures; it does not load the game's remote cloth overlays or HDRI. Do not treat it as a gameplay screenshot or claim pixel-perfect validation. Keep the PR draft until in-game portrait review is complete.
