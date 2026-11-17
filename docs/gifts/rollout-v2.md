# Safe versioned gift rollout and notification outbox

## Mixed-client/server compatibility
A client-supplied UUID alone is not enough: an old server ignores it. The new client now exclusively POSTs /api/account/gift/v2. An old server has no such route, so it cannot debit via a fallback. There is no fallback to /gift, automatic HTTP retry or server-generated intent key.

New server:
- Signed GET /gift/v2 returns giftProtocol:2, canonical account and explicit purchasing availability.
- Signed POST /gift/v2 performs the atomic idempotent transaction.
- Legacy POST /gift returns428 GIFT_CLIENT_UPDATE_REQUIRED, with a readable update/sign-in instruction. It performs no money write.
- Unknown/unsigned identity cannot transact on v2. Existing installed clients require update/re-auth; a legacy client cannot transparently become safe because it lacks a stable purchase intent.

Rollout order (not executed): establish provider/replica/retention readiness; deploy backend v2+legacy rejection consistently and drain all old instances; verify signed read-only capability; deploy frontend/native v2; controlled test-account smoke; then announce availability. A mixed fleet does not let the new client hit legacy writes, but old clients hitting old instances remain the pre-existing risk until draining is complete. Do not claim compatibility while old unsafe instances remain.

NFT_API_BASE_URL remains untouched. If configured, purchases fail closed until a real idempotent provider/reconciliation implementation exists. We must not bypass minting, fabricate NFT IDs, unset provider config or restore unsafe old writes just to make buttons work. Production provider status is unknown, therefore no deploy clearance.

## Notifications
Successful transactions create one pending notification inside the unique GiftDelivery receipt, only for recipients with Telegram IDs. Terminal rejected requests enqueue nothing. A15-second server worker claims pending notices atomically across processes and sends one plain text notice (not the old photo+text pair). It uses current bot transport only after commit.

This is an idempotent enqueue and at-most-once transport attempt, NOT guaranteed exactly-once Telegram delivery. Telegram exposes no send idempotency key. Claims are never automatically expired/reclaimed: a timeout/crash after sending might otherwise duplicate the notification. Sent notices store message ID/time; errors become uncertain; process crashes may leave attempting. Operators must inspect/reconcile held notices without blindly replaying them. A notice may be missing after a crash, but the gift/receipt/debit remain atomic and replayable. Notification monitoring/reconciliation UI remains follow-up.

All tests use mocked Telegram transport. No actual messages, production writes, provider calls or deployments occurred. Additional real Mongo tests cover concurrent outbox workers, receipt replay, ambiguous transport failure and permanently claimed jobs.

Claims and status acknowledgements explicitly require majority write concern before any transport attempt. Production must provide majority-journal durability on its replica set; a weaker deployment default is not relied on. Failed/ambiguous claim acknowledgement aborts without sending. Per-process busy guard prevents slow drains accumulating every15seconds; multiple processes still coordinate through atomic durable claims.

Verification after rollout/outbox changes:34 node tests (including2 majority-claim regressions),42 UI/API/audio/GRAM tests,16 real Mongo replica tests:92 passing. Production provider/topology/device/retention gates remain unresolved.
