# Isolated TON testnet infrastructure

Branch: `codex/tpg-testnet-infrastructure`. This is a **read-only testnet lab**, not
a live presale or a migration of all game settlement to blockchain. Existing
production entrypoints, balances, wallet routes and game code remain unchanged.

## Added runnable components

- Shared explicit network registry (testnet-3 and mainnet-239), exact nanotons
  formatting and chain-namespaced TON Connect storage. No implicit network fallback.
- Separate `bot/testnet-server.mjs`, bound to localhost4318. It imports no bot,
  database, claim, deposit or legacy server module. Only `/api/testnet/status` and
  `/api/testnet/balance` GET routes exist. Public read calls use a fixed testnet
  toncenter endpoint with timeout, redirect rejection and request throttling.
- Separate `webapp/ton-testnet.html` and Vite configuration, outside the normal
  production build. Explicit testnet label, isolated TON Connect session, network
  mismatch rejection, fresh account-change cancellation and exact native balance
  reads. No cached mainnet account is reused. Missing testnet manifest disables
  connection. Purchase is always disabled; no signing/broadcast function exists.

```sh
# Install the repository dependencies through its normal approved workflow first.
# Terminal1
cd bot
npm run testnet:read-only
# Terminal2
cd webapp
npm run dev:ton-testnet
# Visit http://127.0.0.1:4317/ton-testnet.html
```

Connecting a real testnet wallet additionally requires a separate public HTTPS
`ton-testnet-manifest.json` representing the actual testnet lab origin and assets.
Set `VITE_TON_TESTNET_MANIFEST_URL` to that verified manifest when running/building
the separate UI. No placeholder domain is published or silently reused. The user
controls their own wallet; this lab never requests a seed or key. The SDK's network
selection is only a hint; the page independently rejects any account not on-3.

For a hosted preview, configure a reverse proxy for the standalone read-only API
and serve the separate build under its own origin. Do not mount legacy wallet
routes there. No hosting/publication or infrastructure changes were performed here.

## Inspection inventory and migration boundaries

| Existing area | Finding / treatment |
| --- | --- |
| App.jsx / SocialApp.tsx | Main TON Connect integrations exist. Their providers and manifests are not changed. |
| TonConnectSync.jsx | Generic walletAddress storage has no chain namespace. Testnet lab uses its own SDK storage prefix instead. |
| useTokenBalances.js | Database game TPG and external wallet balances coexist; external reads include mainnet tonapi and a hardcoded jetton address. Not reused as testnet truth. |
| useWalletUsdValue.js | Mainnet USD conversion; intentionally absent from valueless testnet balance display. |
| bot/routes/wallet.js ton-balance/usdt-balance | Mainnet endpoints and Number conversions; not mounted in the new service. No implicit USDT or TPG master is trusted on testnet. |
| wallet.js deposit | Credits client amount directly to User.balance and labels delivered without chain proof inside handler. Must not be used for presale. No exploit or live mutation performed. |
| wallet.js claim/claim-external | Legacy spending surfaces; claim-external lacks the same WITHDRAW_ENABLED guard. Both excluded entirely from lab, not claimed secure. |
| bot/utils/tonClaim.js | Mainnet-default RPC and mnemonic-based sender; sendTransfer completion is not buyer token delivery proof. Not imported, invoked or changed. |
| scripts/deploy_tpc_jetton.js | Legacy combined deployment/mint with inconsistent hardcoded supply and metadata URI issue. Never invoked. |
| ft/ and tools/ton | Standard contracts and local emulator baseline exist. The separately researched presale prototype remains incomplete/unsafe to deploy. |

This inspection covers identified TON APIs, connection/session code, external
balance display and mint/claim scripts; it is not an exhaustive security audit of
every game/reward/economic path. Mainnet claim/deposit concerns remain independent
production risks requiring a separately reviewed fix.

## Settlement migration, not a database relabel

A completed sale contract should own payment acceptance, allocation and dispatch.
A verified token master/derived wallet should own token balances. The API can remain
for read-only blockchain queries, account metadata and trace projections; it must
not mint an off-chain credit from the buyer's submitted amount. Game database TPG
is separate, and no existing balances are copied, converted, reset or rewritten.

A provider balance response is explicitly `paymentVerified:false`: it cannot prove
a particular purchase. Do not treat returned BOC, query ID, excess receipt or a
balance change as full token delivery. Exact canonical trace linkage and a reviewed
refund protocol are still required. Testnet and mainnet may share parsers and UI
logic later, but must have separate manifests/session namespaces/addresses/code
hashes/indexer cursors and release approval, not a casual global flag switch.

## Verification

- Five Node tests: explicit chain and precision, session isolation, fixed provider
  destination, failure handling and real local HTTP routes including denied legacy
  POSTs.
