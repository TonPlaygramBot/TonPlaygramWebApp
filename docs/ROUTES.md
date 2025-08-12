# Route Audit

## Frontend Routes

| Route | Component/Module | Params | Sample URL |
|-------|------------------|--------|------------|
| `/` | `Home` | – | `https://host/` |
| `/mining` | `Mining` | – | `https://host/mining` |
| `/games` | `Games` | – | `https://host/games` |
| `/games/crazydice` | `CrazyDiceDuel` | – | `https://host/games/crazydice` |
| `/games/crazydice/lobby` | `CrazyDiceLobby` | – | `https://host/games/crazydice/lobby` |
| `/games/:game/lobby` | `Lobby` | `game` | `https://host/games/snake/lobby` |
| `/games/horse` | `HorseRacing` | – | `https://host/games/horse` |
| `/games/snake` | `SnakeAndLadder` | – | `https://host/games/snake` |
| `/games/snake/mp` | `SnakeMultiplayer` | – | `https://host/games/snake/mp` |
| `/games/snake/results` | `SnakeResults` | – | `https://host/games/snake/results` |
| `/games/fallingball/lobby` | `FallingBallLobby` | – | `https://host/games/fallingball/lobby` |
| `/games/fallingball` | `FallingBall` | – | `https://host/games/fallingball` |
| `/games/airhockey/lobby` | `AirHockeyLobby` | – | `https://host/games/airhockey/lobby` |
| `/games/airhockey` | `AirHockey` | – | `https://host/games/airhockey` |
| `/games/brickbreaker/lobby` | `BrickBreakerLobby` | – | `https://host/games/brickbreaker/lobby` |
| `/games/brickbreaker` | `BrickBreaker` | – | `https://host/games/brickbreaker` |
| `/games/tetrisroyale/lobby` | `TetrisRoyaleLobby` | – | `https://host/games/tetrisroyale/lobby` |
| `/games/tetrisroyale` | `TetrisRoyale` | – | `https://host/games/tetrisroyale` |
| `/games/fruitsliceroyale/lobby` | `FruitSliceRoyaleLobby` | – | `https://host/games/fruitsliceroyale/lobby` |
| `/games/fruitsliceroyale` | `FruitSliceRoyale` | – | `https://host/games/fruitsliceroyale` |
| `/games/bubblepoproyale/lobby` | `BubblePopRoyaleLobby` | – | `https://host/games/bubblepoproyale/lobby` |
| `/games/bubblepoproyale` | `BubblePopRoyale` | – | `https://host/games/bubblepoproyale` |
| `/games/bubblesmashroyale/lobby` | `BubbleSmashRoyaleLobby` | – | `https://host/games/bubblesmashroyale/lobby` |
| `/games/bubblesmashroyale` | `BubbleSmashRoyale` | – | `https://host/games/bubblesmashroyale` |
| `/spin` | `SpinPage` | – | `https://host/spin` |
| `/admin/influencer` | `InfluencerAdmin` | – | `https://host/admin/influencer` |
| `/tasks` | `Tasks` | – | `https://host/tasks` |
| `/store` | `Store` | – | `https://host/store` |
| `/referral` | `Referral` | – | `https://host/referral` |
| `/wallet` | `Wallet` | – | `https://host/wallet` |
| `/messages` | `Messages` | – | `https://host/messages` |
| `/notifications` | `Notifications` | – | `https://host/notifications` |
| `/trending` | `Trending` | – | `https://host/trending` |
| `/account` | `MyAccount` | – | `https://host/account` |

## Backend API Routes (bot/server.js)

| Route | Method | Module | Params | Sample URL |
|-------|--------|--------|--------|------------|
| `/api/ping` | GET | `bot/server.js` | – | `https://host/api/ping` |
| `/api/stats` | GET | `bot/server.js` | – | `https://host/api/stats` |
| `/api/snake/lobbies` | GET | `bot/server.js` | – | `https://host/api/snake/lobbies` |
| `/api/snake/lobby/:id` | GET | `bot/server.js` | `id` | `https://host/api/snake/lobby/123` |
| `/api/snake/board/:id` | GET | `bot/server.js` | `id` | `https://host/api/snake/board/123` |
| `/api/watchers/count/:id` | GET | `bot/server.js` | `id` | `https://host/api/watchers/count/123` |
| `/api/ludo/lobbies` | GET | `bot/server.js` | – | `https://host/api/ludo/lobbies` |
| `/api/ludo/lobby/:id` | GET | `bot/server.js` | `id` | `https://host/api/ludo/lobby/123` |
| `/api/checkers/lobbies` | GET | `bot/server.js` | – | `https://host/api/checkers/lobbies` |
| `/api/checkers/lobby/:id` | GET | `bot/server.js` | `id` | `https://host/api/checkers/lobby/123` |
| `/api/checkers/board/:id` | GET | `bot/server.js` | `id` | `https://host/api/checkers/board/123` |
| `/api/snake/table/seat` | POST | `bot/server.js` | body `{accountId, gameType, stake, maxPlayers}` | `https://host/api/snake/table/seat` |
| `/api/snake/table/unseat` | POST | `bot/server.js` | body `{accountId, tableId}` | `https://host/api/snake/table/unseat` |
| `/api/snake/invite` | POST | `bot/server.js` | body `{fromAccount, toAccount, roomId, token, amount}` | `https://host/api/snake/invite` |
| `/api/snake/results` | GET | `bot/server.js` | query `leaderboard?` | `https://host/api/snake/results` |
| `*` | GET | `bot/server.js` | – | catch-all |

## Invite URL Builders

- `Layout.jsx` constructs invite links with a fallback to `snake` if `invite.game` is missing.
- `bot/utils/notifications.js#getInviteUrl` builds invite URLs and defaults the `game` parameter to `snake`.

These defaults are potential sources of `gameId` ambiguity.

