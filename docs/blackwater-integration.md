# BLACKWATER in TonPlaygram

BLACKWATER appears in the Games catalog and opens `/games/blackwater/lobby`.
The lobby offers the original MK18/MP9 loadouts, free Recruit/Veteran solo
operations, and 2–4 player TPG quick matches or private rooms. The game route
is `/games/blackwater`. Existing games keep their routes and assets.

## Tirana layout and original assets

`games/blackwater/cityWorld.ts` assembles the existing BLACKWATER asset kit
from `world.ts`. It repeats all ten original building archetypes, retains
their facade details and dimensions, and repositions the original street
props. Weapons, hands, armored opponents, materials, procedural textures,
lighting style, rain, and extraction marker use the original assets.

`shared/layout.mjs` imports Tirana Streets' checked-in `WORLD` directly:
1,377 building locations and 8,265 road/path segments. The translation places
the initial operation in Blloku. Scale is unchanged: one unit is one meter,
east is +X, south is +Z. Roads retain source endpoints and widths. Building
centers come from the source footprints, with existing facades facing their
nearest street. BLACKWATER does not import Tirana Streets' replacement 3D
models, facade materials, cars, or textures. Buildings use BLACKWATER's
existing dimensions; they are not replicas of Tirana's real architecture.

Geographic data remains under ODbL 1.0; see
`webapp/src/games/tiranastreets/shared/DATA-LICENSE.md`. Attribution is visible
in the lobby and game. The complete editable geography stays in the original
Tirana Streets module; the mapping transformation is also editable source.

## TPG and online runtime

The lobby calls `runSimpleOnlineFlow` and `joinRoyalLobby`, using the existing
registration → seatTable → ready → gameStart lifecycle. Queues match the same
TPG stake, capacity and map. Cancellation releases a waiting seat. A matched
session is remembered for reconnection.

BLACKWATER reuses Racing Royal's transactional stake implementation with its
own `BlackwaterMatch` collection and `blackwater:` transaction IDs. There is
no client-side debit, refund, winner submission, or payout. Reservations occur
only after all seats are ready; failed loading and draws refund every stake.
Settlement retries are idempotent, and expired reservations are recovered
after a server restart. Existing Kart ledger defaults are preserved.

Online deathmatch is separate from the unchanged three-wave solo loop. The
server simulates movement, rotated collision, weapon rates, ammunition,
reloads, health, occlusion, eliminations, respawns and results at 60 Hz.
Clients send bounded input, never positions or scores. First to 5 wins; at
3 minutes a unique highest score wins, otherwise stakes are refunded.
Connection loss allows 15 seconds to reconnect. An explicit leave forfeits.
Pause/settings stop local input; they do not pause a shared match.

## Verification

Run `node scripts/verify-blackwater.mjs` after installing the root, bot and
webapp dependencies. The CPU scene tests additionally use `@napi-rs/canvas`
(available in the development runtime; install it locally to run those tests).
Run `node --test test/kartStake.test.mjs` for the reused ledger's regression
tests, and `cd webapp && npm run build` for the entire application.

Verified here: 19 BLACKWATER tests and 3 existing Kart stake tests pass;
the complete webapp production build passes. A deterministic agent completes
all 18 solo eliminations, upgrades and extraction using normal damage.
Two real Socket.IO clients exercise membership, replacement transport,
reconnection, forfeit, loading refunds and settlement retries. Transactional
repository doubles exercise rollback, duplicate payouts and competing seats.
The actual Three scene also renders through the software compatibility path.

Limits: the environment blocks the interactive browser preview URL and the
local MongoDB process cannot start due to an OS file restriction. A real
MongoDB replica-set integration run and physical iOS/Android WebGL/touch,
latency, battery and thermal checks remain necessary before production
release. No production wallets were used. Changes are delivered for review
without a production deployment.
