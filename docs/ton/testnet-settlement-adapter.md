# Isolated testnet settlement domain adapter

`bot/settlement/testnetSettlement.mjs` is NOT a blockchain integration. It provides
one shared intent state machine for P2P, game payouts and purchases. No existing
route or ledger is changed. No RPC, wallet, secret, provider, signer, job or DB is
connected. The memory repository and injected test verifier are OFFLINE FIXTURES,
not evidence of testnet delivery. Run `node --test test/testnetSettlement.node.mjs`.

## Contract

- `createIntent`: immutable canonical raw addresses, integer-string base units,
  testnet only, native asset or explicit jetton master. Server-scoped idempotency
  key derives stable intent ID. Reusing key with different content fails.
- `markSubmitted`: saves originating submission/message hash; does NOT confirm.
  Conflicting submissions are rejected, never silently retried.
- `reconcile`: a trusted server verifier must prove successful finalized canonical
  recipient delivery matching network, master, payer, recipient, amount, business
  reference, intent and originating message. Wallet BOC, callback, query ID,
  excess message or account balance alone are NOT that proof. The adapter trusts
  verifier output; implementing that verifier is an outstanding security gate.
- Unknown/mismatched/error outcome remains reconciliation_required; no automatic
  refund, re-send, inventory grant or winner payment is performed.
- Repository confirmUnique must atomically reserve the unique receipt and advance
  versioned intent state. One delivery message cannot settle two intents.

## Required real integration, deliberately not mounted

Use a separate testnet service/database and network configuration from
`shared/ton/network.mjs` in the parallel infrastructure branch. Implement durable
repository with unique intent/receipt indexes and transactional CAS; no in-memory
store in a real service. Add authentication, rate limits and a server-authoritative
order/outcome resolver BEFORE createIntent: callers cannot choose arbitrary payer,
recipient, price, prize or idempotency scope. P2P debit authorization must prove
wallet control. A game result must be settled once per authoritative match+winner,
including games with different existing settlement implementations. A purchase
must reserve inventory and use server-priced order data, grant exactly once only
after confirmed receipt, and handle cancellation/reconciliation independently.

Do not reuse /wallet/deposit, /account/deposit, /claim-external or the legacy claim
signer. Do not convert game TPG balances into jettons implicitly. Specify native
vs test jetton asset, approved decimals, contract and inventory first. A native
payment and jetton transfer require different full-trace verification. Integrate
wallet approval/signing only after separate authorization. Separate domain
confirmation from exactly-once business fulfillment via transactional outbox.

Before enablement: real testnet receipt fixtures and provider integration tests,
wrong-chain/master/address/amount tests, bounce/timeout/duplicate/reorg handling,
crash recovery, durable concurrency and full end-to-end payout/purchase tests.
This branch does not make any game or store transact on TON testnet yet.

Infrastructure branch review: the adapter is present alongside the read-only lab,
but is deliberately not imported by any HTTP route. Client-supplied evidence has
no confirmation endpoint. The deployed-service boundary remains incomplete, not
bypassed with a boolean flag. Amounts must fit TON Coins (less than2^120 base units),
and verifier evidence must also match intent kind. A syntactically valid master
address is NOT verification of that asset: an approved per-chain master/code
allowlist must be implemented before accepting tokens. Offline tests do not supply
that assurance. Repository and verifier remain injectable trusted code boundaries.
## Durable local repository (follow-up)

`openSqliteTestnetRepository({filename, network:'testnet',
purpose:'isolated-testnet-settlement'})` in `sqliteTestnetRepository.mjs` implements
that repository interface on a dedicated `*.testnet.sqlite` file using Node24's
built-in SQLite. It refuses mainnet configuration, unrelated database tables,
wrong metadata version/network, memory databases and symlink database files.
WAL and FULL synchronous are checked; SQL constraints, compare-and-swap revision
updates and a unique receipt column make receipt reservation + confirmation one
atomic durable statement. Closed, busy, corrupt, permission and IO errors propagate,
never fall back to memory. The calling worker should retry reconciliation after
rereading a revision conflict, never retry payment because of a database error.

Tests use REAL temporary SQLite files and separate Node processes: restart,
abrupt SIGKILL after submit, concurrent creates, concurrent unique receipt claim,
wrong network, stale writes, duplicate receipt and invalid transition. Verifier
responses remain offline fixtures; no test here contacted TON.

Deployment limits: single host with persistent LOCAL filesystem only. SQLite
WAL is not a multi-host/network-filesystem architecture. Preserve database/WAL/SHM
together using a proper SQLite backup/checkpoint strategy; copying only the live
main DB can lose WAL data. Do not provision or reuse the production disk silently.
No deployment wiring is included. Backup/restore, volume-loss, disk-full and
power-failure tests remain pending. Crash tests cover process loss, not storage
hardware guarantees. Multi-host rollout needs a separately tested transactional
server DB adapter. Business fulfillment/outbox and signing remain separate gates.

The domain accepts `reward` and `balance_migration` in addition to P2P, game
payouts and purchases. These are INTENT CATEGORIES ONLY, not mint operations or
authorization to copy balances. Reward amounts and sources must be resolved by a
server-authoritative reward policy. Migration requires a separately approved,
immutable snapshot, conversion/decimals policy, per-account dedupe reference and
verified wallet ownership. No production snapshot/import exists in this branch.
Use synthetic test accounts only until that policy is approved. Actual spendable
jetton balances must come from verified testnet wallet state, not intent totals or
copied Mongo balances. This repository records settlement, not an on-chain balance
indexer; it cannot report a real token balance from its rows alone.
