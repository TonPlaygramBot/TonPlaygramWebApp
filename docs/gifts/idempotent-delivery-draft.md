# Gift delivery safety follow-up: DRAFT, not production ready

Stacked on the premium gift experience draft. No IDs/prices changed. No production database, account, mint, notification, balance or deployment was used in development.

## Proposed contract
- New clients generate a secure UUIDv4 and persist the sender-scoped intent in sessionStorage before sending. Explicit retries reuse exactly that intent; no automatic network retry. Different unresolved intents cannot silently replace it.
- `POST /api/account/gift` requires `requestId`. Legacy clients without it receive 428 without a charge. Coordinated client/server rollout and old-client update UX are mandatory.
- A MongoDB replica-set transaction atomically writes debit, recipient inventory/ledger and a durable GiftDelivery receipt. Unique document ID is sender+request UUID. No TTL or receipt deletion is safe without a migration/replay plan.
- Replays return the original receipt, not current balance; do not use it as a live balance feed. Changing recipient/gift under the same key is rejected. Self-gifts update one account once.
- Existing recipients only; no account creation from a typo. Missing recipients and insufficient funds receive immutable rejected receipts; a later retry cannot change those to a charge. Other errors retain the recovery intent.
- Signed Telegram initData or verified Google ID token is required before replay as well as first delivery. Unsigned compatibility account/Google headers and legacy bearer API tokens do not authorize purchases. Route authorization binds sender to the canonical signed-in database user ID. Transaction errors remain ambiguous until safe same-key replay. Standalone MongoDB is unsupported and must fail closed, never fall back to split saves.
- Missing legacy arrays are initialized by atomic pushes. Corrupt/null arrays fail closed for explicit repair, not overwritten.

## Deliberate compatibility changes / release blockers
1. **Configured external NFT minting is disabled for new purchases in this patch.** The existing external mint API provides no documented idempotency/status contract. It cannot safely run inside a retryable MongoDB transaction or before commit. Implement a reviewed provider-idempotent outbox/reconciliation integration before enabling it. Already committed receipts remain readable.
2. With no external provider, gifts are in-app collectibles. This patch creates no fabricated NFT token ID and makes no on-chain ownership claim. Conversion/burn flows need separate compatibility testing for entries without `nftTokenId`.
3. Telegram gift notifications are not sent by this endpoint in this draft. A durable deduplicated notification outbox is follow-up work. Do not reintroduce external side effects inside the transaction or receipt replay.
4. SessionStorage survives reloads but not cleared storage/new tabs/devices. Losing an unresolved key requires inventory/ledger reconciliation before initiating another purchase. Cross-tab/server unresolved-intent discovery is not implemented.
5. The new transaction covers gift sending only. Other legacy balance writers elsewhere still need integrity review.
6. Durable receipt retention and privacy/account-deletion handling need an explicit policy: deleting an account must not silently remove replay protection for a reused identity.
7. No release until deployment DB replica-set support, receipt durability/backup, old-client behavior and iOS/Android recovery UX have been verified.

## Verification
- Disposable MongoDB replica-set integration suite covers duplicate concurrency, distinct-send overspend, rollback after recipient/receipt write failures, self-gifts, key mismatch, authorization, durable rejection, legacy arrays and provider fail-closed behavior.
- **Local integration run: all 13 tests passed on an actual disposable MongoDB 7.0.14 replica set.** Initial startup was blocked by Unix socket restrictions; starting the fixture with `--nounixsocket` resolved this without changing database transaction behavior. Verification command: `MONGOMS_SYSTEM_BINARY=/tmp/tpg-mongodb-binaries/mongod-x64-debian-7.0.14 node --test test/giftDelivery.integration.node.mjs`. The fixture uses only its generated URI and never reads a configured production DB URL. Dedicated GitHub CI also runs this fixture without production secrets. This does not verify production deployment topology or on-device behavior.
- Frontend checkout/UI/API tests use mocked requests only. A passing UI test does not prove database atomicity.

## Remaining premium artwork
Four of 86 original raster illustrations exist. Preserve every catalog ID and price. Next batches: original 14 gift IDs first, then collection batches (Royal/Cosmos/Arcade, companions, botanical/sweets, treasury/mythic). Each needs distinct motif, consistent cyan/titanium/violet TPG visual direction, 640px WebP under 80KB, fallback and actual image inspection. Do not mark the 82 remaining raster replacements complete merely because SVG fallbacks are styled.
