# Checkers human characters

Checkers now uses Chess Battle Royal's character catalogue, owned/equipped
character selection, material treatment, seated skeleton pose, anatomical finger
calibration, and physical piece movement. The default human loads from the
existing bundled `assets/table-tennis/chess-human.glb` in both games.

Every move uses the shared 1.6-second reach, grip, lift, carry, placement, release,
and withdrawal sequence. Checker dimensions determine the grip. Each capture in
a chain queues separately, its victim remains visible until placement, and the
AI waits for the hand to withdraw. Character downloads cannot replace an active
rig halfway through a carry.

The local character occupies the bottom seat regardless of online piece colour.
The board coordinates and touch mapping stay fixed. In the close 3D view, only
the player's actual skinned arms are rendered; 2D restores the full character.
Portrait framing includes the opponent's head and all board corners.

## Verification

Run from the repository root with Node 24 and installed webapp dependencies:

```sh
node --test test/checkersHumanActors.node.mjs test/chessPhysicalMove.node.mjs test/chessRules.node.mjs test/checkersLaunch.node.mjs
```

All 55 tests passed, including real GLB skeleton contact from both seats,
corner/king-row moves, skin visibility and disposal, portrait projection, and
the existing Chess/Checkers rules and replay regressions. The Checkers suite
completed 12 AI matches with 154 captures. A separate comparison against `main`
confirmed the shared pose matches the old Chess pose in 75 sampled cases.
Strict TypeScript checking and the Vite production build also passed.

`webapp/scripts/checkers-human-preview.tsx` uses the production movement
controller and the bundled human in a small standalone board stage. It is a
movement demonstration, not a multiplayer game or a production screenshot.

Browser verification was blocked by this session's browser policy. Before
release, play on a portrait phone to confirm character/chair fit, finger contact,
capture chains, character changes, 2D/3D switching, and an online match from both
seats. Remote optional character variants and device GPU performance still need
that visual check; automated geometry tests do not establish launch readiness.
