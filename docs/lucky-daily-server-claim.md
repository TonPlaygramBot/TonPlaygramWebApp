# LuckyNumber daily 100: focused server migration (draft)

Only the automatic daily 100 TPG award is migrated. POST /api/lucky-daily/claim
requires signed Telegram/Google identity, ignores all submitted fields, and uses
the server UTC date and fixed amount. Claiming simultaneously across devices or
retrying a lost response commits one balance increment and one daily receipt.
The raw collection compare-and-update includes the full original ledger, so a
concurrent ledger append causes a reread rather than losing another credit/debit.

LuckyNumber still claims automatically on mount. Client localStorage is no
longer eligibility evidence; failures must remain visible with a retry control.
A confirmed response updates the displayed wallet balance. Existing lucky +100
ledger entries dated today are conservatively treated as already claimed to
avoid paying the legacy daily bonus again. Records missing a date/receipt cannot
prove an old credit; audit migration history before enabling this in production.
No historical balances or ledger entries are reset, normalized or rewritten.

## Remaining unsafe flows and release gates

This does NOT secure LuckyNumber dice payouts, random suits/card prizes, four-hour
local cooldown, free-spin or BONUS_X3 localStorage entitlements. Those need a full
server-owned game migration. Generic profile/updateBalance/addTransaction still
allow client rewards. Concurrent old clients that separately set balance then
append receipts cannot be made safe by this isolated endpoint. Coordinate rollout
and retire/migrate old writers before monetary or store release.

#26088 migrates spin/roulette using separate server-owned grants. This daily
endpoint writes only the wallet and ledger, never its spin state. Atomic increments
can coexist, but real Mongo combined-game tests are required. It does not import
LuckyNumber local free-spin bonuses into #26088; that entitlement migration remains
outstanding. #26091 protects stale read repair races but not the legacy upward
ledger reconciliation semantics or generic client writes.

Tests exercise daily UTC boundaries, duplicate/parallel claims, write failures,
legacy evidence and concurrent ledger changes. Model tests are not real Mongo
verification. The temporary Mongo integration suite must pass in compatible CI;
the previously blocked startup works with `--nounixsocket`. Run combined-PR, real-device and frontend
retry tests, review legacy data, and verify production rollout before merging or
deploying. Draft only, no production data changes.


## Local Mongo verification (2026-11-17)

The isolated real MongoDB integration suite now passes: 3 tests, MongoDB
7.0.14 with `--nounixsocket`. This removes the earlier local startup blocker.
Use `MONGOMS_SYSTEM_BINARY=/path/to/mongod MONGOMS_VERSION=7.0.14` to reproduce
without downloading a binary. No production database was accessed. Model-only
results above are now supplemented by these actual database tests, not replaced.
CI, broader combined release checks, legacy data/entitlement decisions and
real-device/full-build gates remain. This verification does not authorize deployment.
