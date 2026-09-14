# Murlan Royal hand and portrait UI review

Based on main commit `69bc6dd2334476eb1feb5abcf40be925916c621a`.

## Changes

- The typed Three.js hand controller reads the actual card meshes and targets both outside edges. Card positions, fan layout, size, camera and final table destinations are preserved.
- Arm chains resolve from the wrist ancestors, avoiding the old clavicle/upper-arm mix-up. Anatomical left/right derives from the shoulders rather than the card layout tangent.
- The right hand follows the real selected card during pickup, releases at its calibrated reach, and returns to the fan. The duplicate blank flying card has been removed.
- State and selection updates are applied together; the previous-state snapshot is saved afterwards. This restores the intended 1680 ms pickup/placement path and avoids restarting it on unrelated selection updates.
- PASS has two right-hand contacts, at 300 and 540 ms, with the sound triggered after the contact pose. The short sound is derived from the existing `wooden-door-knock-102902.mp3` (2.545–2.745 seconds); the original asset is unchanged. Stale sounds are suppressed after a long frame pause.
- A shared React/TypeScript control surface groups tools, provides 48 px actions, shows turn/selection/error feedback, and gives settings a keyboard-accessible scrolling dialog.

## Visual limitation: review before merging

The actual procedural chair fallback has world Y = 1.635221, putting the shipped avatar's shoulders near Y = 3.94 while the existing cards are around Y = 1.1–1.6 and the tabletop is Y = 0.723. The earlier simplified chair-origin assumption missed this difference; browser inspection exposed it.

Keeping both the existing character placement and the cards fixed requires visibly elongated arms. The controller limits calibration to 2.8 times the original arm segment offsets for holding and 3.2 for a table knock, and never increases arm length to chase a played card. These are bounds for heterogeneous chair pivots, **not a claim of natural human proportions**. The resulting fallback pose is a known visual failure and this change remains a draft.

A natural result requires permission to correct the seated avatar placement/scale (and its relationship to the chair) while retaining the card transforms. Do not merge this draft as a finished visual solution until that decision and another portrait review.

## Verification

```sh
node --test test/murlan.test.js test/murlanHands.node.mjs
cd webapp
npx vitest run --config vitest.murlan-ui.config.mjs
```

The controller tests load the shipped GLB and run the actual arena card layout and placement code. They check left/right resolution, scaled/rotated rigs, 1/5/13-card fans, empty-hand recovery, interrupted gestures, contact timing, unchanged card transforms and unchanged final destinations. The original fan-position block is protected by a frozen baseline hash.

The focused production build of `webapp/murlan-preview.html` succeeded. The existing arena bundle still exceeds Vite's 500 kB chunk advisory; no unrelated dependency/build changes are included.

`scripts/check-murlan-portrait.mjs` is the reproducible browser check. It supports an explicit offline-assets mode because remote HDRIs and character sources are not reliable in the review environment. Offline results exercise the shipped avatar and procedural environment; they do not establish availability of every external asset or live multiplayer service.

The UI-only browser run passed at 390 × 844 and 320 × 740: eight controls meet the 44 px minimum target, no horizontal overflow remains (including offscreen avatar probes), and settings sizing, Escape and focus restoration work without page errors. A full arena frame revealed the original overflow and seating failures. Software WebGL was too slow for a reliable full-game browser interaction run; the isolated production-controller preview and numerical trajectory tests cover the motion checks. Full game visual acceptance remains pending the seating correction.

The inline motion preview is built with `node scripts/build-murlan-hands-preview.mjs`. It uses the shipped model and production controller with source-derived chair, card and flight transforms. It is an inspection view, not a replacement game.
