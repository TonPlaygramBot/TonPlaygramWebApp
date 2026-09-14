# Pool Royal reference behavior

Pool Royal's live `8ball` and `9ball` variants now select `meta.ruleProfile = 'reference'`. The behavior follows the active controllers of [tailuge/billiards at d5779e3](https://github.com/tailuge/billiards/tree/d5779e342c077d1a3b2930c09f2d9f8c8b6a2b88/src/controller/rules), including its deliberately simplified eight-ball outcomes. UK pool is unchanged.

The reference is GPLv3 licensed. This change independently implements the observed game behavior; no source code or assets from that repository are included.

## Eight-ball

- A legal pot from exactly one group assigns solids/stripes, including on the opening shot. Mixed pots leave an open table open.
- An open table must first contact a non-eight object ball. After assignment, first contact must be an own-group ball while any remain at the start of the shot; otherwise it must be the eight.
- An own-group pot retains the inning, including a shot that also pots an opponent's ball. An opponent-only pot passes the inning without a foul. Open-table legal non-eight pots retain the inning.
- Legal first contact followed by a pot requires no additional cushion. A dry shot requires a cushion after object contact. Misses, wrong first contact and scratches give the opponent full-table ball in hand.
- The opening shot uses the same contact/cushion rules. The reference has no four-object-ball break requirement.

The reference intentionally treats the eight differently from standard BCA rules. The implementation preserves these exact cases:

| Eight potted | Outcome |
| --- | --- |
| Otherwise legal shot, group already assigned, own group empty after this shot's pots | Shooter wins; the last own ball and eight may go down together after first contacting the own ball. |
| Otherwise legal shot, group unassigned or own balls remain | Eight respots; opponent receives ball in hand. |
| Foul, group already assigned, any other object ball remains after the pots | Eight respots; opponent receives ball in hand. |
| Foul, group unassigned or no other object ball remains | Shooter loses. |

For example, contacting an own-group ball and potting the eight early respots it. First contacting and potting the eight on an open table loses. Scratching with the eight when assigned respots it if any other object ball is still on the table, even if that ball belongs to the opponent. These are documented reference rules, not claims of tournament BCA compliance.

## Nine-ball

- First contact must be the lowest-numbered ball present at the start of the shot, including a lowest ball potted during that shot.
- Any object ball may be potted after that legal first contact. A legal nine wins immediately, including a combination or the opening shot.
- Any legal object pot retains the inning; a legal dry shot passes it. A dry shot requires a cushion after first contact.
- No contact, wrong first contact or a scratch gives full-table ball in hand. A nine potted on a foul respots; other object balls stay down.
- The reference has no four-object-ball break gate, push-out/called-pocket flow or three-consecutive-foul loss. The live HUD does not display the standard profile's three-foul warning.

## Integration and safeguards

`PoolRoyaleRules` defaults to the reference profile for live eight-ball and nine-ball, and serializes the profile so reconstructed frames retain their rule selection. Direct `BcaEightBall` and `NineBall` library users retain the existing `standard` default; callers can explicitly choose `{ profile: 'reference' }`. A standard adapter is also available through `new PoolRoyaleRules(variant, 'standard')`.

Rule input normalizes exact numbered ball IDs (`ball_1`, `1`, `1` as a number) and cue IDs. Only unique balls present before the shot can score, retain a turn or satisfy a pot exception. Malformed or repeated pocket notifications cannot invent pots. Distinct physical rail identities remain available to the standard profile. Explicit foul events and explicit no-contact/no-cushion context are respected. Completed frames ignore delayed shot notifications.

The serialized remaining-ball set drives the existing physical spotting pipeline. Reference early-eight respots therefore remain visible and playable, and nine foul respots use the same pipeline. Rule execution uses the pre-shot set for first-contact checks and applies potted-ball removals before evaluating the reference eight-ball finish.

## Spin and game timing

The spin selector now uses continuous radial input with a neutral center and literal screen directions. It no longer rotates with the camera, snaps to rings or adds a default top-spin bias. The visible cue contact and physical strike use the same offset, capped at 45% of the ball radius.

The strike applies angular momentum once. Cloth friction produces follow and draw, angular velocity survives the first object-ball contact, and a bounded cushion friction impulse produces side-spin rebound. A stationary cue with remaining planar slip continues moving; side spin alone does not delay turn completion. The simulation clock is independent of the selected rendering frame rate, with live-substep regressions at 30, 60 and 120 Hz.

These are independent changes to the existing Pool Royal engine. The table scale and local collision solver remain in use; this is not a claim of identical trajectories to the reference's entire physics engine.

## Verification

`npm test -- --runInBand test/poolRoyaleRules.test.ts test/poolReferenceRules.test.js test/nineBall.test.js test/poolRoyaleShotLifecycle.test.js test/poolReferenceIntegration.test.ts`

The 59 passing checks cover default reference selection and serialized restoration, group assignment on the opening shot, mixed/group pots, exact early-eight and scratch outcomes, nine combinations and spotting, foul/turn decisions, physical ball identity, delayed notifications, actual adapter-to-spotting integration, and preserved standard-profile behavior. `test/poolRoyaleSpinController.test.js` additionally covers selector mapping, cue impact, cloth/cushion spin, motion completion and the production frame clock.
