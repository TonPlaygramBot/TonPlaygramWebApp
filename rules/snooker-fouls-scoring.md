---
title: Snooker fouls and scoring
slug: snooker-fouls-scoring
locale: en
version: 1.2.0
---
## Scoring
- Reds are worth 1 point each.
- Yellow, green, brown, blue, pink and black are worth 2–7 respectively.
- A legal red pot earns a shot at one colour. That colour is respotted, including the colour after the last red. Multiple reds may score in one stroke.
- After the final red and its colour, clear yellow through black in order. Legally cleared colours stay down.
- A legal scoring shot continues the break. A legal non-scoring shot ends the visit. No cushion contact is required for an ordinary snooker safety.

## Nominations and shot events
- After red, a supplied colour declaration must match first contact and the colour potted. Without a declaration, the first colour contacted is treated as nominated, matching the reference game's automatic nomination.
- Ball IDs identify physical balls, case-insensitively. Duplicate, unknown and already-removed pot IDs do not score or remove a replacement ball. Distinct red pots should include their distinct IDs.
- The rules evaluate a complete shot once, after the balls stop, using the frame from before that shot. Replaying an entire shot against a new frame is the caller's responsibility to prevent.

## Foul values
- A foul awards the opponent the highest of four points, the ball-on value and the values involved in the foul; the striker scores no pots.
- The live standard profile awards seven for a foul after red before any colour was nominated. The explicit legacy `reference` profile retains its four-point minimum. A declared black miss costs seven in either profile.
- Reds potted during a foul remain down. Potted colours are respotted, including during ordered clearance. The next player starts on red while reds remain, otherwise the lowest remaining colour.
- A scratch gives the incoming player cue placement within the D. The opening shot also starts with placement in the D.
- Reported off-table reds remain removed and off-table colours are respotted. An off-table cue gives ball in hand. Duplicate pot/off-table reports do not remove a red twice.

## Referee choices and touching balls
- After a foul, the incoming player can accept the position or ask the offender to play again from it. A called miss additionally offers restoration of the original layout, with all penalty points retained.
- `inspectSnookerDirectContact` records direct-contact evidence before the stroke. A failed first contact with a proven available direct path is called a miss unless penalty points are already needed, or become needed after the stroke. An obstructed failed escape is not automatically treated as a miss.
- After restoration of a position offering full-ball contact, the second repeated miss prompts a warning when the balls are replaced again. A further miss after that warning awards the opponent the frame. Playing from the position left ends this sequence. Edge-only visibility does not trigger this frame-loss sequence.
- A touching ball on can fulfil the contact requirement when the cue is played away. Initial movement into a touching object ball is treated as a push stroke. The live caller must supply pre-shot touching IDs and direction evidence; a later collision is not itself proof of a push.
- Rule replacement snapshots contain only the original balls, phase, colour order and ball-in-hand state. The renderer supplies a separate scene layout for local/online restoration. A replacement cancels the free-ball option and starts a new break.

## Free balls and deciding black
- An awarded free ball can be declined. If used, nominate an on-table ball other than the actual ball on; it must be contacted first and takes the actual ball-on value.
- The nominated substitute is respotted if potted. With reds on, score each real red plus the substitute. During colour clearance, potting both the substitute and actual target scores the target only once; the target stays down.
- A final-black pot or foul ends the frame unless it ties the scores. A tie respots black; the draw winner chooses who plays next from the D. The live caller supplies one draw result, and strokes are blocked until that choice is resolved. The next pot or foul resolves the frame. Highest breaks include all legally scored points before the visit resets.

## Implementation scope and references
`src/rules/SnookerRoyalRules.ts` is an independent implementation. No source from the GPL-3.0 [tailuge/billiards project](https://github.com/tailuge/billiards/blob/master/LICENSE) was imported. Its [active snooker engine](https://github.com/tailuge/billiards/blob/master/src/controller/rules/snooker.ts) is the behavioural reference for red/colour alternation, fouls, respots and automatic nomination.

The review uses the [WPBSA rules page](https://wpbsa.com/rules/) and its current [September 2024 rulebook](https://www.wpbsa.com/wp-content/uploads/2198_WPBSA-Rulebook-2024-25.pdf), particularly sections 2.17 and 3.3, 3.7, 3.8, 3.11–3.14. The caller supplies pre-shot evidence, settled snooker detection and physical D placement/respots.

Competition limitations remain: the engine does not infer referee judgment about the quality of an obstructed escape, simultaneous first impacts, or a prohibited safety behind a nominated free ball. Free-ball detection while in hand does not prove obstruction from every possible point in the D and therefore deliberately declines to award one automatically. Off-table handling is supported when reported, but the current planar physics normally keeps balls within the cushion boundary. These limitations must be resolved before describing the game as a complete professional referee simulation.
