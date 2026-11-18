# Read-only testnet jetton trace verifier

This module is unmounted, read-only and fail-closed. It does not execute or enable
settlement. No production balance is read/migrated/modified. Latest owner decision:
keep the existing economy in the database and testnet separate; any future controlled
snapshot/claim is a distinct approved project, never an automatic conversion.

## Implemented

`bot/settlement/verifiers/toncenterTestnetJetton.mjs` fetches TONcenter testnet v3
traces by the immutable registered originating message hash. It accepts no caller
RPC URL, API key, callback evidence or default asset. A trusted policy must pin the
testnet master and exact standard-wallet code BOC/hash. Only the repository-style
standard jetton wallet data layout is supported; arbitrary/custom jettons fail.
No real TPG/testnet token policy is installed.

Checks include complete trace/no pending messages, exact origin account/message,
server-created intent time (reject historical payment claims), successful finalized
non-emulated transactions, matching message edges, decoded BoC/body hashes, exact
amount and query ID, owner/master-derived wallet addresses, unchanged pinned wallet
code, recipient success and ordered logical times. It does not trust a decoded
transfer summary, ticker, current balance, client callback or excess receipt.
Origin message matching is exact, not an arbitrary BOC hash or normalized hash guess.
A future signer/submission registrar must record the correct canonical identity.

## Deliberate settlement gate

A matching trace returns `providerObservedDelivery:true` and
`providerFinalized:true`, but **always** returns `finalized:false`, `delivered:false`
and `settlementEligible:false` to the settlement adapter. This is intentional:
provider JSON is an indexed observation, not cryptographically verified TON block
proofs, and no trust/monetary activation has been approved. Therefore even this
module's positive observation cannot confirm an intent or release an entitlement.

The module validates the graph and message contents under the pinned-code semantic
assumption. It does not emulate historical account state or cryptographically bind
the provider's transaction/code/finality fields to a verified block. No reviewed
production policy/code allowlist exists. Standard-storage address derivation is
not universal across every jetton implementation. Unsupported/missing/ambiguous
responses, wrong code/master/network/amount, historical messages, provider errors
and incomplete indexing remain reconciliation-required. Refunds are not inferred.

## Tests and real-read limits

Four tests exercise success-shaped synthetic TONcenter fixtures using actual
compiled repository wallet code and real encoded message BoCs, plus26 adversarial
mutations and provider/missing-policy failures. These fixtures do not pretend to
be on-chain payments. A separate public read retrieved the provider's current
schema and a real unrelated testnet transfer trace without signing or user data.
It established API shape/connectivity, not a successful verification of an approved
TPG transfer. No positive live fixture or approved user testnet transaction exists.

Observed schema detail: provider Swagger defines finality as integer enum0/1/2;
a real response returned `finalized` as a string. Both exact finalized forms are
handled; other/missing forms fail. API shape drift is a reconciliation failure,
not a reason to skip a check.

## Primary sources

- [TONcenter v3 overview and testnet URL](https://docs.ton.org/ecosystem/api/toncenter/v3/overview)
- [Provider-served schema](https://testnet.toncenter.com/api/v3/doc.json), retrieved2026-11-18
- [Jetton wallets fields](https://docs.ton.org/api/v3/jettons/get-jetton-wallets)
- [TEP-74 transfer protocol](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)

Before monetary enablement: approved chain/master/code policy, known testnet
transaction fixtures, source-bound authenticated business intent, canonical
submission registration, durable repository, proof or explicitly approved provider
trust model, outcome/refund review and full end-to-end authorization tests.

Future snapshot/claim planning must first specify a cutover snapshot/version,
reconciled entitlement amounts, owner consent and wallet ownership proof, privacy-
preserving export, immutable claim identity/root, one-time claims, vesting/eligibility
rules and dispute handling. Rehearse only synthetic snapshots in testnet. Do not
export real user balances or publish a claim root until separately authorized.

Integration check: a fifth test feeds a positive provider observation through the
actual settlement adapter. It remains `reconciliation_required`, never `confirmed`.
The SQLite follow-up is integrated on this branch with immutable server timestamps
and atomic unique receipt handling; its real-process restart/SIGKILL/concurrency
tests pass. Durable storage does not replace blockchain evidence or authorize any
snapshot, claim, reward, payout or balance import. No verifier route is mounted.
