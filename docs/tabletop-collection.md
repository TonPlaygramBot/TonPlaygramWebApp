# Five original tabletop games

Adds Oligarchs, Harbor Empires, Mosaic Royal, Rail Kingdoms and Gem Syndicate to the Games catalog and router. Each has 2/3/4-player AI practice and a dedicated lobby with same-stake TPG matchmaking, private codes and reconnect. Online games contain human seats only. AI practice and in-game credits never touch the wallet.

The designs draw on the property, settlement, tile-drafting, route-building and resource-engine genres. These are new compact rulesets, not licensed editions or games with existing user ratings. Reference genre choices include the jury-reviewed [Catan](https://www.spiel-des-jahres.de/spiele/die-siedler-von-catan/), [Azul](https://www.spiel-des-jahres.de/spiele/azul/), [Ticket to Ride](https://www.spiel-des-jahres.de/spiele/zug-um-zug/) and [Splendor](https://www.spiel-des-jahres.de/spiele/splendor/). No original board layout, artwork, branding or card text from those games is included.

| Game | Core loop | Finish |
| --- | --- | --- |
| Oligarchs | Roll, buy/auction districts, collect rent, develop/sell properties | Last solvent player or highest net worth after 16 rounds |
| Harbor Empires | Produce resources, trade 3:1, build adjacent harbors/cities | 12 points triggers final round; 20-round cap |
| Mosaic Royal | Draft one color, fill pattern rows, score wall adjacency | Five rounds plus row/column bonuses |
| Rail Kingdoms | Collect cargo, claim routes, connect delivery contracts | All routes claimed or 20 rounds |
| Gem Syndicate | Collect gems, acquire permanent discounts, reserve workshops | 15 prestige triggers final round; 25-round cap |

## Architecture

- `webapp/src/games/tabletop/shared`: pure rule state machine, legal action enumeration, bounded AI and public snapshot projection. No React, sockets, wallet or asset concerns.
- React + TypeScript renders controls and a Three.js board. The room reuses Domino's table/chairs and three existing bundled HDRIs. Game pieces are shared Blender meshes; the 68 KB GLB is loaded once per mounted room. Pixel ratio is capped at 1.5, and the room renders only after changes or resize. Textures and scene resources are disposed on teardown.
- `bot/services/tabletop.js`: server-controlled game state, action revisions, duplicate request handling, socket identity binding, roster admission, device replacement and per-player action sets. Crypto-generated private entropy is used for online initial decks and subsequent dice/drafts; seeds, entropy and unrevealed decks are excluded from snapshots.
- Existing `runSimpleOnlineFlow`, `seatTable`, `confirmReady`, and `gameStart` own matchmaking. `onlineGamePolicy` validates game type, 2–4 seats, classic rules and safe integer TPG stakes.
- Existing transactional `createKartStakeService` supplies reserve/refund/payout behavior. Each game has a separate match model/collection and ledger prefix. Only the server chooses a winner; ties refund all stakes. The shared disconnect handler preserves active tabletop account locks.

## Match lifecycle

All seats must connect within 60 seconds or the start is refunded. Each acting seat has 60 seconds; expiration forfeits the seat. Disconnected players have up to 60 seconds, subject to the current turn deadline. Returning to an already forfeited match allows watching, not playing. If everyone disconnects simultaneously, all stakes are refunded. The 30-minute hard limit refunds unfinished matches. Persisted reservations expire after 35 minutes and the existing recovery loop refunds them after server restart. Active board positions are in memory; restart recovery refunds rather than resumes play.

A decisive result pays the entire reserved pot once. Failed settlement stays pending and retries; a completed room remains available for one minute. Private-room codes are the invitation mechanism, so these entries are excluded from the unrelated generic invite flow.

## Verification and local preview

```sh
npm ci --ignore-scripts
npm ci --prefix bot --ignore-scripts
npm ci --prefix webapp --ignore-scripts
npm run test:tabletop
npm run test:tabletop --prefix webapp
npm run build --prefix webapp
```

`webapp/tabletop-preview.html` is a development-only entry that mounts the same games/lobbies without the unrelated application shell; it is not a production entry. With Vite running, open `/tabletop-preview.html` for review. It does not alter production authentication. Production online matches still require the existing authenticated server and MongoDB transaction support.

The in-conversation AI preview is bundled from the same React game and rule engine:

```sh
node scripts/build-tabletop-preview.mjs /workspace/tabletop-five-games.html
```

It embeds the Blender pieces and a reduced HDRI and disables audio/network account code. Its back button opens the five-game picker. Full app lobbies include the online choices.

Browser URL policy prevented local visual browser review in the authoring session. Automated UI checks cover rules dialogs and the first legal move in every game; server tests cover complete matches, spoofed actions, revisions, device replacement, timeout/refund behavior and ledger idempotency. A deployed two-account TPG smoke test and actual phone visual review remain release checks.
