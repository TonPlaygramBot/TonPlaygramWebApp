# Albanian Billiards (15-Ball Rotation) — Race to 61

This mode is deliberately implemented as its own `albanian` ruleset. It does
not reuse or alter the 8Ball, UK 8Ball, or 9-Ball win conditions.

## Objective
- Use balls **1–15**.
- Pocketed balls score their face value (e.g., ball 7 = 7 points).
- First player to reach **61 points** wins the frame immediately.

## Core shot rule
- The cue ball must first contact the **lowest-numbered ball still on the table**.
- A legal shot also requires either:
  - at least one object ball to be pocketed, or
  - a cushion contact after the first object-ball contact.

## Turn flow
- If the shooter legally pockets one or more balls, the shooter continues.
- If no object ball is pocketed on a legal shot, turn passes.
- On a foul, turn passes and opponent receives ball-in-hand.

## Fouls (implemented)
- No first contact with an object ball (`no contact`).
- First contact is not the lowest available ball (`wrong first contact`).
- Cue ball pocketed or off the table (`scratch`).
- No cushion after contact when nothing is pocketed (`no cushion`).

## End of frame
- Immediate win when a player reaches **61+** points.
- If all balls are gone before anyone reaches 61, higher score wins.
- Equal scores at clear table result in a tie.

## Research basis

The Albanian game requested here follows the established 15-ball **rotation**
family: balls score their printed number, the lowest numbered ball must be hit
first, any legally pocketed ball counts, and the 120 available points make 61
the winning majority. These references were consulted while defining the mode:

- [Rotation overview and 61-point scoring](https://en.wikipedia.org/wiki/Rotation_(pool))
- [Virtual Pool 4 rotation rules](https://vponline.celeris.com/support/rules/id/11)
- [Albanian Billiards and Snooker Federation rules portal](https://fshbs.al/rregullat/)

Where local rule traditions vary, Pool Royale uses the explicit foul handling
above so AI, local, and online matches remain deterministic.
