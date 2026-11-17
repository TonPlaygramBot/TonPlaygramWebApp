# Race-safe legacy balance reads (draft)

Account balance/info and profile get previously read an account, derived a higher
balance from its ledger and saved an absolute value without checking whether a
concurrent credit/debit had occurred. This change retains the existing upward
reconciliation rule only if both the persisted balance and complete ledger still
match the read snapshot. A failed comparison reloads current state once, without
retry, upsert, ledger normalization or stale document save.

This is a narrow race mitigation, NOT a wallet security migration. The generic
updateBalance/addTransaction APIs still trust client rewards, and transfers,
game payouts and other absolute writers need separate audits. Disabling those
APIs now would break LuckyNumber, daily shooting and stake/fee history flows.
Even after this patch, a later fresh read can reconcile upward from a ledger that
exceeds funds after a legitimate debit. Ledger authority and historical data must
be resolved before store/monetary release; this patch does not fix that semantic.

## Compatibility and failures

Existing ledgers keep upward repair behavior. Raw collection reads and CAS writes
avoid injecting Mongoose hydration defaults into legacy ledger comparisons.
Only the returned presentation document is hydrated. The write changes balance
only; legacy strings and missing transaction fields are never rewritten here.
Database write
failure returns 503 balance_temporarily_unavailable instead of claiming a repair
succeeded. Accounts deleted during repair return 404 rather than being recreated.

Tests cover snapshot races with rewards, debits, ledger-only updates, parallel
repairs, deletion, hydrated legacy defaults and route responses. These are
model/mocked tests, NOT real Mongo concurrency verification. Real Mongo testing,
legacy account reconciliation and concurrent-game verification are required
before merging or deploying. No production database is used.


## Local Mongo verification (2026-11-17)

The isolated real MongoDB integration suite now passes: 4 tests, MongoDB
7.0.14 with `--nounixsocket`. This removes the earlier local startup blocker.
Use `MONGOMS_SYSTEM_BINARY=/path/to/mongod MONGOMS_VERSION=7.0.14` to reproduce
without downloading a binary. No production database was accessed. Model-only
results above are now supplemented by these actual database tests, not replaced.
CI, broader combined release checks, legacy data/entitlement decisions and
real-device/full-build gates remain. This verification does not authorize deployment.