- Three browser-component tests: wrong-network rejection, mismatched/untrusted
  response rejection, and stale balance cancellation during a network switch.
- Separate Vite production build passes; SDK bundle emits a size warning. Normal
  full game build was not rerun because its entrypoints are unchanged.
- Real wallet connection/signing, hosted manifest, actual testnet purchase, token
  transfer, refund and visual device/browser validation are not performed.

## Current deployment blockers

No verified/approved testnet sale/master addresses or code hashes; no authorized
wallet funding/deployment; no completed refund/receipt protocol; no independent
security audit; no approved production economics. No credentials created or read.
The read-only lab can be exercised locally now. Connecting a testnet wallet requires
the separate public manifest. A funded public-testnet presale is not ready.

Official references checked:
[TON Connect transaction network binding](https://docs.ton.org/applications/ton-connect/how-to/send-transaction),
[TON testnet coin guide](https://docs.ton.org/onboarding/wallet-apps/get-coins),
[jetton processing](https://docs.ton.org/applications/payments/jettons).

## Expanded requested scope: every game's winners, P2P and purchases

The owner clarified that testnet must cover winner payouts in every game,
user-to-user transfers and purchases, not only presale. **The read-only lab does
not fulfill that settlement requirement.** The shared capabilities registry and
UI/API now explicitly mark each requested monetary capability disabled. Unknown
capabilities also fail closed; no game is implicitly approved for chain payout.

A separate offline intent adapter is being developed for the shared domain layer.
An injected verifier in unit tests is not an implemented blockchain verifier, and
its pending/confirmed states must not be wired to production until authenticated
canonical evidence and durable idempotency are implemented.

| Flow | Existing sources to replace/adapt in isolated preview | Required chain boundary before enabling |
| --- | --- | --- |
| P2P | wallet.js `/send`, account.js transfer paths; api.js sendToken | Wallet-owned signed testnet transfer, proven ownership when linking accounts, recipient/address/chain binding, exact base units, canonical confirmation and replay-safe history. Do not increment another user's game balance as substitute. |
| Store | store.js `/purchase-v2` and `/purchase`; account.js `/store-purchase` and gift purchase; api.js legacy fallbacks | Server-authoritative immutable invoice/product/price/network/recipient; wallet payment; verified exact trace; transactional once-only entitlement fulfillment. No fallback to legacy DB debit on testnet failure. |
| Chess stakes | matchmaking.js reserve/release/settle | Confirm funded escrow before entering stake play; authoritative result identity/version; approved fee/refund rules; one payout/refund per match; no client-selected winner. |
| Racing | services/kartStake.js + kartRoyale.js | Replace DB reservation/settlement only in separate testnet instance; preserve server outcome authority; correlate each contribution and terminal result to escrow. |
| Tennis / table tennis | services/tennisStake.js,tabletennisStake.js and Royal services | Same escrow/outcome/idempotency rules, including abandoned lobby and expired-match refunds; existing DB transaction behavior is not on-chain atomicity. |
| Pool / Snooker | poolRoyale.js,snookerRoyal.js,poolOnlineTournaments.js | Audit authoritative outcome first. poolOnlineTournaments explicitly does not authorize wallet prizes; client-consensus results must not become payment authorization. |
| Other catalog games | bot/config/tpgGameContracts.js and each online/multiplayer outcome path | Configuration labelled game contract is not a TON smart contract. Inventory every game/result authority; keep unsupported games unpaid until their outcome/escrow adapter is implemented and tested. |
| Mining/tasks/referrals/check-in/ads/airdrop | corresponding routes credit User.balance | Separate existing game-credit economics. No automatic conversion or cash/testnet payout is authorized by a broad infrastructure switch. |

A reusable flow should use namespaced `(chain, asset master, operation, business
reference, attempt)` identities. A signed/broadcast request is pending, not paid.
On-chain payment and off-chain purchased entitlement require a durable outbox/
reconciliation loop; a database transaction cannot atomically commit blockchain
and inventory together. Game payouts additionally require outcome integrity and
funded escrow. A wallet integration alone cannot settle every game safely.

Suggested staged acceptance gates: P2P testnet transfers with explicit user approval
and trace verification first; store invoice/fulfillment next; one server-authoritative
game with contributions, winner/draw/cancellation recovery next; then enumerate
and port each remaining game's result path. Mainnet stays a separate reviewed
release. None of those monetary flows is live or claimed finished by this branch.

Public-provider smoke check: a real read-only request to the fixed testnet endpoint
successfully returned an exact nanotons string for the all-zero public fixture
address. No user address, credential, wallet signature or write was sent. This
shows public read connectivity, not testnet purchase/payout readiness.
