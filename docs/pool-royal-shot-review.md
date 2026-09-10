# Pool Royal shot and rules review

## Camera and cue

The AI shot used a camera path that bypassed the avatar eye view. The eye override now runs after the final render camera is selected, covering the local and AI stroke, action view and pocket view. It holds the eyes through contact and for 600 ms after the stroke, then releases over 300 ms. Explicit top view, the cue gallery and replay keep their own cameras. Head/hat occlusion is checked against the final camera each frame, with visibility restored when the head clears the view. Shooter ownership uses the frame's A/B seat, including a local online player seated as B.

The camera advances two ball radii from the measured eyes while retaining their height. Body scale, handedness, bone bind matrices and the original reference solver remain unchanged.

The detailed wooden cue predates the character commits (`4923114` and `395483a`). `createPoolRoyalCue.ts` extracts that geometry and its material slots. Gameplay and both standing holders now use it; holders share the selected finish and stripe materials without owning their disposal. The blue leather cap is corrected to face forward. Tip markers match the actual cap surface, rather than the front shaft/ferrule boundary.

Pullback follows the supplied demo's cubic power curve, 0.42/0.045 ball-radius ratio and small practice stroke. Release begins at the rendered pull position, uses a 120 ms cubic forward stroke and a 50 ms hold, and reaches physical rounded-tip contact at the reference's 0.88 impact threshold. Contact accounts for cue tilt and spin offset. Physics launches once, after the visible cue moves to contact. The cue stays anchored to the shot start instead of following the moving ball. Dropped frames retain a visible contact hold. Repeated releases and zero-power releases do not mutate the turn, timer or shot state; an explicit release power takes precedence over stale power.

## Gameplay corrections

- Use the rules engine's actual break flag for break power. A zero scoring run after a miss is not another opening break.
- Keep turn/foul ownership in the rules engine. Remove duplicate frontend rules that could overwrite its result.
- Count distinct numbered balls reaching a rail after contact, excluding cue-ball and repeat bounces. Normalize actual `ball_1` IDs before counting or spotting.
- Keep US eight-ball open after the break, enforce its four-object-ball dry-break requirement, and spot an eight pocketed on the break. The existing automatic ball-in-hand policy is retained; there is no new break-choice dialog.
- Preserve each nine-ball player's foul streak across the opponent's turns. Reset only after that player makes a legal shot, and display a two-foul warning before the third foul can lose the rack.
- Restore the nine after a foul, or eight after a break pot, in both rules and physical layout. Deterministic spotting finds a clear position on the long string and runs before replay/online post-shot snapshots.
- Keep UK foul pots removed from the rules' remaining-ball counts and serialize ball-in-hand, matching the visible table and the existing single-visit house rules.

The relevant comparison is the [WPA rules of play](https://wpapool.com/wp-content/uploads/2026/01/2026.01.02-WPA-Rules.pdf), sections 3.13, 4.3–4.4, 4.7, 5.3 and 5.6–5.8. This is a review of the implemented game, not a claim of complete tournament-rule certification. The game still has house rules and no full called-pocket, push-out or tournament break-choice workflow.

## Verification

The review covers shot commitment, cue contact, human and AI camera ownership, turn retention/change, scratches and ball-in-hand, group assignment, legal/early eight-ball finishes, break legality, nine-ball foul streaks/spotting, ball separation, spin mapping, AI aim/planning, training/career progress, table selection and mocked matchmaking flow.

- 130 Jest checks across 16 Pool Royal/rules/AI suites.
- 3 ball-separation checks in `webapp/src/pages/Games/poolRoyaleBallSeparation.test.js`.
- 12 native Node checks via `npm run test:pool-players`, including the unchanged 67-bone reference fixture, calibrated bridge skin, independent skeletons, transformed parents, shot lock, actual cue-cap bounds, shared appearance/disposal and AI camera hold/visibility.
- TypeScript check of the preview, cue, camera and imported character modules; full webapp production build; comparison of unbound identifiers against the base revision.
- Browser loop at 360 px portrait/dark and 736 px/light: aim, AI wind-up/release, frozen contact, bridge close-up, standing/table view and opposite heading. The tip was inspected, corrected and rendered again. No application console errors were observed; extension metadata errors are external to the page.

The browser lacks WebGL. Inspection uses the existing software renderer with the real character meshes, skeletons, cue geometry, camera and stroke helpers. Its simplified table and short post-contact ball motion are inspection aids; they do not simulate the complete arena's ball collisions or multiplayer. Near-plane/depth sorting in the CPU renderer can differ from WebGL. Full phone GPU rendering/performance remains a device check.

Live server/matchmaking testing was attempted but could not start the server: the checkout initially lacked bot dependencies, and installing the locked dependencies exposed the unavailable native `canvas` 2.11.2 binary for Node 24. Rebuilding that dependency failed. Mocked online-flow checks pass; live two-device multiplayer is unverified. No server dependency versions were changed.

## Reproduce the visual loop

Run `node scripts/build-pool-players-preview.mjs /workspace/pool-royal-shot-review.html`. The inspection uses production dimensions and code. `Strike` releases the selected shot, `AI shot` includes the pullback, `Slow motion` slows inspection, and `Inspect contact` freezes the cue tip at the ball. Change the player or aim direction to reset the shot. Production character textures remain unmodified; the inline inspection uses reduced textures to stay under 1 MB.
