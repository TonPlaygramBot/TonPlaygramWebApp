# Backgammon characters, presentation and rules

The existing `/games/tavullbattleroyal` route now uses Backgammon-owned
presentation, graphics, asset lifecycle and match-controller modules. The
production page remains React; the new animation and interaction controllers
are TypeScript and Three.js.

## Characters and mobile view

- Uses the same owned character catalogue, bundled default human, materials,
  skeleton adapter and first-person arms as Chess/Checkers Battle Royal.
- Keeps the local player at the visually lower seat for either lobby color. Switching between the
  seated player view and overhead view never rotates the board or changes touch
  coordinates. Portrait framing includes the board and the opponent's head.
- Checkers use the shared 1.6-second reach, pinch, lift, carry, place and release
  timeline. Logical moves commit after the hand withdraws. Captures, bar entry
  and bearing off use the same path. Cosmetic downloads wait for active motion
  before installing a replacement character.
- Dice follow Ludo's 550/170/360/260 ms pickup, close, windup and release phases
  with the actual palm effector. Both dice retain their palm-local transforms;
  dice on opposite halves after the opening roll are gathered first. The shared
  elapsed-time royal-dice motion handles flight and the preselected result.
- Input is locked throughout an action. Restart and unmount invalidate pending
  promises. Tap detection uses pointer-up with a drag threshold, actual checker
  meshes, then the entire triangle. Bar and off controls also have explicit
  touch buttons. A legal-move list provides an alternative to small 3D targets.

## Rules

The pure match controller covers opening rolls and ties, both directions,
blocked points, hits, compulsory bar entry, maximum dice use, the higher-die
rule, four moves for doubles, blocked turns, exact and oversized bearing off,
and immediate completion after the fifteenth checker. Each human move is chosen
separately; subsequent choices are restricted to valid remaining turn sequences.

Match play supports 1/3/5/7-point UI choices, a centered cube, take/drop,
redoubling by the cube owner before rolling, scoring at the old cube value on a
drop, single/gammon/backgammon results, and the one-game Crawford restriction.
Automatic opening doubles, beavers, Jacoby, tournament clocks and physical
irregularities are not enabled. The animated dice always land in their reserved
clear lane with a valid face; they do not determine the random result.

References: [Backgammon rules](https://www.bkgm.com/rules.html) and
[USBGF introduction to match play](https://usbgf.org/).

The old AI's unbounded reply enumeration ran on the rendering thread. It now
scores each distinct legal outcome once, and still uses the same rules engine
as the player. This is a bounded local opponent, not a tournament-strength AI.

## Graphics and assets

The menu includes all 33 Murlan HDRI environments, all 14 table choices and all
19 Murlan chair choices (plus Backgammon's legacy colors). Existing furniture
ownership is respected; unowned entries remain visible with a Store label.
HDRI defaults match Murlan's full unlocked environment catalogue. Existing
custom Backgammon HDRI URLs are passed directly instead of silently resolving
to environment index zero.

Backgammon stores its graphics profile separately and provides the same
Performance 60 Hz / 2K, Smooth 90 Hz / 4K and Ultra 120 Hz / 8K targets as Murlan.
These are caps, not guarantees of device frame rate. The renderer and asset
resolution order both change with the profile. Smaller asset resolutions are
fallbacks. Asset failures retain current furniture/lighting; superseded loads
are disposed.

### Matching Chess arena sizes

`arenaLayout.ts` copies the sizing and fitting rules from
`ChessBattleRoyal.jsx` on `main` (reviewed at `394a9c3`). Poly Haven tables
use the Coffee Table 01 reference: a 1.46335728-unit footprint in both
directions and a 0.627177853-unit height. The procedural table uses Chess's
shape and short-pedestal factors, then rests on the same floor. The board,
checker and dice groups follow the resulting tabletop height, including the
lower procedural surface.

All chairs use Chess's maximum-dimension normalization, footprint centering,
0.570486 overall scale, 1.14 horizontal factor, seat distances and floor
alignment. The existing Backgammon board geometry uses one uniform conversion
to the new arena units; raycast coordinates, hand contact and camera framing
use that same conversion. Table replacements wait for an active move to finish.

HDRIs now use `GroundedSkybox` with Chess's 1.5-unit default camera height,
0.9 minimum height, 24-unit minimum radius, 6× room-span radius and 256 default
resolution. Every environment retains its catalogue overrides. The floor and
skybox stay fixed when changing view or resizing the phone.

Direct comparisons against the Chess JSX fitting functions passed for three
table fixtures, six seated chair fixtures and all 33 catalogue HDRIs plus
three default/custom configurations. Portrait touch-coordinate round trips
passed at both table heights. The existing real-skeleton interaction and
camera tests now cover both surfaces.

## Online availability

The previous lobby offered paid online matchmaking, but the Backgammon page
ignored the resulting online session and always started a local AI game. No
Backgammon authoritative socket handlers exist in the backend. The online
option and direct online URL now stop before play, and the lobby checks
availability before any stake debit. This change implements local match play;
networked Backgammon and settlement still need a separate implementation.

## Reproducible checks and preview

With Node 24 and webapp dependencies installed:

```sh
npm run test:backgammon
node scripts/build-backgammon-preview.mjs /workspace/backgammon-royal.html
```

The suite covers rules, eight seeded games to completion with piece conservation,
real GLB skeleton contact from both seats, dice attachment and landing, portrait
projection, rapid repeated input, incremental placement, committed-board synchronization,
both local colors and cancellation during pickup. The 27 tests pass. The TypeScript modules also pass a focused strict no-emit
check, and the webapp Vite production build passed.

`webapp/backgammon-preview.html` runs the actual production component through
Vite. The generated in-chat preview runs the same component and game controller,
with the actual character mesh/skeleton, procedural table geometry and the
same chair fitting. It uses simplified local lighting and omits account
chat/gifts and remote furniture/HDRI selection.

Live browser verification was blocked by this environment's
`ERR_BLOCKED_BY_CLIENT` policy. Automated projection/contact tests do not verify
WebGL appearance, finger/table occlusion, arbitrary cosmetic combinations or
phone GPU performance. Review those on a portrait phone before release.
