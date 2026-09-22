# Pool Royal / Snooker Royal major update

Base: `8d0d5ee724e8759e540f5d3efe049b59c9763bb2` on `main`.

## Player-facing changes

- Pool career fixtures now use rack series: race to two for friendlies, three for circuit fixtures and five for rival showdowns. Knockout events support 8, 16 or 32 entrants, alternate breaks, longer finals, elimination and saved draws. Circuit fixtures are not presented as a fabricated league table.
- Snooker has a separate eight-player tournament dashboard with selectable best-of formats and difficulty, alongside its season career and rankings. Both modes show the draw, next opponent, match score and saved-frame status.
- Competition saves include the settled ball layout. Frame completion is duplicate-safe, old tabs cannot overwrite newer progress, failed writes expose recovery, and new Pool saves are scoped to the selected account. Snooker retains its existing device-local career save and uses a separate tournament save.
- Compact portrait scoreboards show turn, legal target, score/break, placement state and guide meanings. Pool exposes ball/pocket calls, safety and nine-ball push-out decisions. Snooker exposes the choice to require the offender to play again from the position left after a foul.
- Player cameras hold the address pose through impact instead of following the cue ball. The bridge-hand collision correction is retained instead of being overwritten, while the rear hand follows the cue stroke. Existing character assets and table dimensions remain in use.
- Aim guides stop at collisions and cushion boundaries; the contact circle keeps the ball's radius. The cue-ball guide distinguishes stun, follow and draw. Direction previews remain estimates rather than a promise of a pot.

## AI and rules

Both live planners now reject blocked, illegal and nonfinite candidates; compare plausible attacks with validated safeties; preserve bank directions; and validate the reflected contact after a cushion. Difficulty affects selection and execution precision, not ball physics. A one-snapshot cache avoids replanning an unchanged table on every animation frame, clones mutable plan vectors, and invalidates on rules, positions and ball-entity replacement.

The separately exported AI module also gains legality, placement, ghost-contact and pocket-entry corrections. It is not substituted wholesale for the existing live game's calibrated shot-power calculation.

New numbered Pool frames use the standard profile; old saves retain their explicit rules profile. See [the rule coverage review](cue-sports-competition-rule-review.md) for official sources, implemented cases and remaining referee limitations. This update does not claim complete WPA/WPBSA officiating: full illegal-break choices, foul-and-miss restoration and certain physical/referee declarations still need further work.

Existing inventory reward helpers are reached only after an accepted, saved competition result. No monetary API, wallet or wager-settlement logic is added. Resumed Pool frames without stored historical miss/foul data conservatively do not qualify for a perfect-run collectible.

## Review and limitations

The in-chat React/Three.js preview uses the same Pool character rig, cue stroke, camera and guide-clipping helper. Its table materials and avatar textures are simplified for the frame-size limit; ball motion is a stroke inspection, not a complete tournament simulation.

The review browser rejected the local game URL with `net::ERR_BLOCKED_BY_CLIENT`. Consequently there is no claim of a completed live WebGL, physical-phone or two-device online visual test. Existing online routing is retained, but two-client gameplay still requires review.

The full web application production bundle and root TypeScript build are validation gates. Targeted engine, AI, career, checkpoint, aiming and real-rig regression results are recorded in the PR. The broader Jest selection encountered an existing `nativeBridge.ts` declaration error for `backNavigation.js` in the unchanged online-flow suite; it is not reported as a passing all-repository test run.
