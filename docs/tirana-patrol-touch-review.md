# Tirana Streets: touch, patrols and custody

This follows the mobile gameplay changes merged in #25941. It targets the local Street Career game and shared city rendering; the existing Battlefield input also receives independent touch ownership fixes.

## Behavior

- Move, look, fire and other held controls have independent pointer ownership. Releasing one finger does not cancel another control; blur, pause and cancellation clear their owners. Aim, jump, reload and other tap actions respond on press. The existing graphics, sensitivity, audio and 50/60/75/90/120 FPS choices remain available.
- The equipment sheet has search and a pinned bottom row for **No weapon, Punch, Eggs and Tomatoes**. Food has finite magazines/reserves and swept ballistic collision. A missed or obstructed throw does not count as a hit. Food and fists are excluded from random firearm pickups.
- Hitting an officer with food begins non-lethal pursuit. Close, unobstructed contact on foot triggers spray, takedown, a backup van approaching on the road graph, arriving officers, escort and a short transport fade. Street Career restarts at a clear entrance beside mapped police-directorate building `361451879`, near Myslym Shyri. Completed career progress and remaining equipment are preserved; the interrupted job is abandoned without a reward. Pausing freezes this sequence. Unreachable backup or escort routes time out without trapping the player.
- 32 additional officers patrol 16 paired, fixed sidewalk routes. Existing original-v2 patrol, traffic, Shqiponja, FNSH, RENEA and army GLBs remain byte-for-byte intact. Their private skeletons use two-bone arm IK and the same grip lengths as player weapons. Visible NPC gun placement and shot origins share one pose definition; aiming settles before firing and retains cover/line-of-fire checks.
- Actor bone lookups and scratch math are cached; only affected bone ancestors are updated. Distant original uniforms sample their skeletons at 20/10 Hz while root motion stays smooth. Traffic neighborhood queries reuse results within each spatial-grid snapshot. Building windows are emitted into shared buffers instead of constructing a geometry per window.
- 254 misplaced trunks are moved to clear verges, preserving all 5,284 trees and original source coordinates. Every one of the 2,795 retained collision railing segments clears the full carriageway; bridge rails are split so crossing lanes stay open. Visual and collision rails use the same corrected registry.
- Valid mapped storey counts now control facade window rows, including ground floors on elevated terrain. Downtown One uses the architect-published 140 m / 37-storey design with a glazed grid and projecting-bay interpretation of its facade relief. Rendering and collision share the corrected height. The bay pattern, unmeasured facades and the police entrance remain game approximations. Source: [MVRDV — Downtown One Tirana](https://www.mvrdv.com/projects/388/downtown-one-tirana).

## Verification

- Production build and Tirana gameplay TypeScript check.
- 55 passing controls/gameplay/presentation/custody tests (7 existing optional Battlefield engine tests skipped because their separate bundle is not supplied).
- 37 passing force-squad, environment, building, canopy and presentation tests, including independent Battlefield look/fire touches and batched window winding on elevated ground.
- 5 passing actual GLB force-runtime checks, including private skeletons, locomotion, cover and wrist-to-grip distance under 3.5 cm for rifle and sidearm.
- Additional checks cover all 41 existing weapon sight alignments, real-map custody traversal, all added patrol routes, every corrected tree and every retained collision railing. The preceding full-body career suite also passed (25 tests).

## Visual review limits

The portrait review entry is `webapp/tirana-patrol-review.html`; it loads the actual equipment component and original officer/weapon models using React, TypeScript and Three.js. It is review-only and is not added to product navigation.

The browser initially rendered the 390 × 844 equipment page, but the shared preview service then served a different project's RSC 404 page. A complete browser interaction / WebGL visual pass could not be completed. No phone FPS number, screenshot of the finished scene, or pixel-accurate architectural reproduction is claimed. Check sustained phone performance, touch feel, uniform grips and custody visuals on a WebGL-capable device before release.
