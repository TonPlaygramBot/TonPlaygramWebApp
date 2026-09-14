# Four in Row human presentation

Four in Row now reuses the Chess/Checkers character catalogue, bundled default
model, seated skeleton, first-person skinned arms, and anatomical finger solver.
The local player stays on the near side; the board and column order never rotate.
The camera anchors to the local character's eyes and fits the board to portrait
width. Two chairs correspond to the two players.

Each seat has three instanced stacks containing its remaining chips (21 per
player for 7×6, 28 for 8×7). An accepted move replaces the exact top reserve
instance with the moving chip at the same position. The hand reaches, grips,
lifts clear of the board, turns the chip upright, carries it to the selected
opening, releases it, and withdraws. Gravity selects the existing legal landing
row. One clock drives the hand and chip; online moves queue in order, and new
character downloads install only once that queue is empty. Reconnects and resets
rebuild reserves from the authoritative board. The existing WebGL fallback,
AI rules, online protocol, audio, customization, and social controls remain.

The interface has a compact match header, remaining-chip counts, larger column
buttons, and a larger board with flatter chips that fit through the openings.
Scene lighting and shadow framing emphasize the table, board, and characters.

## Validation

From the repository root, with the existing webapp dependencies installed:

```sh
npm run test:fourinrow --prefix webapp -- --maxWorkers=1
node --test test/fourInRowHumans.node.mjs
```

The gameplay suite covers AI rounds, full columns, wins/draws, rapid taps,
reconnects, revision ordering, acknowledgement timeouts, fallback rendering,
replay, animation timing, and consecutive queued online presentations.

The real-model suite covers 90 trajectories across both seats, every column of
both supported layouts, and all three reserve stacks. It checks grip before
lift, hand contact, board clearance, one gravity impact, withdrawal, reserve
counts, and player-eye projection at 320×740, 390×844, and 430×932. The maximum
sampled contact error was 0.103 chip radii. Frame-rate cases cover 30–240 Hz.
The new presentation module passes strict TypeScript checking.

`webapp/four-in-row-review.html` opens the production game through its ordinary
Vite development server without the app shell. The separate
`webapp/scripts/four-in-row-movement-preview.tsx` is a service-free playable
movement demonstration using the production rules, human controller, camera,
and real model with a lightweight table stage. It is not the full application.

Browser visual verification was blocked by this session's browser URL policy.
Geometry checks do not establish skin appearance, clothing/table intersection,
lighting quality, optional remote character compatibility, or mobile GPU frame
rate. Review the production game on a portrait phone, including both seats in an
online match, before calling the visual refinement complete.
