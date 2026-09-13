# Ludo Battle Royal gameplay review

Base reviewed: `main` at `0c6b83ee24461800762c990151842113f8df1f0f`.

## Changes

- Practice and the authoritative server now share token entry, exact finish, and capture rules. Starting squares and stars protect tokens; practice captures grant the same bonus turn as online play. Progress 57 is the finished position in both modes and renders in the goal slots.
- Practice commits the next turn before scheduling dice timers. Previously this depended on React immediately executing a state updater, which can stall the human turn with batched updates.
- A pending result, token choice, movement, or finished game blocks another roll before any timers or selection are cleared. Winner seat zero is handled explicitly.
- Online snapshots invalidate older dice animations, move completions, and delayed selection. Duplicate action revisions do not replay. A sync restores the pending die face and current legal selection.
- The existing status text is now visible, including token-selection instructions and victory. The menu exposes the existing rules dialog; online reload is labeled “Reconnect to game.” Scene startup errors show a retry instruction.

## Verification completed

`node --test bot/tests/ludoBattleGame.test.js test/ludoBattleRules.test.mjs test/ludoBattleGameplay.test.mjs`

16 tests pass. Coverage includes all eight safe cells, exact finishes, captures, bonus turns, no-move rolls, stale commands, repeated input, local winner seat zero, deferred React updates, goal placement, duplicate online actions, and superseded animation completions. The simulation test completes 36 seeded server matches across two, three, and four players. Controller tests execute the actual scene closures with controlled scene objects and timing; they are not browser playtests.

The full webapp Vite production compilation passes (2,805 modules). Existing bundle-size warnings remain. Dependencies and the lockfile are unchanged. The build used Vite directly; unrelated asset-generation/native-release scripts and the full monorepo suite were not run.

`git diff --check` passes.

## Remaining verification and findings

Live browser playtesting could not be completed: browser recovery repeatedly failed, and the preview was unreachable from the browser environment. No claim is made for live portrait rendering, touch hit areas, frame rate, capture sound/animation quality, or live authenticated multiplayer testing. This change should remain a draft pending those checks.

The source review also identified existing issues outside these focused fixes:

- The two-/three-player online visual-seat mapping uses the active player count, while capture offsets use a four-seat ring. Cross-client geometry needs a dedicated check and seating fix; four-player rotation is consistent with the server offsets.
- Changing token appearance rebuilds the board and resets practice progress. Preserving an in-flight move during cosmetic reconstruction needs a separate lifecycle change.
- If every external chess-model URL fails, the last token fallback is an empty Three.js group. Asset failure needs a visible, selectable fallback and a cold-load test.

Before merging, play practice with one and three AI opponents on a portrait phone; check rolls, highlighted token selection, safe cells, captures, exact finishes, menu access, audio, and leaving/reopening the game. Test an online reconnect during both a throw and movement against a staging server, including two-/three-player seat geometry. Real stakes were not used during this review.
