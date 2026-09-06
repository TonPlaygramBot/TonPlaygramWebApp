# Tirana Streets

Tirana Streets is a playable **alpha** city sandbox for portrait mobile browsers. It adds a Games card and its own lobby at `/games/tiranastreets/lobby`, with `/games/tiranastreets` as an alias. Kart Royale, Tennis Royal and the existing games are preserved.

## What is playable

- Free roam: explore central Tirana without a timer, walk or sprint, enter parked cars, drive, brake, reverse, exit and recover to the nearest street.
- AI jobs: courier deliveries, races against Ardi, armed rival missions, and one-to-five-star pursuits. Explorer, Street and Veteran difficulty affect mission clocks, AI pace, incoming damage and reputation. Five stars dispatch military SUVs and soldiers.
- Career: nine sequential chapters, repeatable best times, server-awarded reputation and a sports car after three completed chapters. Reputation is a game progression score.
- Online: free two-to-four-player city rooms, six-character room codes, open-room discovery, ready checks, host start, reconnects and host migration. Rivals compete on individual routes; co-op crews share checkpoint progress.
- Living city: 28 server-simulated pedestrians/riders, 20 traffic vehicles with nearby visible drivers, and Arben’s weapon stall. Civilians flee nearby gunfire; police and military dismount, chase and fire with line-of-sight checks.
- Arsenal: 33 Ludo firearm/ordnance IDs, finite ammunition, reloading, health/armor, equipment and ammo purchases, holstering, hit effects and sound. Co-op disables friendly fire; rivals enable it. Free-roam defeat respawns the player after four seconds. Street cash and purchased loadouts last for one run; career reputation and unlocks remain durable.
- Mobile controls: camera-relative movement, a steering stick, gas/brake/sprint buttons, enter/exit action, right-side camera drag, minimap and full map. Touch FIRE, RELOAD and ARSENAL accompany the existing movement controls. WASD/arrows move, Shift sprints, E enters/exits, F fires, R reloads, Q opens the arsenal, H holsters and Escape opens the menu. Recover remains in the menu. Camera yaw controls the horizontal touch aim-assist cone; there is no vertical free-aim ballistics.

## Tirana geography and assets

The checked-in OpenStreetMap extract supplies real streets, building footprints, parks, water and a connected road graph. The district covers Skanderbeg Square, the Pyramid, Rinia Park, the Lana corridor, Blloku and Mother Teresa Square. Facades and landmark exteriors are artistic approximations; inferred heights and fictional jobs are identified in the in-game credits. Interiors, the entire metropolitan city and a GTA-scale production are outside this alpha.

The city reuses Kart Royale’s exact Quaternius PBR GLB buildings and Poly Haven asphalt. There are now 657 fitted detail placements; nearest buildings use full-detail meshes and more distant buildings use LOD meshes, backed by batched textured OSM shells. Cars near the player's garage use the attributed Car Concept model with optimized geometry and materials. Traffic and the military convoy retain lighter Kenney GLBs. The animated human is the same Soldier rig listed by Chess Battle Royal. It is free for games under Adobe Mixamo terms, **not CC0 or open-source content**. Other new assets use CC0 or CC BY 4.0.

The seven textured Ludo weapon sources are included with per-artist credits. Blocked Poly Pizza downloads and unverified Webaverse assets use documented licensed substitutes; this is **33 gameplay slots, not 33 distinct exact meshes**. Several explosive slots share a grenade model/effect. See `webapp/public/assets/tirana-streets/living/ATTRIBUTION.md` and `living-sources.json` for exact mappings, changes and checksums. Civilian/player/dealer/police roles currently share the imported human; there is no bespoke civilian wardrobe yet.

All shipped models, textures and game audio are local or synthesized; no runtime model CDN or map API is required. The OSM-derived map remains ODbL. `webapp/scripts/build-tirana-map.py` rebuilds it from the extract. The asset scripts embed/resize dependencies, convert CC0 OBJ sources, simplify static GLB geometry, repair legacy glTF buffers and inspect model rigs.

## Runtime structure

`webapp/src/games/tiranastreets/` separates the React lobby/HUD, input, audio, renderer, network transport, and dependency-free simulation/room reducers. `shared/cityLife.mjs` owns combat, inventory, NPC state transitions, pursuit and events; `shared/weapons.mjs` owns the Ludo IDs and arcade balancing. `cityVisuals.ts` and `livingVisuals.ts` handle building detail and combat visuals. Three.js loads GLB models; repeated PBR details, trees and lamps are instanced and city shells are batched by material. The renderer uses limited local shadows, distance fog and adaptive pixel density. Rendering targets 60 FPS; High Clarity caps pixel density at 2× and Battery Saver disables shadows. The on-screen FPS counter reports current rendering throughput. Device FPS and thermal behavior are not benchmarked yet.

The app transport registers through the existing TPG account/socket flow. `bot/services/tiranaStreets.js` owns room membership, input rate limits, physics, mission clocks, checkpoint order and results. Clients submit bounded controls and monotonic action sequences, never positions, hit targets, ammunition, cash, stars, winners or rewards. Purchases validate distance, wanted status, money and ammo caps. Action retries are deduplicated and the client queues actions in order. Firing rejects stale inputs and enforces reload/fire-rate timing. Actor pools retire inactive clones; NPC counts, dispatches and effect windows are capped. A 30 Hz server loop advances the 60 Hz simulation; clients request snapshots at up to 8 Hz and predict their own movement between snapshots. Stale controls brake after 450 ms. Inactive online seats release after 45 seconds; rooms expire after 30 minutes. Room codes let friends join; this game does not enter the shared paid-stake table queue. It charges no TPG.

`TiranaCareer` stores career progress in MongoDB. Awards use a revision check and completed-chapter deduplication, so retries cannot duplicate reputation. The repository's explicit development memory-store mode remains available. The standalone preview uses the same game and room reducers with authenticated HTTP requests and D1 revisions instead of Socket.IO/MongoDB; preview careers are separate from TPG account careers.

## Validation and release notes

Run:

```sh
node --test test/tiranaCityLife.test.mjs test/tiranaStreets.test.mjs test/tiranaStreetsSocket.test.mjs
npm --prefix webapp run build
```

The focused tests cover geographic connectivity, screen-relative controls, enter/exit/braking, collision, ordered deliveries, AI completion, idempotent career awards, room capacity/ready/host rules, co-op progress, suspended inputs, identity binding, concurrent room creation, GLB dependencies and two real Socket.IO clients including equipment purchase, replay rejection, peer ammunition/star/effect synchronization, reconnect and cleanup. Additional tests cover weapon catalog completeness, shot cadence, reload conservation, wall blocking, shop rules, difficulty, AI/military limits and free-roam respawn.

Before a production release, validate on physical iOS/Android phones and two devices on separate networks, and check MongoDB-backed career writes in the deployment environment. Full bot startup needs its existing native canvas dependency. Simulation rooms currently live in one Node process: horizontal deployment needs sticky room routing or an explicit shared room owner. A server restart ends active app runs while saved careers survive. The standalone preview's D1 rooms persist between worker requests. Online and career mission clocks continue while an in-game menu is open; local AI runs pause.

Deploy the bot and webapp together after review. This pull request does not deploy or merge the production app.

Living-city validation: 18 new GLBs pass the Khronos glTF validator with zero errors. Five inherited warnings remain for tangent generation/non-root skinned meshes. Three.js geometry loading and human animation playback were checked without a GPU. Physical-phone visual, FPS, thermal and cross-network play checks remain necessary. Old persisted preview rooms are upgraded in place when they next advance.
