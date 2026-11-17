# Snake coordinated reserve/start/settlement/refund (unwired draft)

> Follow-on update: the coordinator now seeds and replays a durable versioned
> move journal and rejects supplied outcomes. See `snake-durable-journal.md`.
> Earlier descriptions of the pre-journal adapter below are historical.

## What changed

`snakeRoundCoordinator.js` joins the preceding reservation producer with a
coherent financial lifecycle. It is not imported by routes or GameRoom and does
not activate paid games. All examples/tests use synthetic local accounts.

- `start` checks exact board/rules, all held debit receipts, per-round account
  locks and current funding snapshots (including fee recipient), then atomically
  stores the initial board/start time and lifecycle journal. The caller receives
  a committed round binding; no client-selected match/winner is trusted.
- `finish` accepts only a trusted in-process completed Snake room bound to this
  reserved round. One transaction consumes all held debits, credits exact winner
  and fee, advances every affected provenance cursor, releases only this round's
  account locks, marks escrow/lifecycle final and writes a unique receipt.
- `refundBeforeStart` uses the same settlement key and transaction boundary. It
  restores exact reserved stakes without fee, advances audits, releases locks,
  and finalizes refund lifecycle/receipt. It rejects every already-started round.
- Exact duplicate completion/refund returns the committed receipt. Start/refund
  races cannot independently commit contradictory transitions. Failures after
  tentative balance writes roll back audits, locks, journals and receipts too.
- Positive-fee offers now require a valid fee-recipient provenance snapshot before
  reserve, so missing fee audit cannot first be discovered after charging players.

The older standalone settlement adapter is retained only as an earlier unwired
foundation; do not wire both adapters. This coordinator is the proposed path
when later runtime/provenance review gates pass.

## Start-boundary write fences

Snapshot reads alone do not protect a start decision from concurrent eligibility
changes. Independent review identified this write-skew risk. Start now writes a
bounded nonmonetary `gameFinancialFence` counter on each participating/fee user,
advances the audit version without changing its balance fingerprint, and writes
a per-round lock counter. Every write has snapshot predicates and shares the
start transaction. Concurrent changes cause conflict/retry/revalidation, not a
stale start. No debit/credit occurs in these fence writes. A cancelled/failed
transaction rolls them back. Exact duplicate start performs no new fences.

The producer similarly fences the fee account/audit before reservation; it also
rejects malformed audit versions before charging players. Participant balances
and audits are already written during reservation, giving them write-conflict
protection. These fences are not a ban on future legitimate account changes;
they make the transaction's decision consistent at its commit boundary.

## Real Mongo blocker resolved, limited evidence

The earlier startup failures were reproduced with default mongod launch, then
resolved by disabling its Unix-domain socket in these isolated tests:

```
MongoMemoryReplSet.create({ replSet: { count: 1, args: ['--nounixsocket'] } })
```

The replica still uses loopback TCP and real WiredTiger transactions. No elevated
permissions, security setting change, external database or production data was
used. This is a test-process argument, not a production database change.

Reproduction (using an available official MongoDB binary):

```
MONGOMS_SYSTEM_BINARY=/path/to/mongod MONGOMS_VERSION=7.0.14 node --test \
  bot/tests/snakeReservationProducer.integration.mjs \
  bot/tests/snakeTransactionalSettlement.integration.mjs \
  bot/tests/snakeRoundCoordinator.integration.mjs
```

The earlier two tests now pass. The new coordinator suite has 13 nested cases
plus its parent (14 reported tests), all passing on initial verification:

- Reserve/start/concurrent finish followed by a new funded round.
- Duplicate pre-start refunds restore funds/audits and release locks once.
- Start versus refund race permits only one transition.
- Failure inserting the final receipt rolls back tentative credits, audit cursors,
  lock releases and lifecycle changes.
- Stale funding snapshot and another round's lock block completion.
- Post-start refund and cross-round winner are rejected.
- Maximum-length round ID works with bounded lifecycle references.
- Deterministic concurrent ban, audit revocation, ledger mutation, lock deletion
  and fee-account revocation after validation cannot commit start.

This supersedes earlier startup-blocked status for these exact test files only.
It does not establish all database race/crash cases, production readiness or any
other PR's integration status. Other suites must be rerun independently.

## Gates still open

There is still no trustworthy issuer/migration for `fundingAudits`; snapshot
hashes are not proof of legitimate historical funding. All alternate legacy
ledger writers must be secured. Stale provenance fails closed and may require
manual reconciliation rather than granting an automatic refund.

Runtime signed identity/terms UI integration, live GameRoom binding, ordered
persistent moves, secure RNG, restart recovery and post-start dispute/timeout
policy are not implemented here. `start` persists initial board, NOT a full
move journal. There is no on-chain game escrow or mainnet deployment. Pool still
needs an authoritative adjudicator. Bans/account changes during a round and
contested outcomes require an explicit policy, not silent confiscation or a
client-claimed refund.

Do not activate paid play from these test results. The implementation is a
reviewable, non-runtime draft, not a security audit.
