# Game stake consent and durable lifecycle: non-runtime draft

## Why this gate precedes any debit

At baseline `3927dd5`, `bot/server.js` accepts player identity from socket
handshake/`register` payload and stores it in `socket.data.playerId`.
`ensureRegistered` compares against that self-asserted value. This is NOT proof
that the user authorized spending their balance. Hooking a reserve debit into
that seating flow could debit a different person's account. Signed call
membership is not automatically signed financial seat consent.

The existing GameRoomManager also cannot be reused as the durable money state:
`saveRoom` omits unique round identity, initial dice-cell snapshot and ordered
journal; `loadRooms` does not synchronize all embedded game state; `getRoom`
does not restore all finished state; all-disconnected rooms can be deleted.
A financial round must survive all clients disconnecting and server restart.

## Delivered building blocks (not connected to routes)

- `gameStakeConsent.js` binds an explicit server offer (round, offer revision,
  roster, asset, exact integer stake, rules hash, absolute fee policy, deadline)
  to a SHA-256 terms digest. There are no production stake/fee defaults.
- Each acceptance freshly calls the existing signed Google/Telegram credential
  verifier. It ignores account/Telegram IDs and `socialVerified` claims in the
  input, performs a unique provider-to-canonical account lookup, checks bans,
  resolves canonical-account collisions, checks offered membership, and returns
  an expiring terms-bound receipt. It stores neither raw credentials nor tokens.
  A second identity lookup checks provider/ban consistency again, but this does
  not eliminate the need for transaction-time revalidation.
- `requireCurrentConsents` checks all persisted seats have distinct, unexpired,
  exact-term receipts. It is shape validation, NOT a credential verifier, and
  must never accept receipts supplied by clients.
- `gameLifecycle.js` defines and journals legal transitions using an optimistic
  version check and an append-only unique event key inside a Mongo transaction.
  Exact event retry returns the original state; changed content reusing the same
  event ID is rejected. Disconnect/reconnect cannot reset, erase or refund a
  funded round. Before funding, cancellation is terminal; after reservation it
  requires a confirmed refund; after start it becomes disputed, not an invented
  winner or automatic refund.

## Trust boundaries that remain

These helpers are deliberately **unwired**. No new endpoint, database collection,
index, credential persistence, balance debit, monetary migration, mainnet action,
merge or deployment is performed by importing them.

The consent builder does not persist receipts: the future server must atomically
compare the still-current offer revision and persist the receipt. It must verify
fresh account/provider mapping, bans, credential expiry, account locks and ledger
provenance AGAIN in the all-or-none reservation transaction. A signed login token
proves account access, not that someone read the fee: the frontend must display
the complete immutable terms and require explicit acceptance of that terms hash.
Origin/CSRF protections and authenticated transport are still required.

The journal adapter receives trusted internal events. Names such as
`reservation_committed` or `settlement_committed` and reference strings do not
prove that money moved. Only the private money transaction coordinator may
produce those events, validating their durable financial receipt. No socket or
HTTP body may select these events. Client-claimed event timestamps cannot be
used; the coordinator supplies server time.

The `lifecycleMatches` collection is a distinct lifecycle projection, NOT the
reserved escrow snapshot consumed by the earlier settlement planner. Their
statuses are intentionally different. Before integration, the reservation and
settlement coordinator must update escrow, lifecycle and journal atomically in
ONE shared transaction, not call independent adapters sequentially and assume
atomicity. Initial state creation, durable schema/index setup, event verification,
restart/replay reconstruction and retention are not implemented by this draft.
The journal records lifecycle transitions, not a complete deterministic game
move log. It does not fix Snake randomness or add a Pool physics adjudicator.

## Required reservation sequence

1. Server creates a new unique round and immutable explicit terms from approved
   configuration, not client-selected financial fields. Changed terms require
   renewed acceptance; cancelled/terminal rounds never reopen.
2. Each participant verifies signed credentials and explicitly accepts the
   offered hash. Persist canonical account/user ID and bounded receipt expiry
   against current offer version. Do not store raw credentials.
3. Immediately before debit, revalidate all participant eligibility, consent,
   uniqueness, identity mapping, active account locks and funds provenance under
   the transaction snapshot. Acquire database-backed per-account locks, not a
   process-local map. All participants must be held or none must be charged.
4. Persist reserve debits, held receipts, immutable escrow snapshot, lifecycle
   transition and journal in the same transaction. All updates check affected
   row counts and use canonical IDs. Unique round/seat receipts make retry safe.
5. Assign `room.settlementMatchId` only from that committed reservation and start
   the game after commit. Persist the initial board/RNG/rules and every action
   needed for restart. No fallback starts with unverified funding.
6. Reconcile abandoned historical stakes separately; never infer refunds from
   browser claims or delete funded records on disconnect. Define post-start
   disputes/timeouts before reactivation.

## Evidence and limits

`node --test bot/tests/gameConsentLifecycle.test.js`: 39 passing tests including
actual Telegram HMAC verification with synthetic credentials, forged/unsigned
identity rejection, bans/collisions, stale terms/expiry/fees, distinct receipts,
legal lifecycle, same-event replay and simulated journal rollback. Google uses
the existing official verifier in production code but live Google login was not
tested in this draft. No real user credentials were used.

The Mongo adapter tests use a transaction simulator. They do not establish
actual Mongo atomicity, races or durability. The earlier real replica-set test
still cannot start in this environment (Mongo exit 100); this is an unresolved
release blocker. No live debit or activation is safe yet. Keep the paid-entry
containment in place.
