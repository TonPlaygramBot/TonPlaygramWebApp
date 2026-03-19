# American Billiards (Rotation) — Race to 61

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
