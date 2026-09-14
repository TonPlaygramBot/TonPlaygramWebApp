---
title: Snooker fouls and scoring
slug: snooker-fouls-scoring
locale: en
version: 1.1.0
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
- A no-contact miss after red with no declaration uses the reference game's four-point minimum. A declared black miss costs seven. This automatic nomination convention does not implement the referee's separate seven-point penalty for a foul before nomination.
- Reds potted during a foul remain down. Potted colours are respotted, including during ordered clearance. The next player starts on red while reds remain, otherwise the lowest remaining colour.
- A scratch gives the incoming player cue placement within the D. The opening shot also starts with placement in the D.

## Free balls and deciding black
- An awarded free ball can be declined. If used, nominate an on-table ball other than the actual ball on; it must be contacted first and takes the actual ball-on value.
- The nominated substitute is respotted if potted. With reds on, score each real red plus the substitute. During colour clearance, potting both the substitute and actual target scores the target only once; the target stays down.
- A final-black pot or foul ends the frame unless it ties the scores. A tie respots black and grants D placement to the supplied deciding-black starter. The next pot or foul resolves the frame. Highest breaks include all legally scored points before the visit resets.

## Implementation scope and references
`src/rules/SnookerRoyalRules.ts` is an independent implementation. No source from the GPL-3.0 [tailuge/billiards project](https://github.com/tailuge/billiards/blob/master/LICENSE) was imported. Its [active snooker engine](https://github.com/tailuge/billiards/blob/master/src/controller/rules/snooker.ts) is the behavioural reference for red/colour alternation, fouls, respots and automatic nomination.

Existing free-ball and deciding-black support is retained beyond that reference engine; free-ball scoring follows Section 3 Rule 12 of the [WPBSA rulebook](https://wpbsa.com/wp-content/uploads/Rulebook-Website-Updated-May-2022-2.pdf). The caller supplies snooker detection and physical D placement/respots. Referee decisions such as foul-and-miss replacement, simultaneous first contacts, touching balls and an illegal snooker behind the nominated free ball are not inferred by this shot-event interface.
