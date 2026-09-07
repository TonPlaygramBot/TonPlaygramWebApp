# Archery Royal

Archery Royal is a portrait-first 3D target-archery game with three complete entry modes:

- **Vs AI:** Club, Tour and Pro opponents use the same deterministic wind and ring solver as the player.
- **Career:** five rotating tournament venues, persistent level/XP/coins, wins/losses and bow upgrades.
- **TPG Online:** two-player same-stake matchmaking, private room codes, server-owned turns, shot resolution, score, timeouts, reconnect/forfeit handling and transactional settlement.

## Match and controls

Each archer fires three arrows per end for three ends. The higher total after nine arrows wins. Drag the arena to move the sight, hold **DRAW** to charge power, and release to fire. Keyboard players can aim with the arrow keys and draw with Space.

The shared rules module rejects non-finite or out-of-range aim/power input. Wind is generated deterministically from the server match seed and turn number. The backend receives only bounded shot intent; it owns impact coordinates, ring score, turn order and the winner. Clients cannot submit a score or result.

## Visual and audio pipeline

- Three.js WebGL renderer with ACES tone mapping, soft 2048 px shadows, HDR image-based lighting, fog, anisotropic textures and a capped device pixel ratio.
- Original 2048 × 2048 target face and 1024 × 1024 grass texture generated at runtime, plus original bow, arrow, target, range, banner and vegetation geometry.
- Existing optimized Quaternius Universal Base Character athletes from Table Tennis Royal. They are CC0; provenance and the copied license remain in `webapp/public/assets/table-tennis/CREDITS.md` and `Quaternius-LICENSE.txt`.
- Existing Poly Haven 1K Radiance HDR environments from Table Tennis Royal: Dancing Hall, Colorful Studio and Neon Photostudio. They are CC0 and their source links remain in the same credits file.
- Original synthesized bow-string, impact and victory audio. No sampled music or unlicensed third-party sound is added.

No new binary asset is duplicated in this change. The game loads the existing locally bundled athlete GLBs and HDR files.

## Online contract

The lobby uses `runSimpleOnlineFlow` with `gameType: archeryroyal`, two seats and TPG-only stakes. The dedicated runtime exposes `archery:join`, `archery:shot`, `archery:sync`, `archery:suspend` and `archery:leave`. A dedicated `ArcheryMatch` collection keeps reservations separate from Racing Royal while reusing the audited transactional stake service.

The runtime rate-limits joins, shots and syncs; binds every action to the registered socket identity; rejects stale turns and duplicate request IDs; allows 30 seconds to reconnect; records missed turns; and settles payouts/refunds idempotently from backend state.

## Release checks

- Run `node scripts/buildArcheryRoyal.mjs` after editing the TypeScript rules source.
- Run `node --test test/archeryRoyal.test.mjs`.
- Run `./node_modules/.bin/tsc -p tsconfig.archery-royal.json`.
- Run the production WebApp build.

Physical iOS/Android testing remains required for GPU performance, HDR memory pressure, long-press touch behavior and live MongoDB settlement/reconnect behavior before production release.
