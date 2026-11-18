# Durable preparation status

Owner stopped testnet and reported old TPC compromised. Never use old master,
admin/store wallet or LP addresses. No new official TPG master or safe custody has
been verified. No endpoint, signer, credential or production connection added.

isolatedMongoOrders.mjs implements a separate Mongo transaction repository:
- isolated database name/purpose gate and replica-set prerequisite;
- immutable server-owned order fingerprint and buyer+idempotency unique index;
- order and BLOCKED outbox inserted in one majority/snapshot transaction;
- unique network+receipt observations, atomically assigned to a single order;
- observations never become trusted payments, even with delivered/finalized flags;
- claimForDelivery always throws, no scheduling/signing/broadcast path.

Policy IDs are references only, NOT validated policy or approval. This code
cannot accept real funds or fulfill sales. Existing game ledger is untouched.
Unknown/unrelated database scope is rejected. Administrator access must not be
used as evidence of buyer identity. Future service authorization, real verifier,
locked inventory, validated policy registry, audited signer and reconciliation
must be implemented separately. Current blocked outbox is preparation, not an
operational dispatcher, and does not claim exactly-once blockchain execution.

Verification: four offline model tests and two database preflight guard tests
pass. Real MongoDB 7.0.14 replica-set integration test was attempted using the
existing mongodb-memory-server package and official binary. Runtime stops at
startup with `open: Operation not permitted`, including permitted escalation.
Consequently transaction rollback, multi-process races, disk durability and
restart semantics are NOT verified in this environment. The integration test is
retained and intentionally fails rather than silently skipping when unavailable.
Do not label this production-ready or merge it for payment activation.

Commands:
  node --test test/presaleOfflineOrder.node.mjs test/presaleMongoGuards.node.mjs
  MONGOMS_DOWNLOAD_DIR=/tmp/tpg-mongo-binaries node --test test/presaleMongoOrders.node.mjs

The dependency is already present via bot's mongoose/mongodb-memory-server;
no production packages or startup scripts changed. No testnet changes are used.
