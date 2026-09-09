# Tirana Streets / Racing Royal — repair loop, 9 September 2026

Base inspected: `ed2043ef984e9824c0ed5cedd58e184676e17ee7`.
This is a focused repair of the existing games, not another replacement city.

## Reproduce → fix → rerun

The actual Explore TypeScript controller/runtime were transpiled and executed with
injected socket/platform boundaries. Four reproduction tests failed before the
repair: pause generated a timestamp beyond future input sequences; reconnection
never registered/rejoined; offline actions were emitted for later buffering; and
leaving while the server fetched the profile did not cancel the pending join.
All four now pass. The socket transport in these tests is deterministic and in
process; this does not establish a working public deployment or WebRTC call.

A second test loop caught the new kart-job save/reload migration not retaining its
job ledger. It now preserves old cup slots, old best times and the new job ledger
under the original career key. No existing test assertion was weakened.

## Racing Royal

The entry shows **Race vs AI**, **Online multiplayer**, **Kart career**, and
**Explore together**. Existing paid table/online URLs retain precedence. The
online entry uses the original BaseKartRoyale flow unchanged. AI practice and the
career both use the original KartRenderer, kart models, track definitions,
acceleration, fixed-step simulation, collisions and AI. No second frame loop is
introduced and no race is replaced with a car/on-foot city mission.

The six new kart-only missions cover circuit completion, podium/win targets,
minimum-health clean driving, and a timed race on existing Tirana circuits.
They are sequential, replayable and grant local career credits once. Existing
championship cups, save key and first-completion cup rewards are retained.
Mission time/health targets are authored gameplay settings, not verified balance
results from physical playtesting. Kart races still use the original race length.

The local racing UI restores driver/chase selection, existing kart selection,
engine/tire/collision audio, keyboard input, drift and boost. Pointer/key ownership
is independent: releasing boost no longer cancels a held steering button. Blur,
hidden pages, pause, abort and unmount neutralize input. Results are handled once.

## Explore recovery

One connection session owns its listeners and control sequence, never the shared
application socket. Reconnect repeats registration and room join, public expired
instances may be recreated, and explicit expired invitations remain errors rather
than silently joining strangers. Offline social actions are rejected rather than
buffered. Stale asynchronous callbacks cannot revive disposed components.

Server-side pending joins can be cancelled by the matching client session, allowing
React remounts to start a replacement without leaking a room seat. Authentication,
room capacity, signaling consent, block rules and rate limits are not weakened.

The UI exposes connection stages, reconnect and 3D-view retry. Optional decorative
asset/character failures no longer gate all movement after the authoritative city
state arrives. Camera/microphone remain opt-in; reconnect does not reactivate them.
Manual pause, social panel, focus, visibility and connection readiness are composed
instead of letting panel-close or background events overwrite one another.

## Tirana Streets human rendering and city startup

The original operation world/factory is preserved byte-for-byte as
`blackwater/primitiveWorld.ts`. The `world.ts` adapter marks original enemy roots.
`BattleHumanLayer` is attached to the active makeCityWorld update/dispose paths and
uses the same SharedHumans/Chess/other-game glTF catalog as career and Explore.
Original enemy equipment, flash, AI objects and operation code are retained.
Primitive bodies remain visible until their replacement is usable, and the
compatibility renderer retains its fallback. No third-party models were added.

The loader prioritizes the already bundled Chess human, supports explicit failed
asset retry, and reserves nearby actor budget for shared players. Bikes are not
loaded unnecessarily in Battlefield/Explore. Rig animation, face orientation and
weapon grips need actual-game visual QA; the adapter is not a claim of photoreal
uniforms or verified animation retargeting.

Mapped grass/paving clipping now uses a spatial index with precomputed bounds,
retaining polygon references, ordering and overlap rules. This avoids repeatedly
scanning every polygon vertex for each park during city construction. Existing
PBR buildings, glTF details, paving, crossings, cycle lanes and geographic data are
preserved; no surveyed terrain or satellite precision is newly claimed.

## Executed validation

- **171 Node tests passed; 0 failed/skipped.** Existing 142 source-subset cases remain
  unchanged; 29 new controller/server/mission/geometry-contract cases were added.
- Actual Explore pause/connection controllers are executed by the tests with
  injected platform/socket boundaries, not merely checked for strings.
- Actual career save/load functions are executed with a storage boundary.
- Eleven changed JSX/TS/TSX modules passed TypeScript transpilation diagnostics.
  This is syntax checking, not a dependency-aware full-application typecheck.
- Local source diff whitespace check passes.

The current environment has the delivered source subsets, not the full checkout;
GitHub/npm hosts could not be resolved for installing/building the full app.
Full application build/typecheck, actual WebGL render/rig inspection, real two-client
network/media behavior and physical iOS/Android testing are **not confirmed**.
No successful remote CI, production deployment or merge is claimed. The added CI
workflow defines full typecheck/build attempts without suppressing failures.

Reproduce focused validation from the repository root (with the frontend's
TypeScript installed):

```sh
NODE_PATH=webapp/node_modules node --test \
 test/tiranaRecovery.test.mjs test/tiranaKartMissions.test.mjs \
 test/tiranaCityRepair.test.mjs test/tiranaSocialExplore.test.mjs \
 test/tiranaExploreMediaGround.test.mjs test/tiranaGrandCircuits.test.mjs \
 test/tiranaStreetCareer.test.mjs test/tiranaStreetDetail.test.mjs \
 test/tiranaRegionalDetails.test.mjs test/tiranaRegionSource.test.mjs \
 test/tiranaRegionalValidation.test.mjs
```

Review and deploy matching frontend and server together. A frontend-only deploy
cannot fix the server's pending-join lifecycle. Keep the PR draft for the remaining
build, visual, physical-device and deployed-network verification.

Technical references: Socket.IO client connection/reconnection events and offline
buffering: https://socket.io/docs/v4/client-api/ and
https://socket.io/docs/v4/client-offline-behavior/ .
