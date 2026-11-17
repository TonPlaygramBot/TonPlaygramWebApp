# Main-based gift integration readiness
Baseline main: ec162995c (includes official GRAM rebrand). Clean rebase preserves GRAM display changes and canonical TON API keys.
Integrates atomic signed/idempotent delivery (#26099), explicit one-click sending (#26117), Store palette and short nonblocking delivery receipt/sound. Keeps all86 current-main artwork files and renderer unchanged. No catalog price/token change.

## Integration bug fixed
Real GiftPopup supplies no accountId, only the old resolveAccount helper. Quick Buy previously stayed disabled despite component tests passing explicit accounts. The launcher now reads a signed, no-store GET /api/account/gift session. It stays disabled with visible verification/re-auth/provider error until a canonical account arrives. Storage/social-auth changes invalidate it immediately; async generations cannot restore stale sessions. POST still independently verifies signed identity and canonical sender, never trusting the GET or local account ID as authorization.

## Tests on integrated checkout
31 node tests: catalog/checkout, actual signed route rejection/ownership/session checks and86 asset coverage/budget.
35 UI/API/audio tests: includes actual GiftPopup launch, unavailable session, auth-change re-verification, one-click send, double-tap, account-switch recovery, receipt matching, no network retry, audio and image fallback.
13 isolated real MongoDB7.0.14 replica-set tests: atomicity, concurrent duplicate/replay/overspend, rollback, legacy arrays, auth, self-gift, terminal rejection and configured provider fail-closed.
Total79 passed. Command for actual DB: MONGOMS_SYSTEM_BINARY=/tmp/tpg-mongodb-binaries/mongod-x64-debian-7.0.14 node --test test/giftDelivery.integration.node.mjs. No production data/transactions used. No full mobile/browser visual certification.

## Exact remaining release blockers
1. Production DB must support replica-set transactions and majority durable writes; verify topology operationally. No standalone fallback.
2. If NFT_API_BASE_URL is configured, new purchases explicitly return503 MINT_PROVIDER_UNAVAILABLE and the launcher explains unavailable integration. Do not release this as functioning minting. Existing provider code only POSTs /mint with giftId/toAccount and has no request key/status lookup; safe external mint delivery needs provider contract plus outbox/reconciliation. With no provider, only in-app collectible delivery is supported; no fabricated NFT ID.
3. Old clients without requestId get428 without a charge. Unsigned x-tpc-account-id/x-google-id/API-token identities get401; genuine Telegram initData or Google ID token is mandatory. Coordinate frontend/backend and native client refresh/sign-in before turning it on. Existing recipients only; typo recipients no longer create accounts.
4. Telegram gift notifications are currently removed by the transaction migration; need deduplicated postcommit outbox or explicit product acceptance of this changed behavior, not silent removal.
5. GiftDelivery receipts have no TTL. Set retention/account-deletion/identity-reuse policy before release; deleting receipts invalidates replay protection.
6. SessionStorage recovery is tab-scoped. Lost/cleared/new-tab/device keys require inventory/ledger reconciliation. Other legacy balance writers and gift conversion/transfer endpoints are not made atomic by this change.
7. Device smoke tests: signed Telegram/Google sessions, narrow-screen recipient/price visibility, rapid taps, network loss/reload, no unintended repeat, audio/mute/reduced-motion/game return. Use isolated controlled test accounts only.

Not deployed. Provider configuration, production topology and old installed-client readiness were not verified by these local tests. The code must not be described as live or release-ready solely because79 tests pass.

Post-GRAM-rebase verification: all79 gift tests rerun passing plus5 GRAM display tests (84 total). No artwork or canonical currency keys changed.
