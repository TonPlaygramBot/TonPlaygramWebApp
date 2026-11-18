# Retire unverified wallet credits and external payouts

## Behavior
Four legacy POST routes now return HTTP403 without reading/writing users, modifying balances/transactions, sending notifications or calling TON:

| Route | Stable denial code |
| --- | --- |
| /api/wallet/deposit | verified_deposit_required |
| /api/account/deposit | verified_reward_required |
| /api/wallet/claim-external | verified_external_claim_required |
| /api/wallet/withdraw | verified_withdrawal_required |

Authentication and the wallet mobile-store gate retain their existing behavior (401 for unauthenticated requests, mobile_store_free_play when that gate blocks). Explicit denials apply even with mobile-store mode disabled and withdrawal enabled. There is deliberately no bypass flag, testnet exception, developer-account exception or fallback credit.

Existing database balances/history remain unchanged. No migration, reconciliation, deployment or production transaction is part of this patch. Database-based gameplay settlement and other off-chain routes are not migrated to blockchain or edited here.

## User-visible impact
Legacy wallet deposit/claim/withdraw clients receive an error, not a successful credit/payout. Existing client callers of account/deposit, including PoolRoyale reward handling, SnakeAndLadder win/commission credits, and MyAccount developer balance top-up, can no longer credit arbitrary reported amounts. Those rewards require an independently verified server settlement implementation before restoration; this patch does not silently compensate balances or claim these flows continue working. The public pool/snooker API wrappers also receive403 on depositAccount.

## Safe future settlement
Any future implementation must independently verify payment network, asset, amount, recipient, finality and unique transaction identity; ensure atomic ledger/idempotency guarantees; and isolate testnet credentials, accounts and balances from production. A client amount/address or database gameplay balance is not proof of settlement. This patch adds no testnet signing credentials or network calls.

## Remaining review boundaries
Authentication identity hints, other balance-changing routes, game settlement and ledger authorization require separate review. Four retired handlers are not a declaration that the entire wallet is secure. Do not turn off production mobile-store restrictions based solely on this patch. This change does not claim to recover past unauthorized credits or payouts.

## Verification
The regression bundles actual Express account/wallet routers and executes their actual route middleware/handlers with dependency fakes that throw if model/transfer/notification APIs are called. It covers all four routes, mobile-store/withdraw flag combinations, different payloads, repeated attempts, unauthenticated requests, and zero side effects. No production database, chain endpoint or credentials are used. This is handler-level integration, not full server/network E2E. Existing historical walletRoutes tests expected client-side credit success and are superseded by the fail-closed regression; they do not establish safe off-chain transfer coverage.

No safe existing substitute was established for these client-side payouts: Pool's awardTrainingTaskPayout supplies amount/taskLevel from the browser; poolOnlineTournaments explicitly does not authorize wallet prizes. Snake's onWon calculates pot/player winnings in the browser and some identity branches call addTransaction('deposit') instead. Redirecting to that alternate client-asserted path would not establish verified settlement. Those alternate ledger paths remain audit scope, not a workaround endorsed by this patch.
