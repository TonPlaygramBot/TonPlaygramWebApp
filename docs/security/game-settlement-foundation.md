# Snake & Ladder / Pool Royale settlement foundation (DRAFT, NOT LIVE)

## What exists and what does not

Reviewed repository baseline: `3927dd5db040af340ca6721fbfb142ad7a679b7b`.
This is a code review and offline arithmetic foundation, **not a security audit,
TON deployment, completed game contract, or approval to enable paid play**.

- `bot/config/tpgGameContracts.js` lists identity/matchmaking fields. These are
  JavaScript API descriptors, not TON smart contracts. No game-specific TON
  escrow contract or verified on-chain address is established by this work.
- `bot/gameEngine.js` determines Snake movement/wins on the server. On finish it
  stores names in `GameResult` and broadcasts `gameWon`; that is not a durable,
  account-bound reserve-to-settlement receipt. `bot/server.js` has chess stake
  reservation/settlement but no equivalent linked Snake settlement.
- `bot/server.js` accepts Pool `poolShot.state`, copies it into a variable named
  `authoritativeState`, attaches a sequence, caches and broadcasts it. Sequencing
  does not validate physics, legal turns, rack outcome, or winner. This state
  MUST NOT authorize payment. Tournament checks do not establish a general
  authoritative monetary outcome either.
- Pool's client has pre-match stake deduction and paid-training purchase flows;
  Snake/Pool clients have reward requests to account/deposit. A client claim is
  not financial evidence. Blocking only payout without blocking paid entry can
  leave players charged without reward. The separate deposit/paid-entry
  containment drafts address that immediate risk; this foundation reopens nothing.

## The small implementation delivered here

`bot/services/settlement/reservedMatchPlan.js` is an **unwired pure planner**.
It receives a future trusted held-reservation snapshot and adjudicator decision.
It produces an immutable list of credits, without executing any credit, debit,
refund, chain operation or network call. It validates:

- game, match, asset and participant/receipt binding;
- unique participant and reservation IDs, equal positive reserved stakes;
- exact integer-string arithmetic (BigInt, bounded to 120 bits), conservation;
- a winner in the reserved roster, with a durable result reference;
- an explicit snapshotted absolute fee and recipient, no invented percentage;
- exact fee-free refunds only when the trusted record explicitly says unstarted;
- one stable settlement key for both winner and cancellation paths.

All asset IDs and fees in tests are synthetic. No ledger-to-Jetton conversion,
TPG decimals, fee economics, supply commitment, house account or production
asset is chosen. Existing monetary semantics must be independently confirmed
before an adapter is implemented. The 120-bit parser bound is an arithmetic
validation limit, not an issuance policy.

**These checks do not prove the records are genuine.** A caller can fabricate
IDs, status and evidence. The module must never be exposed as a request-body
payment API. A stable key does not make execution idempotent by itself. There is
no transaction adapter, authentication, evidence verifier or durable receipt
store here. The module is intentionally not imported by any runtime route.

## Required before paid play can safely resume

1. Authenticate canonical participants on every entry/reconnect/action. No
   compatibility identity header may grant financial authority. Close every
   alternate positive balance/ledger writer and reconcile historical provenance.
2. Atomically reserve all participants' existing spendable balances exactly once
   with an immutable match/asset/rules/fee snapshot and unique receipt per seat.
   A failed partial reserve must not leave a match running or create money.
3. Snake: persist canonical accounts, rules, initial board, ordered server moves,
   secure random outcomes and final result durably; reconstruct across restart.
   Pool: implement a genuinely server-authoritative rules/physics adjudicator,
   or separately agree a clearly disclosed trusted referee model. Do not replace
   it with client-reported winner, majority vote or sequential client state.
4. Load reservations/result/fee snapshot inside a database transaction. Verify
   adjudicator evidence references the same match/rules and final immutable
   outcome, then compare-and-set reserved to settled/cancelled, write one unique
   settlement receipt and all balance/ledger changes atomically. Emit UI result
   only after commit. On retry return the existing receipt, never pay twice.
5. Define post-start abandonment, disconnect, timeout, draw, contested result,
   dispute handling and refunds. This planner rejects those undecided outcomes.
   Reconcile existing paid attempts/stakes from durable records, not client claims.
6. Test real Mongo transaction races (winner vs cancellation; duplicate workers;
   reserve rollback; reconnect; crash after commit), migration and all bypass
   routes. Mock/pure tests are not database integration evidence.
7. Separately design TON escrow: verified token master/network/wallet binding,
   funding finality and amount, replay protection, bounded authority, settlement
   deadlines, payout/bounce reconciliation, refund/dispute policy, independent
   review and testnet end-to-end validation. Off-chain ledger points must not be
   represented as backed Jettons without reconciliation. No mainnet operation is
   included or authorized by this draft.

## Verification

`node --test bot/tests/reservedMatchPlan.test.js`: 39 passing tests after independent review. Covers both games, exact large amounts, conservation, stable
key, immutable output, deterministic ordering, refunds, and rejection of malformed
units, cross-match/asset receipts, duplicates, unheld reserves, missing evidence,
missing/excessive fees, nonparticipant winner and invalid lifecycle transitions, sparse/null rosters, zero fees, aggregate overflow and roster bounds.

Not run/provided: real database integration, socket end-to-end, device testing,
TON sandbox game escrow, testnet or mainnet transactions. No runtime behavior
changes, merge or deployment are included.
