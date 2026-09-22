# Pool Royal and Snooker Royal competition rules

Reviewed against WPA Rules of Play effective 15 September 2025 and the WPBSA 2024–25 rulebook on 22 September 2026.

Primary sources:

- https://wpapool.com/wp-content/uploads/2026/01/2026.01.02-WPA-Rules.pdf
- https://wpbsa.com/wp-content/uploads/2198_WPBSA-Rulebook-2024-25.pdf

## What changes in new games

`PoolRoyaleRules` now starts eight-ball and nine-ball using the standard profile. A saved frame retains its explicit profile. The optional `reference` profile is preserved for the previously requested alternative rules: group assignment on the break, early-eight respot and no three-foul rack loss. Its regression tests opt into that profile explicitly.

| Situation | Standard behavior |
| --- | --- |
| Eight-ball break pot | Retain inning; table stays open. Eight is spotted rather than winning the rack. |
| Eight-ball mixed pots on an open table | The successfully called ball assigns the group. |
| Called ball misses its nominated pocket | Other balls remain down; pass the inning without ball in hand. |
| Declared safety | Pass the inning even if an object ball is potted. |
| Early eight / eight with a foul / eight in wrong called pocket | Lose the rack after the break. |
| Eight driven off table | Lose after the break; spot on the break. |
| Eight-ball break scratch | Incoming ball in hand restricted to baulk; subsequent ordinary fouls allow placement anywhere. |
| Nine-ball legal break | Push out available for the immediately following stroke. |
| Nine-ball push out | First-contact and rail rules suspended; nine respotted, other pots stay down; opponent accepts or returns the position. |
| Nine-ball scratch or object ball off table | Foul; nine spotted, other removed balls stay down. |
| Three consecutive nine-ball fouls | Two-foul HUD warning on returning to the table, then rack loss on another foul. |
| Snooker colour after red | Pre-shot declaration is honored; undeclared first colour contact remains an implicit nomination. |
| Snooker foul before nominating a colour after red | Seven-point standard penalty; explicit reference profile preserves the former minimum-four behavior. |
| Snooker incoming player after a foul | Can require the offender to play again from the position left, with penalty points retained. |
| Snooker post-foul obstruction | After colour respots, test both extreme contact paths of every ball on. Only balls not-on can cause a snooker. |

The existing snooker tests also cover distinct reds, 147 clearance, the final colour after the last red, colour respots, free-ball scoring, final-black fouls and tied-score black respot. Requiring the offender to play again restores their colour-after-red phase where applicable, but does not restore any ball positions.

## Event and renderer contract

- Calls are recorded before a stroke: `calledBallId`, `calledPocket`, `safety`; the engine compares these with actual pocket events. If no call is provided, the existing obvious-shot convention remains available. The engine does not invent a call after seeing the result.
- Off-table events use `offTableBallIds`; the renderer must report genuine departures. Clamped two-dimensional physics cannot generate every real-world jump/off-table foul.
- Nine-ball serializes `pushOutAvailable` and `pushOutPending`. No new stroke is accepted while the accept/return choice is pending. `resolvePushOut(frame, choice)` preserves the layout and returns the correct active player.
- Snooker `resolveFoulChoice(frame, 'return')` preserves the balls left by the foul and the score. Its option expires on the next stroke. It is distinct from restoring the layout after a referee's foul-and-miss decision.
- `isSnookerObstructed` evaluates settled physical ball positions after colour respots. `setSnookeredAfterFoul` updates the free-ball option from that geometry without rescoring the stroke.

## Boundaries requiring further referee/physics work

This is not a claim of complete tournament officiating. The following remain game conventions or require additional evidence/UI:

- The full WPA menu of re-racking, allowing the original breaker to break again, or accepting a failed break is not modeled. Current illegal breaks give the incoming player ball in hand; legal break eights are automatically spotted.
- The WPA three-ball head-string crossing condition for a dry nine-ball break is not enforced without a tracked crossing event stream. The distinct-four-object-ball rail requirement is enforced.
- Eight-ball calls are only enforceable when shot input supplies the intended ball/pocket; ambiguous bank/combination shots require the player's explicit nomination.
- Snooker foul-and-miss judgments, restoration of the complete pre-shot layout, repeated-miss warnings/frame loss, and impossible-to-hit / penalty-points-needed exceptions are not automated.
- Free-ball detection with the cue ball in hand is conservative: it does not infer a free ball from a pocketed cue's last position. Proving obstruction from every possible legal D placement remains unimplemented. Ordinary settled-cue obstruction is tested geometrically; nomination remains necessary.
- Touching-ball declarations, simultaneous first contact, frozen-cushion declarations, push strokes, jump strokes, feet-on-floor, concessions and sportsmanship decisions need additional referee/physics inputs.
- UK pool remains its existing explicit UK rules variant; it is not silently relabeled WPA blackball.

## Regression verification

The new `cueSportCompetitionRules.test.ts` exercises live-default profile selection, calls, mixed pots, safeties, break exceptions, off-table handling, push-out persistence and decision locking, and snooker penalty/replay transitions. Existing reference, final-black, spotting and rules bridge tests remain included in the targeted verification run.
