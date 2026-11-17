# Snake durable server-dice journal and recovery (unwired draft)

## Authority and accepted rules

The accepted offer now binds `rulesVersion` and exact `turnOrder`, in addition
to the board/rules hash, round, stake, fee and roster. The supported version is
`snake-server-single-die-v1`. The reservation stores these accepted values;
start rejects a changed order or unsupported version. Old draft offers/receipts
without these fields require a new explicit offer/acceptance, not an implicit
migration. Pool is not implemented by this path.

`rules/snakeV1.js` is a separate append-only replay implementation. It does not
import the mutable live SnakeGame or shared live rule code. The versioned board hash and result validator also use the frozen v1 final tile; offer creation must use `snakeJournalRulesHash(version, board)`, not the old live helper. Add a new version
and renewed offer acceptance for future semantic changes; do not edit v1 in
place. A golden 300-case fixture checks captures, snakes/ladders, entry,
overshoots, bonus squares and turn behavior against the current legitimate
single-die server behavior. Unknown replay versions fail closed.

The journal preserves the server's single-die rule and one-second per-player
roll cooldown. It does not claim that every local/offline multi-die variant is
supported. Those require separately versioned, accepted and tested rules.

## Durable start and actions

Start creates the initial board/order, game snapshot and genesis record in the
same transaction as the committed financial/lifecycle start. No process-local
room is the authority for money.

`snakeMoveJournal.roll` accepts round ID, request ID, expected state version and
signed login credentials. It rejects supplied dice, winners, actor IDs and game
state. Credentials are freshly verified; the canonical signed user must occupy
a reserved seat. The default die is server `crypto.randomInt(1, 7)`. Test suites
inject deterministic dice privately; there is no client-controlled dice field.
A sampled die is retained across transaction retries, and only committed moves
are returned. Raw credentials are never persisted.

Each move verifies prior history, applies the frozen rules, and atomically
stores the new snapshot and a hash-linked event. Unique request keys and state
version CAS prevent duplicate or competing requests from consuming a turn
more than once. User and lifecycle write fences prevent a concurrent ban or
dispute from slipping past read-only snapshot validation. A failed journal write
rolls back the snapshot and fences too. Production migration must create the
`gameMoves` unique compound index `{matchId:1, sequence:1}` as tested; index
creation is not performed at import time.

## Recovery and financial result

`recover` reads a consistent Mongo snapshot and rebuilds state from genesis
through ordered moves. Missing, reordered, mutated or snapshot-inconsistent
records fail closed; mutable snapshot contents are not accepted as fallback.
A new service instance can recover an unfinished round and continue it.

The coherent coordinator now accepts `finish(matchId)` only. A caller-provided
GameRoom or winner is rejected. It replays the durable journal inside the
financial transaction and derives the winner from the reconstructed frozen
engine before updating credits, provenance, locks, lifecycle and receipt.
Earlier standalone settlement helpers remain unwired historical foundations,
not alternate runtime payment endpoints.

## Security and operational limits

Hash chaining detects accidental/partial record corruption. It is **not
cryptographic authenticity against a database writer who can rewrite records
and recompute the whole chain**. Server/database credentials, append-only
permissions, independent integrity anchoring and operational controls still
need review. CSPRNG generation is not publicly verifiable fairness, commit/reveal
or a blockchain randomness proof. No such claim is made.

Recovery reconstructs state; it does not automatically restore sockets, broadcast
animations, resume timers, skip a disconnected player's turn or settle a result.
A reviewed runtime orchestrator must perform those steps after commit and obey
explicit timeout/dispute policy. No frontend/Socket.IO wiring is included.

History is currently bounded to 10,000 moves and replayed before each append.
At the bound, commands fail closed; no refund/winner is invented. Capacity,
indexes, retention, lifecycle monitoring and a recovery/dispute path need real
load testing before release. Full crash injection, failover, multi-process
orchestration, real Google-login testing and physical-device flows remain open.

Funds provenance issuance/migration and closure of legacy balance writers are
still unresolved launch gates. No real account/payment data was used, no paid
play was activated, and no TON contract was deployed.

## Verification

The frozen-rule suite passes 19 tests, including 300 golden outcomes, exact
replay, corruption/sequence/snapshot rejection, unsupported versions and cooldown.
The current real-Mongo coordinator suite passes 25 reported tests (including its
parent). It includes durable reserve/start/finish, duplicate/competing moves,
new-instance restart recovery, journal-write rollback, tamper-blocked payout,
missing-history rejection, concurrent ban/dispute fences, and actual synthetic
Telegram HMAC verification rejecting forged, expired, nonmember and unsigned
callers. The accepted turn order cannot be changed after reserve.

Mongo tests use ephemeral loopback replica sets with `--nounixsocket`. They are
not production database tests or a security audit. Remaining release gates above
still apply even when these focused tests pass.
