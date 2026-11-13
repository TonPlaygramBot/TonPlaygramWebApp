# Jet Ski Royal

The Games catalog links to `/games/jetskiroyal/lobby`. The game is also available at `/games/jetskiroyal`. This release adds three fictional courses inspired by the Albanian coast, six-rider AI races, a solo time trial with device-local records, and free online rooms. Pulse R, Surge GT and Aero SX are three handling tunes of the same licensed hull, explicitly described that way in the lobby.

## Mobile play

Use two fingers: left/right buttons steer in the visible screen direction; hold throttle, brake before corners, and hold boost when charged. Pass the gates in order for three laps. Green rings refill boost, ramps launch the craft, and recovery returns behind the last accepted gate with a five-second penalty. Chase and rider-eye cameras, adaptive resolution, three explicit quality presets, daylight/sunset and sound controls are available. A backgrounded solo race pauses; online races continue on the server with stale input braking.

## Systems

- `simulation.mjs` is shared by the browser and server: fixed 60 Hz steps, thrust/drag/inertia, speed-dependent steering, wave heave/pitch/roll, ballistic ramp jumps, craft contact, boundaries, ordered checkpoints and AI lookahead. It is an arcade racing simulation, not a fluid solver.
- `renderer.ts` uses Three.js, original GLTF materials, local Draco/KTX2/Meshopt decoders, ACES tone mapping, PMREM lighting, reflective animated water, scanned rock scenery, shadows, instanced buoys/wakes and pooled spray. Resolution is capped for phones and reduced automatically under sustained slow frames.
- `rider.ts` clones the existing licensed Quaternius athlete skeleton and solves hands/feet onto the moving hull. Handlebars turn; the rider leans, braces on jumps and turns their head. The included athlete is stylized, not a photorealistic scanned human.
- `audio.ts` synthesizes RPM-linked motor harmonics, water noise, countdown, gate, splash and finish effects after a user gesture. It does not claim recorded real-engine audio.
- `bot/services/jetskiRoyal.js` attaches to the existing authenticated Socket.IO server. Clients send controls only; the server owns positions, checkpoints, results and collision simulation. It sends 20 Hz snapshots; clients send up to 30 Hz inputs. No wallet, stakes, payouts, database schema or new infrastructure are involved.
- Online rooms need at least two ready humans; AI fills the remaining six-place grid. Quick match, private codes, host permissions, reconnect tokens, host migration, rematches, input throttling and room expiry are included. Rooms are in memory and do not survive a server restart. Multiple server instances need sticky sessions or a shared authoritative race service before horizontal scaling.
- The asset pack is loaded on demand through the existing PWA game pack infrastructure. Asset origins/licenses are in `webapp/public/assets/jetski-royal/CREDITS.md`. The catalog cover is a Blender render of the licensed craft, not an in-engine screenshot.

## Validation

From the repository root:

```sh
node --test test/jetskiRoyal.test.mjs test/jetskiRoyalNetwork.test.mjs
```

From `webapp`:

```sh
npx tsc -p tsconfig.jetski.json
npx vitest run src/games/jetski/Game.navigation.test.jsx src/games/jetski/rider.navigation.test.jsx --config vitest.navigation.config.mjs
```

Tests run every AI course to completion, gate order/teleport rejection, visible steering direction, boost/ramp/recovery behavior, deterministic replay, actual two-client Socket.IO races, forged control payloads, host permissions, reconnect, stale-input braking, rematch, UI race flow, blur release and the bundled rider's hand/foot placement under hull rotation and jumps.

Vite compiled the full application successfully during development. The subsequent existing game-pack packaging step was blocked because this checkout lacks `webapp/public/assets/external/manifest.json`; that is not a successful end-to-end production build. The isolated preview build is separate from that packaging step. The cloud browser could render the portrait lobby but could not create a WebGL context, so actual GPU rendering, sound playback and device FPS still require phone testing. Do not treat the model-pose and simulation tests as visual performance certification.

## Preview and deployment

`webapp/jetski-royal-review.html` runs the same game without application authentication or online services. It supports AI and time trial; its Online tab explains that online play becomes available in TonPlayGram when both the frontend and bot changes are deployed. `webapp/jetski-mobile-review.html` embeds that page at 390 × 844 for layout review.

Deploy the frontend and the bot from the same commit for online play. The bot entry point installs the service automatically. Existing app Socket.IO authentication/CORS remain in force. No new secret or environment variable is required. The game is presented as Beta until device graphics/performance and deployed multiplayer have been verified.
