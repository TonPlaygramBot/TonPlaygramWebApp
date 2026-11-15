# Racing Royal: Tirana social city and Pyramid gaming mall

Racing Royal's **Career** button now opens the shared Tirana city. Players can
walk, drive, chat, manage friend requests, opt into voice/video, and invite each
other to an existing game lobby. **Solo Missions** retains the existing driving
jobs, action missions, and championships. Paid race/resume URLs still take
priority over social activity URLs.

## Player flow

1. Sign in with the existing TonPlayGram account, open Racing Royal, and select
   **Career**. Each city instance supports four people; **People / Chat** has a
   shareable link for joining the same instance.
2. Open **Voice / Video** and explicitly join voice or video. Live video tiles
   stay visible while driving/walking. Mute, camera off, and end-call controls
   are available; leaving or hiding the page releases capture.
3. Use **People** to add friends, accept/decline incoming requests, or open
   existing account messages. **Invites** offers every active game from the
   Games catalogue. The recipient must accept before either player can choose
   **Meet in lobby**. Players choose their match/table and any stake there;
   these invitations do not debit balances or automatically pair a match.
4. Follow the Pyramid waypoint, park, and exit the vehicle. Within 75 metres,
   **Enter Gaming Mall** opens the interior. Choose a hall or tap its sign,
   explore the aisle, and enter that game's existing lobby.
5. The **Shops** floor has the full-store department shop plus the existing
   per-game shops, including equipment, characters, outfits, environments,
   tables, pieces, and themes. Purchases use the normal store and entitlements.

The mapped Pyramid retains its existing geometry and gains dimensional
TonPlayGram rooftop lettering. Its new interior uses React/Three.js, real game
artwork and existing kart/air-hockey GLB exhibits. The directory also works when
WebGL fails. Both the city and racing scenery include the roof sign.

Indoor navigation is a local view: other players' indoor positions are not
synchronized. The shared city connection and chat/calls remain available while
inside; the outdoor renderer is suspended to avoid drawing two scenes.

## Races and combat

The six main city circuits retain their saved IDs. Five use regenerated
connected source roads, favouring broad boulevards and avoiding overlapping
parallel carriageways; Stadium retains its verified broad-road loop with an
improved start. Widths come from the mapped roads; the shared city map is not
widened or replaced. Every starting grid uses a wide straight with approach/
runway clearance. The route version changes to invalidate incompatible old
ghosts.

| Circuit | Length | Length on roads at least 9 m wide |
| --- | ---: | ---: |
| Skanderbeg | 3.338 km | 89.65% |
| Blloku | 2.352 km | 78.07% |
| Lana | 2.483 km | 91.80% |
| Pyramid | 2.163 km | 100% |
| Stadium | 2.817 km | 89.70% |
| Grand | 2.706 km | 99.64% |

Local **Combat Race** adds an EMP pulse (button or **E**) with an 18-metre range,
22-second recharge, and 2.2-second disruption of nearby rivals' weapons/shields.
Road/height separation blocks attacks through unrelated streets. Purple charge
supplies reduce recharge by eight seconds. Score and supply feedback supplement
the existing fire, shield, repairs, ammo, rival AI, and race objectives. Combat
does not award normal career/TPG rewards.

## Operational notes

- City game invitations use the server's canonical Games catalogue and verified
  room identities, are visible only to the pair, expire after two minutes, and
  enforce recipient-only acceptance, blocking, and request limits.
- Friendship records reuse the existing authenticated social API. Room chat and
  city invitations are transient; existing friendship persistence is unchanged.
- City snapshots project only serializable presentation data and nearby actors,
  fixing circular NPC walk-plan references in the actual Socket.IO transport.
  Per-viewer budgets retain all players, at most 12 nearby NPCs and 28 vehicles,
  and the viewer's driven vehicle. Full AI paths and simulation state stay on
  the server. Four-player after-tick payload tests enforce a 40 KB ceiling.
- Voice/video reuses the current Explore WebRTC transport, room membership and
  media epochs. Configure the existing `VITE_WEBRTC_TURN_URLS` (or
  `VITE_WEBRTC_TURN_URL`), username and credential settings for networks needing
  relay service. Failed mute/camera-off acknowledgements stop local capture.
- No new payment, reward, checkout, subscription, or database migration is added.
- The mall preview is generated from the production component and scene. Its
  launch buttons show their destination locally; the full application performs
  lobby/store navigation. Preview chat, accounts, calls, and purchases are not
  simulated.

## Validation

The implementation includes route geometry/AI checks, combat simulation and
control tests, room invitation authorization/expiry tests, actual city transport
checks, and React navigation/media/mall tests. See the PR for final command
results and known baseline failures.

```sh
node --test test/racing*.test.mjs test/pyramidGamingMall.test.mjs
node --test test/tiranaSocialExplore.test.mjs test/tiranaExploreMediaGround.test.mjs
npm run test:navigation --prefix webapp -- src/games/kartroyale src/games/tirana-social src/games/tirana-mall
node test/racingSocialMall.browser.mjs --network-smoke
node test/racingSocialMall.browser.mjs
node tools/previews/build-pyramid-mall-preview.mjs
```

Browser/device verification must cover portrait touch input, a real two-device
voice/video call, entering/exiting the mall, and launching a game/shop in the
deployed app. Automated component tests do not establish those device results.
