# Snake & Ladder upgrade review

The game now uses a portrait header with player photos, positions and turn highlighting, plus one dock for chat, gifts, camera view, loadout, audio and rolling. Buttons have 44px or larger targets. The roll panel shows die pips, a visible countdown, exact-finish guidance, and separate opening/reconnecting/finished states. Settings use the shared accessible dialog, with collapsible appearance and graphics sections. Cancelling a lobby exit keeps the current match.

## Gameplay and rendering fixes

- The actual 3D board and server finish on tile **50**. The client previously imported **51** from the unused legacy 2D board, so local games could attempt to move to an unmapped tile. `lib/snakeRules.js` now defines the shared finish and movement rules used by local human/AI turns, the server, and dice receiver prediction.
- Legacy local saves already at tile 50 are restored as finished before catch-up moves; restoring does not make new payout calls.
- A six on an overshoot keeps the AI's turn just as it does for a human. Mixed multi-die throws enter with any six, but only all-sixes award another turn. A roll that stays in place cannot retrigger a snake, bonus or capture.
- Disconnecting the current online player synchronizes room and game turn ownership and skips absent seats. Rejoining can restart a cancelled opening countdown; rejoining another seat does not reset an active turn deadline.
- Dismissing a connection notice preserves the disconnected input lock. Changing sound settings does not reset the local turn timer.
- Render throttling no longer adds scheduling carry to animation time. HDR backgrounds no longer upload every frame; PMREM targets and late-loading HDR resources are released when the arena is disposed.
- New installations default to the balanced 60 FPS option. Existing saved graphics choices remain respected. The scene, authored assets and player camera placement remain the existing production implementation.

## Validation

- `npm --prefix webapp run test:snake`: **143 passing tests**, including actual React turn flows with mocked renderer/network, local finish at 49 + 1, overshoots, disconnect recovery, UI actions, renderer timing, original camera geometry, dice and weapon interactions.
- `node --test test/snakeGame.test.js test/checkersLaunch.node.mjs bot/tests/checkersRealtimeState.test.js`: **48 passing tests** (19 Snake + 29 Checkers).
- `npm run build`: root TypeScript build passes.
- Targeted TypeScript checks for `SnakeGameChrome.tsx` and `SnakeTurnPanel.tsx` pass.
- `git diff --check` and browser-script syntax check pass.
- Final production Vite compilation: pending final verification.

## Visual/device check

`/snake-player-review.html?ai=1` mounts the real React game and Three.js scene; it remains included in the normal production build. `scripts/check-snake-upgrade.mjs` runs the real page at 390 × 844 and 320 × 740, checks bounds, non-overlapping touch targets, roll locking, both camera modes, settings and rules, and writes screenshots plus diagnostics.

Run from the repository root:

```sh
CHROMIUM_PATH=/usr/bin/chromium node scripts/check-snake-upgrade.mjs
```

Browser execution is blocked in this workspace: Chromium exits at startup with `socket() failed: Operation not permitted`; the shared browser cannot reach the local Vite server (`ERR_CONNECTION_REFUSED`). No rendered screenshots, physical-phone FPS, live video call or two-device multiplayer pass is claimed. Full asset vendoring/deployment is not part of the Vite compile check. The seat API integration suite also needs backend dependencies absent from the available installation (`telegraf`). Validate portrait framing, real asset loading and a two-phone reconnect/call session on the deployed review build before merging.
