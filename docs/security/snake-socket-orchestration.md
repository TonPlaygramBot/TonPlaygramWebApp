# Snake socket orchestration adapter: isolated, not activated

`snakeSocketRuntime.js` is not imported/attached by the application server. It
provides an explicit composition interface around the reviewed ledger/journal
services, with no legacy authentication, seating, money-route or result fallback.
There is no frontend migration or production configuration in this draft.

## Hard readiness boundary

Readiness defaults to closed. Bare booleans/environment toggles are rejected.
A private server resolver must return asset-scoped verified ledger generation,
cutover ID, writer-policy hash and bounded expiry. These fields are **not proof
by themselves**. The resolver must independently validate cutover/baseline
artifacts and writer closure; this draft supplies neither issuer nor resolver.
Do not fabricate a record to turn the feature on.

The wallet inventory found that legacy pending transactions can already increase
spendable balance through max-ledger repair; duplicate reward/accounting paths
also exist. Matching historical balance/ledger or trusting transaction types and
statuses cannot establish provenance. A verified baseline cannot be generated
from those values alone. Every funding audit and current cutover policy still
needs independent evidence. The socket gate is additional containment, not a
replacement for transaction-time provenance/eligibility checks.

## Namespaced protocol

Only these client events are registered when a trusted server explicitly calls
`attach(socket)`:

- `snake:v1:offer`: signed participant reads redacted immutable offer/hash.
- `snake:v1:accept`: exact terms hash is freshly authenticated and persisted.
  It does not itself reserve money or start a game.
- `snake:v1:sync`: signed reserved participant reads committed state/receipt and
  subscribes to this adapter's private delivery registry.
- `snake:v1:roll`: signed actor submits request ID and expected version only.
  Dice, winner, balances and caller-selected identity fields are rejected.
- `snake:v1:logout`: removes subscriptions. Disconnect also revokes them.

Every command freshly verifies signed credentials and canonical account binding.
Busy sockets reject overlapping commands rather than permitting account-switch
races. An authentication change clears older subscriptions. The composition root
must additionally call `revoke(socketId)` on global login/account-switch/logout
and revocation events from the rest of the app. Logout cannot reverse a command
that already committed; clients recover by authenticated sync.

Clients receive seat numbers, game state and verified game receipts, never raw
canonical account IDs, full user documents, ledger rows, audit records or login
credentials. This is a protocol adapter, not the finished terms/participant
profile display UI. That UI must show meaningful players, turn position, stakes,
fees and policy before requesting acceptance. Offer payloads include the hash-checked board and total-round fee/policy ID, but not a completed explanation/profile UI; an opaque hash alone is not sufficient informed consent.

## Commit ordering and delivery

State broadcasts occur only after `moves.roll` resolves its database commit.
A failed move produces no new state broadcast. The adapter does NOT broadcast to
Socket.IO room names, including socket-ID rooms: legacy endpoints permit arbitrary
room joins. It sends directly only to its own signed membership registry and
rechecks account binding, ban, expiry and match membership at delivery time.

A committed move remains a successful committed move if notification recovery
fails. The acknowledgement identifies the committed sequence; sync can restore
state. A committed winning move whose payout fails is reported as **pending**,
not paid. Only a matching terminal escrow/receipt and durable-result binding can
be shown as settled. Refund receipts are readable even when no game started.

## Private worker methods, not client events

`reserveAndStart(matchId)` invokes the all-or-none producer and then the durable
start coordinator. If start fails, it tries the exact pre-start refund path.
That path checks database state and cannot refund an already-started game even
if the start commit's acknowledgement was lost. A retry recognizes the durable
started/terminal state rather than debiting twice or restarting the board.
Notification failures do not change a confirmed start into a failed start.

`retryFinishedSettlement(matchId)` replays a finished round and retries its
idempotent settlement. A pending finished journal is durable, but this draft
does not install a worker/scheduler/outbox scan. Before release, an operational
worker must discover pending finished rounds, retry safely, alert on blockers,
and stop on terminal receipts. Do not promise automatic retry until installed.

## Verification

Actual local Socket.IO + ephemeral Mongo replica set + synthetic real Telegram
HMAC credentials: 11 reported tests (10 nested cases plus parent) pass:

- Closed and bare-boolean gates cause no consent/debit; forged auth returns error.
- Signed offer/accept/start/roll, postcommit redacted state and duplicate requests.
- Arbitrary legacy match/socket-room joins receive no private game broadcasts.
- Wrong-turn/banned actions emit no new state; logout/account switch unsubscribes.
- Winning move stays committed/pending through settlement failure; private retry
  settles once and signed sync recovers the confirmed receipt.
- Notification read failure does not report a committed roll as failed.
- Pre-start worker failure refunds exact stakes and exposes verified refund state.
- Lost start acknowledgement cannot refund a started round or debit it twice.
- Deterministic ban/provider-relink mutations between identity lookups cannot
  receive an offer or private state using a stale identity.

Tests use synthetic accounts and independently seeded synthetic audit fixtures,
not an issuer for real legacy balances. No production data, deployment, paid
activation or real payment occurred. Google/device/browser UI, distributed socket
workers, cross-process delivery/revocation, cutover generation coordination,
rate/load limits, full crash/restart orchestration and post-start dispute policy
remain release gates. Pool remains outside this adapter.

The combined financial/socket replica suite passes 38 reported tests when run
sequentially. An earlier parallel batch exhausted the small `/tmp` tmpfs and
failed before some assertions; that is not counted as a pass. Test fixtures now
drop their synthetic databases after use. On constrained machines, use a roomy
private test `TMPDIR` and `node --test --test-concurrency=1`; no production database
or user files are involved in this cleanup.
