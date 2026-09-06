# Snooker Royal gameplay review

Reviewed the live route's source, `SnookerRoyal.jsx`, and its shared rules and power controls at `ce351c3`.

## Changes in this upgrade

- Interrupted touch drags, lost pointer capture, app backgrounding, and control teardown cancel a shot. Additional fingers cannot take over the pull. Returning the pull to zero cancels it.
- A colour after a red must match the nominated colour, or the first contacted colour when no nomination was supplied. A yellow-contact scratch now awards four points rather than incorrectly using the maximum value of every available colour.
- Already removed balls cannot score again, and completed frames reject further shots.
- During colour clearance, a nominated free ball can plant the actual colour. Potting both scores the actual colour once.
- All respotted colours use the same collision-aware placement path, including foul pots and the colour after the last red. Higher-valued colours are spotted first. Fully occupied spots use the longitudinal line rather than an overlapping fallback.
- Scores are displayed beside the correct player when the local player is seat B. The HUD shows the ball on and current break. Foul notices explain the reason and points awarded.

The shared power-slider change also affects other games using `PowerSlider`; the drag-direction convention remains pull down to increase power.

## Verification

- Seven new rules regression cases failed against the original implementation before the fixes.
- 52 tests passed across eight suites: Snooker Royal rules, respots, power-slider lifecycle, shot coach, impact audio, table specifications, table model, and existing Pool Royale rules.
- The rules tests include a complete 147-point clearance.
- Root TypeScript production compilation and the complete webapp production build passed.
- Browser playtesting was attempted, but the environment blocked access to the running preview (`ERR_BLOCKED_BY_CLIENT`). No visual, touch-device, FPS, or online end-to-end pass is claimed.

## Remaining gaps and release checks

- Tied final-black handling still needs a respotted-black decider. The rules currently return `TIE`, while the game-over handler defaults non-B results to A. This must be resolved before claiming tournament-correct results.
- The live shot context does not supply free-ball nomination or a snookered determination; the free-ball fixes here validate the rules API, not a complete player-facing nomination flow.
- Verify portrait layouts on actual iOS/Android Telegram WebViews, especially the new status badge near the existing spin controls and score bar.
- Verify two-player seat-B scoring, reconnect/replay state, and occupied-spot recovery in live matches.
- The production build reports existing large chunks; a separate asset and frame-time profile is needed before claiming a mobile performance improvement.

Rules reference: [WPBSA official rulebook, 2024–25](https://wpbsa.com/wp-content/uploads/2198_WPBSA-Rulebook-2024-25.pdf), particularly Section 3 on spotting colours and free balls.
