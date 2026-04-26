# Bilardo Shqip — Race to 61 (Rotation-style)

## Concept
- Uses the full **numbered solids/stripes set (1–15)** plus cue ball.
- Every legally pocketed object ball scores its **face value**.
- First player to reach **61 points** wins.

## Core shot legality
- Cue ball must first contact the **lowest-numbered ball currently on the table**.
- Scratch (cue ball potted) is a foul.
- No first contact with object ball is a foul.

## Turn flow
- Legal pot: shooter keeps turn.
- No legal pot or foul: turn passes.
- Foul grants opponent cue-ball-in-hand.

## Continuous race behaviour
- This implementation is a continuous race:
  - If all 15 object balls are cleared and no one has reached 61,
  - the rack is reset to balls 1–15 and play continues.

## Notes
- This rule profile is designed for Bilardo Shqip gameplay while reusing Pool Royale visual assets (cue/table/balls/HDRI catalog) through separate game logic code.
