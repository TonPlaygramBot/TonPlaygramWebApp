# Tirana Streets

Tirana Streets is a playable **alpha** city sandbox for portrait mobile browsers. It adds a Games card and its own lobby at `/games/tiranastreets/lobby`, with `/games/tiranastreets` as an alias. Kart Royale, Tennis Royal and the existing games are preserved.

## What is playable

- Free roam: explore central Tirana without a timer, walk or sprint, enter parked cars, drive, brake, reverse, exit and recover to the nearest street.
- AI jobs: courier deliveries, a street race against Ardi, and a fictional patrol pursuit, with traffic and animated pedestrians.
- Career: six sequential chapters, repeatable best times, server-awarded reputation and a sports car after three completed chapters. Reputation is a game progression score.
- Online: free two-to-four-player city rooms, six-character room codes, open-room discovery, ready checks, host start, reconnects and host migration. Rivals compete on individual routes; co-op crews share checkpoint progress.
- Mobile controls: camera-relative movement, a steering stick, gas/brake/sprint buttons, enter/exit action, right-side camera drag, minimap and full map. WASD/arrows, Shift, Space, E, R and Escape also work.

## Tirana geography and assets

The checked-in OpenStreetMap extract supplies real streets, building footprints, parks, water and a connected road graph. The district covers Skanderbeg Square, the Pyramid, Rinia Park, the Lana corridor, Blloku and Mother Teresa Square. Facades and landmark exteriors are artistic approximations; inferred heights and fictional jobs are identified in the in-game credits. Interiors, the entire metropolitan city and a GTA-scale production are outside this alpha.

Kenney CC0 cars and animated characters, Quaternius CC0 PBR buildings and Poly Haven CC0 asphalt are served locally. There are no runtime model-CDN or mapping API dependencies. OSM-derived geography is ODbL, not CC0. Full source links, author licenses and checksums are in `webapp/public/assets/tirana-streets/`. `webapp/scripts/build-tirana-map.py` rebuilds the map module from an OSM XML snapshot.

## Runtime structure

`webapp/src/games/tiranastreets/` separates the React lobby/HUD, input, audio, renderer, network transport, and dependency-free simulation/room reducers. Three.js loads GLB models; repeated PBR details, trees and lamps are instanced and city shells are batched by material. The renderer uses limited local shadows, distance fog and adaptive pixel density. Rendering targets 60 FPS; High Clarity caps pixel density at 2× and Battery Saver disables shadows. The on-screen FPS counter reports current rendering throughput. Device FPS and thermal behavior are not benchmarked yet.

The app transport registers through the existing TPG account/socket flow. `bot/services/tiranaStreets.js` owns room membership, input rate limits, physics, mission clocks, checkpoint order and results. Clients submit bounded controls and monotonic action sequences, never positions, winners or rewards. A 30 Hz server loop advances the 60 Hz simulation; clients request snapshots at up to 8 Hz and predict their own movement between snapshots. Stale controls brake after 450 ms. Inactive online seats release after 45 seconds; rooms expire after 30 minutes. Room codes let friends join; this game does not enter the shared paid-stake table queue. It charges no TPG.

`TiranaCareer` stores career progress in MongoDB. Awards use a revision check and completed-chapter deduplication, so retries cannot duplicate reputation. The repository's explicit development memory-store mode remains available. The standalone preview uses the same game and room reducers with authenticated HTTP requests and D1 revisions instead of Socket.IO/MongoDB; preview careers are separate from TPG account careers.

## Validation and release notes

Run:

```sh
node --test test/tiranaStreets.test.mjs test/tiranaStreetsSocket.test.mjs
npm --prefix webapp run build
```

The focused tests cover geographic connectivity, screen-relative controls, enter/exit/braking, collision, ordered deliveries, AI completion, idempotent career awards, room capacity/ready/host rules, co-op progress, suspended inputs, identity binding, concurrent room creation, GLB dependencies and two real Socket.IO clients including reconnect and cleanup.

Before a production release, validate on physical iOS/Android phones and two devices on separate networks, and check MongoDB-backed career writes in the deployment environment. Full bot startup needs its existing native canvas dependency. Simulation rooms currently live in one Node process: horizontal deployment needs sticky room routing or an explicit shared room owner. A server restart ends active app runs while saved careers survive. The standalone preview's D1 rooms persist between worker requests. Online and career mission clocks continue while an in-game menu is open; local AI runs pause.

Deploy the bot and webapp together after review. This pull request does not deploy or merge the production app.
