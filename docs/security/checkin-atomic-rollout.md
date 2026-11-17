# Signed atomic check-in slice

This draft changes only `/api/checkin/check-in`. It does not activate Snake/Pool paid settlement, certify funding, reconcile historical balances, or fix the other reward routes.

## Behavior and compatibility

- Existing `dailyCheckIn(telegramId)` request and success response `{streak,reward,balance}` remain unchanged. Current API helper already sends Telegram initData; no new request ID or client release required for clients with fresh signed Telegram data.
- Requires valid signed Telegram initData matching the body identity. Unsigned clients, Google-only clients, expired Telegram sessions, identity-header-only clients, and API-token-only calls cannot claim. This is a deliberate compatibility/security break, not universal old-client support.
- Error text tells the existing alert-based DailyCheckIn UI to reopen TonPlayGram from Telegram. A native/Google-only client cannot use this Telegram reward until opened/authenticated there. No Google entitlement expansion was invented.
- Rewards remain 100, 120, ... 680, rolling 24h cooldown, increment within 48h, reset at 48h, cap after day 30 until reset. Repeat after successful response loss returns legacy `already checked in`, not a second credit. No replay-success response added.
- A first signed request still creates an account. Banned users cannot claim. Missing legacy default fields (balance, streak or ledger), invalid/noninteger/negative balances or malformed state fail closed with wallet-review message rather than silently rewriting them.
- One atomic user-document update couples balance increment, immutable receipt, timestamp and streak. CAS rechecks identity, ban, balance, streak and timestamp. Unique Telegram index must exist before serving; run/verify normal schema index provisioning before rollout.
- New receipt is `checkin:<userObjectId>:<serverMillis>`. A collision rolls back the entire document update. Generic receipt writers elsewhere can still interfere; not a global ledger guarantee.

## Verification

`MONGOMS_SYSTEM_BINARY=/tmp/tpg-mongodb-binaries/mongod-x64-debian-7.0.14 MONGOMS_VERSION=7.0.14 node --test bot/tests/checkinAtomic.integration.test.js`

Real local Mongo replica set and real HTTP exercise success, 12 concurrent first claims, retry, forged/expired/unsigned/mismatched credentials, cooldown boundaries, reset/cap, banned/invalid balances and forced unique-index failure with no partial credit. 11/11 integration tests pass, plus 40/40 existing authentication/identity tests with `--experimental-test-module-mocks`. Concurrent unrelated balance increments survive CAS retry and a ban introduced between read and update blocks the reward. No production database or external wallet is used.

## Remaining gates

Independent review and final tests before merge. No deployment authorized by this document. Device UI session recovery has not been manually verified. The existing DailyCheckIn UI uses unscoped localStorage cooldown values and can hide the claim after account switches; not changed in this backend slice. It also displays an ad gate that is not verified by this endpoint, matching existing semantics rather than asserting ad completion.

Global wallet provenance remains unverified: generic profile balance/history setters; legacy max-ledger read repair counting pending entries; wallet/account deposit and transfer; gifts/store; ads/watch/mining/referrals/tasks/admin grants; other game stakes; operational scripts. Those can mutate or recreate balances independently. Do not use the new daily receipt alone to attest an entire wallet or turn on paid Snake/Pool.
