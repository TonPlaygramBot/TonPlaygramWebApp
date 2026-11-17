# Server-authoritative spin rewards (draft migration)

The two Earn wheels and the `/spin` entry point use signed Telegram/Google
identity, a persisted pending grant and a server-generated prize. The browser
cannot choose the credited amount, target account, cooldown or bonus-spin count.

## Protocol

- `POST /api/spin-rewards/status {kind}` reads the account's pending grant and timers.
- `POST /api/spin-rewards/start {kind, requestId}` reserves a stable grant. Retries
  and other devices receive the same unclaimed grant rather than another draw.
- `POST /api/spin-rewards/claim {kind, id}` verifies the server delay, then changes
  balance, ledger receipt, claimed state and bonus-spin count in one conditional
  MongoDB user-document update. Duplicate claims return the prior receipt.
- `kind` is `spin` or `roulette`. Request IDs must be UUIDs. Normal spins have a
  15-second minimum server delay. Server-earned free spins are immediately ready.
- Hourly Spin & Win and four-hour roulette cooldowns are per account. Bombs and
  free-spin outcomes also have zero-amount receipts for durable idempotency.
- BONUS_X3 totals three server-generated numeric wheel outcomes.

Claims happen before cosmetic animation so leaving during animation does not
lose a credited reward. Interrupted or failed requests can retry the same grant.
The delay measures elapsed time since a server reservation, NOT verified viewing
of Instagram. No claim of view verification or Instagram configuration is made.

## Legacy boundaries and rollout blockers

This is not global wallet security. Other games still call generic balance and
transaction APIs; those legacy writers can overwrite balances and accept client
reward data. They must be migrated before monetary rewards or store release.
No old balance is reset, no historic transaction is rewritten, and malformed
legacy ledgers fail closed with `account_requires_repair` rather than silently
repairing or deleting funds. Test reconciliation with real legacy accounts before
release, because legacy read/reconciliation paths still write absolute balances.

Older localStorage bonuses from LuckyNumber are not verifiable entitlements. They are
not imported into the server balance. The UI explicitly says only server-issued
bonus spins count. The stacked Lucky dice migration now issues new entitlements
server-side; see lucky-dice-server-migration.md for its legacy parity gates. Do not
silently convert arbitrary localStorage values.
Existing valid local-only bonuses cannot be distinguished from forged ones.

Deploy backend and frontend together after review, including User schema changes.
Old client builds must not be considered protected by this new flow. Do not merge
or deploy until Mongo integration and real-device retry/navigation tests pass.

## Testing

`node --test bot/tests/spinRewards.test.js` uses a deterministic Mongo-operator
model to exercise overlapping starts/claims, two wheels plus atomic deposits,
write failures/retries, cooldowns, bonus outcomes and ownership validation.

`node --test bot/tests/spinRewards.integration.test.js` exercises the same cases
against an isolated temporary real MongoDB. It must pass in CI before merge;
operator-model tests alone are not proof of actual database concurrency behavior.
No production database is used by these tests.
