# Tirana Streets camera, radio and rendering update

Targets the solo city runtime used by Career, Free Roam and solo city operations from `TiranaStreets.jsx`. Online rooms retain their existing authoritative host.

## Player controls

- Walking starts in shoulder view. CAMERA cycles shoulder → wide → eyes.
- Driving starts in chase view. CAMERA cycles chase → wide → cockpit.
- Camera selections persist in the existing street settings. Drag up to look up, down to look down, left/right to look in the corresponding screen direction.
- Chase view allows vertical look and widens slightly with speed. The five-ray collision probe protects the near plane, retracts immediately and eases outward. Close walls switch to a masked eye view; aiming and binoculars use the existing eye camera.
- Third-person framing targets the same actor/cover intersection as the shot ray. Muzzle clearance, weapon damage, aim assist and physics remain simulation-owned.
- Unarmed third-person locomotion faces travel direction; armed backpedalling reverses the locomotion clip. Existing rigs, textures, IK and animation transitions remain in use.
- N cycles cameras. M toggles the radio; [ and ] change stations. Existing crouch/kick keys remain unchanged.

## Vehicle radio

Tap Play in a car, then use previous/next or the station selector. Radio volume is independent and multiplied by master volume. Only one native audio stream is connected at a time. Leaving a vehicle, pausing, hiding the game and disposal release the connection. Station and volume preferences persist; a new session requires a tap. Autoplay denial and network failures display retry states. Connection/stall timeouts stop after 12 seconds without an automatic retry loop.

All five URLs below returned HTTP 200, `audio/mpeg` and a bounded 1,024-byte audio sample during validation on 2026-11-13. Live availability is controlled by the broadcasters. This is a selection of established Albanian stations, not an audited audience ranking. Programmes are streamed directly; they are not downloaded into the game pack or rebroadcast by the application server.

| Station | Live HTTPS endpoint | Official page |
| --- | --- | --- |
| Top Albania Radio | `https://live.top-media.al/tar` | https://www.topalbaniaradio.com/live/tar/ |
| Club FM | `https://cp1.sednastream.com/proxy/clubfm?mp=/stream` | https://clubfm.al/radiochannel/live-clubfm/ |
| Top Gold | `https://live.topgold.al/topgold` | https://www.topalbaniaradio.com/live/topgold/ |
| My Music Radio | `https://live.top-media.al/mmr` | https://www.topalbaniaradio.com/live/mmr/ |
| Radio Shqip | `https://cp1.sednastream.com/proxy/radioshqip?mp=/stream` | https://clubfm.al/radiochannel/radio-shqip/ |

Stream discovery cross-check: https://www.freqtrail.com/stations/AL and https://www.liveradio.ie/stations/club-fm. The official Top Media live page lists its three stations; Club FM lists Club FM and Radio Shqip.

## Rendering

The city renderer's directional shadow atlas now follows the player camera, including elevated terrain, instead of remaining at the origin. Light-space texel snapping stabilizes movement. The existing atlas sizes are preserved; shadow refresh is capped at 20 Hz in Balanced and 30 Hz in High, with immediate refresh after a teleport or quality change. The existing dynamic resolution, original PBR assets, ACES and PMREM environment remain active. Tests measure bounded shadow updates, not a claimed device FPS gain.

## Validation

- Focused Tirana TypeScript check: `webapp/node_modules/.bin/tsc --noEmit -p webapp/tsconfig.tirana-gameplay.json`.
- Camera, shadow and radio lifecycle tests: `node --test test/tiranaCameraRadio.test.mjs`.
- Existing player/weapon presentation: `node --test test/tiranaPlayerExperience.test.mjs test/tiranaFullBodyPresentation.test.mjs test/tiranaHumanAnimation.test.mjs`.
- Campaign, flight, traffic, collision, controls and render budget regression suites were exercised.
- React radio, movement and HUD: `npm --prefix webapp run test:navigation -- src/games/tiranastreets/radio/RadioControls.navigation.test.jsx src/games/tiranastreets/MovementStick.navigation.test.jsx src/games/tiranastreets/TiranaHud.navigation.test.jsx`.
- Production application bundle: `cd webapp && node --max-old-space-size=3072 node_modules/vite/bin/vite.js build`.

The full repository TypeScript check has existing errors on the base commit; diagnostics were compared against the same base source and dependencies. Two Racing Royal preservation tests have stale route-count/file-hash expectations. `tiranaMobileQuality.test.cjs` also contains an older Benz cockpit socket expectation (`0.12` versus the current `-0.13`). These unrelated assertions are not relaxed by this change.

The normal `npm run build` prebuild starts the repository-wide external asset vendor (up to 10 GiB); that download was stopped, and the production Vite bundle was tested directly using the existing local assets. This does not certify the entire offline asset download pipeline.

Visual review entry: `/tirana-gameplay-review.html`. The available browser reached character selection but reported WebGL unavailable, blocking in-game visual confirmation and mobile FPS measurement. No claim of real-device visual/FPS verification is made. Review the portrait view on a WebGL-capable phone before merging, particularly camera clearance in narrow alleys and radio/control spacing at 320 px width.
