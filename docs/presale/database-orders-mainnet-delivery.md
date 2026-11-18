# DB orders, verified payment, direct wallet delivery

Status: isolated design and synthetic offline state tests only. Supersedes the
proposed testnet economy direction. Existing game balances, rewards and purchases
stay in their current database. No production routes/data/configuration changed.
Target date is 20 December, not authorization to bypass launch gates.

## What the owner gets

A presale purchase should automatically queue real TPG jetton delivery to the
buyer's bound TON wallet after verified payment. DB order credit, queued transfer,
RPC acceptance and actual recipient delivery are different states. Never label
queued/submitted tokens delivered. Immediate means automatic processing after
confirmation, not guaranteed zero latency or settlement during an outage.
No game balance conversion or deduction is implied by a presale purchase.

## Existing source audit

- No dedicated presale order model, verified presale payment handler or delivery
  outbox was found in bot/models, bot/routes or bot/utils at base 315d80d.
- User.js keeps balances and transaction amounts as Number; transaction status
  defaults to delivered. Do NOT reuse these fields as an on-chain order ledger.
- wallet.js /deposit accepts client amounts as DB credit. This is not payment proof.
- tonClaim.js uses a mainnet-default RPC, a mnemonic signer and a custom claim
  opcode. sendTransfer completion is not recipient delivery. Do not reuse it as
  an audited presale sender or infer the hardcoded token address is approved.
- Existing stored walletAddress is not sufficient proof of current wallet control.

## Server-owned order and atomic boundaries

Use separate Mongo collections, not embedded User.transactions, with exact base
unit decimal strings and server-selected offer version/price/quantity/cap.
PresaleOrder contains immutable authenticated buyer, network, payment asset,
receiving address, unique invoice, exact payment amount, token master, exact token
amount, verified recipient, expiry and idempotency key/fingerprint. Client sends
selection only; it cannot supply a trusted price, amount or proof of delivery.
Unique indexes: buyer+idempotencyKey; network+paymentReceipt; order+deliveryId;
network+deliveryReceipt. Pin policy versions and append-only audit events.

In a Mongo transaction: atomically accept one verified payment receipt, reserve
sale inventory and create exactly one outbox entry. Use conditional version updates.
Validate deployment supports transactions/majority durability before use; no
standalone-Mongo fallback or in-memory financial ledger. Duplicate requests with
changed economics fail. DB credit does not alter the game's User.balance.
Reserve/expire inventory with a defined late-payment policy. Late, under/overpaid,
wrong-token, third-party-payer or excess orders go to reconciliation, never guessed
fulfillment or automatic refund. These policies are still undecided.

## Payment and delivery proofs

Payment asset/provider is not selected. If TON/jetton: monitor approved mainnet
receiving addresses through a reviewed chain verifier, authenticate the token
master and sender wallets, exact amount, invoice, network, transaction success,
finality and unique receipt. Browser hashes, wallet-connect success, metadata and
unsigned webhook content are not proof. If fiat: provider signature + server
lookup + replay checks and approved chargeback risk policy are required before
irreversible token delivery. Do not silently substitute fiat for crypto.

Delivery worker must use approved token inventory, not automatic minting. Bind
recipient through authenticated account plus verified TON proof/domain/nonce and
explicit checkout confirmation. Create/persist one deterministic signed message
and its hash before broadcast, using approved restricted signer/custody. A crash
between signing/persistence is still a concern requiring signer idempotency.
Wallet sequence number coordination must cover all users of the treasury.

Persist submission_unknown before sending. RPC timeout never authorizes a new
transfer. Reconcile the exact prior message and complete recipient-wallet trace.
Resending the same still-valid signed message may be safe only under reviewed
wallet replay semantics; new sequence/query after expiry needs conclusive prior
non-delivery, not timeout. Jetton query_id by itself is not exactly-once protection.
On partial/bounced/ambiguous delivery retain obligation and reconcile; no automatic
refund/retry that could double-pay. Only verified recipient receipt closes order.
Inventory and gas alerts, pause switch and audited manual recovery are required.

## Supplied prototype and limits

`tools/presale/offlineOrderModel.mjs` is a synthetic in-memory state model, not
runtime code. fixtureVerified is fabricated test input, not verification. All
identifiers must start fixture:. There is no HTTP mounting, DB/RPC connector,
signer, credential, transaction or mainnet activation. Four tests cover exact
order binding, replay, receipt reuse, crash uncertainty and recipient delivery
binding. They DO NOT establish durable atomicity or real chain correctness.
There is deliberately no retry, refund or balance mutation function.

## Launch gates for 20 December

1. Approve sale economics (price, accepted payment asset, allocation, decimals,
   limits, dates/timezone), refunds/late payments, recipient-change policy and
   whether the target year is the upcoming December. No invented defaults.
2. Verify official mainnet TPG master/code/decimals and sale inventory; select
   treasury receiving address and restricted signer custody with owner approval.
3. Implement/independently review Mongo transactional repository and outbox,
   authenticated checkout, payment verifier and delivery reconciliation. Test
   duplicate workers, restarts, provider disagreement, stale history, malicious
   tokens, gas shortages, expired orders, bounces and delayed messages.
4. Validate end-to-end delivery with an explicitly authorized minimal transfer
   and staged release/caps only after audit. No such transaction is authorized or
   performed here. Keep checkout closed if any gate is unresolved.

## Primary references

- https://docs.ton.org/applications/payments/jettons
- https://docs.ton.org/onboarding/explorers
- https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md

TON's docs require authenticating the expected master/wallet relationship. Its
explorer guidance explicitly warns sender success is not recipient acceptance.
