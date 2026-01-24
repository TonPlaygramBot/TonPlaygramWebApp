# Game art drop-in folder (not tracked)

This directory is intentionally ignored by Git so high-resolution game art can be dropped in without
appearing in PRs. Add the production-ready assets here or host them on a CDN and set
`VITE_GAME_ASSET_BASE_URL` to the CDN root.

Expected structure:

```
games/
  texas-holdem.webp
  domino-royal.webp
  pool-royale.webp
  snooker-royale.webp
  goal-rush.webp
  air-hockey.webp
  snake-ladder.webp
  murlan-royale.webp
  chess-battle-royal.webp
  ludo-battle-royal.webp
lobby/
  texas-holdem/
  domino-royal/
  pool-royale/
  snooker-royale/
  goal-rush/
  air-hockey/
  snake/
  murlan-royale/
  chess-battle-royal/
  ludo-battle-royal/
variants/
  pool-royale/
```

Use the filenames defined in `webapp/src/config/gameAssets.js` so the UI loads the right art.
