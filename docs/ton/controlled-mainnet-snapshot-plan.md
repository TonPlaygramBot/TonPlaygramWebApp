# Controlled future mainnet snapshot / claim plan

Status: specification and synthetic offline tests only. Current production DB
balances must remain unchanged. Testnet remains separate and conveys no mainnet
entitlement. No snapshot extraction, production access, distribution, signer or
claim contract is implemented or authorized by these tools.

## Decisions required before a real snapshot

Approve eligibility, cutoff time, spendability vs reserved stakes/orders, handling
of disputed/fraudulent awards, existing withdrawals, decimal precision, conversion
rate, allocation/cap, vesting, claim window, unclaimed funds and custody. A DB TPG
balance is not automatically an on-chain token entitlement. Avoid migrating
pending outgoing funds while also paying the outgoing transfer. Resolve pending
claims against chain receipts, not HTTP status. Test tokens never count.

The existing Mongo `balance` and historical transaction sums may disagree; current
resolveAccountBalance takes their maximum. Do NOT use maximum as migration policy.
Reconcile persisted balance, authoritative awards, reserved liabilities, transaction
history and completed external claims into an exception register. Amounts stored
as floating-point Number may already have lost precision; converting them to a
string cannot recover it. Fail/flag ambiguity and obtain an explicit rounding or
correction policy rather than infer intent. Keep original DB untouched.

## Auditable snapshot ceremony (future, separately authorized)

1. Use an approved read-only export with consistent cutoff (snapshot/read concern
   or controlled settlement pause). Document DB/version/cluster identity, cutoff,
   export method and pending-writer handling. Do not copy full profile records.
2. Reconcile exceptions; produce minimal private account entitlement table and
   independent signed-off totals/counts. Zero/negative/disputed cases require
   explicit policy. Hash exact export bytes and canonical transformed artifact;
   record transformation code commit, versions, input/output hashes and approvals.
3. Separate identity from claim artifact using a fresh pseudonymization HMAC key
   per snapshot, retained only in approved secret storage. Preserve a private,
   access-controlled mapping for support. Neither raw account IDs nor secret key
   belongs on-chain or in public artifacts. HMAC reduces enumeration but is not
   anonymity. Amounts, timing and wallet links can still identify people.
4. Publish only approved manifest/root, chain, token master, distribution contract,
   approved total and necessary policy. Individual proofs/entitlements are private
   until authorized disclosure. Never upload all claims as a public spreadsheet.
5. Independently reproduce root/count/total from approved immutable input. Contract
   must enforce approved inventory/cap and verify the exact production leaf format.
   The synthetic SHA256 JSON tree here is NOT a reviewed TON contract encoding.

## Claim authorization and exactly-once settlement

A proof of inclusion alone must NOT authorize taking funds. Authenticate the
original account, verify ownership of destination TON wallet using correct
network/domain-bound wallet proof, and bind snapshot+subject+mainnet+master+
distribution contract+recipient+amount+expiry+unique nonce in the authorization.
Never accept destination/amount from an unverified browser request. Wallet updates,
account recovery and delegated claims need explicit policies and review.

Use immutable `(snapshotId, subject)` claim identity and unique canonical delivery
receipt. States: eligible -> authorized -> submitted -> confirmed, or
reconciliation_required. Reserve authorization atomically; record submission
before acknowledging. A crash must not allow a second payment. External signing
and message submission require an idempotent outbox/query strategy; a DB commit
alone cannot make a blockchain send atomic. Confirm only verified successful
recipient delivery; timeout is not failure. Do not release entitlement, re-sign,
refund or rotate nonce just because a worker died. Replay defense must exist in
contract state too, not only server DB. Inventory depletion and bounced delivery
require an audited recovery protocol. All manual overrides must leave an append-only
audit trail with approver and evidence, never overwrite history.

## Offline tooling supplied

`tools/ton-migration/snapshot.mjs` only accepts `fixture:` snapshot IDs and
`fixture-account:` IDs. It has no I/O, network, database, credentials, wallet or
transaction code. Inputs are exact decimal strings; no Number amounts, exponent
notation, rounding or negative amounts. An independent expected base-unit total is
mandatory. Duplicate accounts fail. Canonical sorted pseudonymous entries produce
a reproducible Merkle root, per-subject proof and stable claim ID. Snapshot ID is
part of every leaf and claim identity. Changing snapshot ID is a new namespace,
NOT permission to pay twice across superseded snapshots.

Tests demonstrate arithmetic, deterministic retry, duplicate rejection, tampered
proof rejection and exclusion of original account IDs from output. They do not
prove real balance correctness, wallet ownership, production privacy compliance,
contract compatibility or actual exactly-once chain delivery. Mainnet deployment,
funding, snapshot export and claims require later authorization and independent
security review. No real DB data or secrets were used.
