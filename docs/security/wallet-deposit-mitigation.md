# Wallet deposit verification gate

`POST /api/wallet/deposit` no longer accepts a client amount as evidence of a
TON transfer. It returns HTTP 503 with `deposit_verification_unavailable` and
performs no account lookup, upsert, balance change, ledger write or notification.
Authentication and mobile-store restrictions remain in place. The companion
`GET /api/wallet/deposit-address` returns the same error rather than encouraging
users to transfer funds into a flow which cannot credit them safely. No environment
variable can reopen either endpoint.

This is an intentional temporary outage, not a verified-deposit implementation.
Do not send funds. Previously displayed addresses and already-sent transfers
require operator reconciliation against independently verified chain records;
this change neither refunds nor modifies historical balances. Review historical
credits separately. No live transfer or exploit is needed to validate this fix.

Before reopening: pin TON network and jetton master, derive recipient jetton
wallet, verify successful finalized inbound transfer and amount on the server,
associate it with the authenticated beneficiary, and atomically enforce unique
chain-event consumption with the ledger credit. Cover duplicate, wrong-network,
wrong-master, wrong-recipient, bounced and non-finalized transfers in tests.

Containment also closes `POST /api/account/deposit` (unverified client-awarded
rewards), `POST /api/wallet/withdraw` and `POST /api/wallet/claim-external`
(untrusted historical balances and insufficient ownership guarantees). These
return stable 503 errors, even with `WITHDRAW_ENABLED=true`. Existing handler
bodies remain behind a terminal gate; no balance data is deleted or migrated.

Affected functionality: SnakeAndLadder winnings/developer shares, PoolRoyale
legacy payouts, MyAccount developer top-up (9 account-deposit call sites), and
external TON cashouts are temporarily unavailable. Games may show payout errors
or lack credits until authoritative settlement replaces client awards; do not
advertise paid play as operational. Wallet deposit helpers currently have no
frontend callers. Operators must communicate the pause before deployment.

Other account/game credit and internal transfer routes remain outside this
patch. This is NOT certification of overall balance integrity or mainnet
readiness. Reopening withdrawal requires verified ownership and a separate
audit of existing credit provenance as well as the deposit requirements above.

Regression command:

```
node --experimental-test-module-mocks --test bot/tests/walletDepositSecurity.test.js
```

Tests exercise the actual Express route registration and handlers with account,
notification and chain dependencies replaced by throwing test doubles. They do
not claim real MongoDB or blockchain integration coverage. The legacy
`test/walletRoutes.test.js` seeds balances via the now-disabled public deposit
endpoint and is no longer a valid fixture for withdrawal/send integration tests;
it also signs Telegram requests without `auth_date`. Before running that legacy
suite, migrate its setup to isolated database fixtures, not a deposit bypass.
