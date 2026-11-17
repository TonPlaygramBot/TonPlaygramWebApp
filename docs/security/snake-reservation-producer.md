# Snake reservation producer: unwired draft, no real-data use

This advances the consent/settlement foundation with native Mongo transaction
code. It does NOT activate paid games, debit any real account, create provenance
attestations, start games, deploy to TON, or change runtime routes.

## Operations

`accept` freshly verifies signed provider credentials through the existing
verifier, resolves a unique canonical user, and persists the bounded consent
receipt in the same transaction as a version-checked offer write. This conflicts
with concurrent cancellation/terms changes. The receipt records provider identity
binding but never raw credentials. Room ID is now also part of the offer digest.
Existing pre-change draft receipts need fresh acceptance; no migration invents it. A fresh signed acceptance replaces an older revision for the same canonical user; same-revision terms drift is rejected. All seats must renew before a changed offer can reserve.

`reserve` accepts only a match ID, not caller amounts/winners/accounts. It loads
server-held terms and all persisted consents and rechecks canonical user ID,
provider link, ban status, consent expiry, exact integer balances and distinct
roster. Positive fee destinations must exist uniquely before funds are held.

Before any debit, every participant must have a separate `fundingAudits` record
with the same asset, canonical user, balance and full-ledger fingerprint. There
is **no issuer or bypass** for these attestations in this draft. A hash proves
snapshot equality, NOT legitimate historical funding. A trusted, independently
verified provenance migration is still required; arbitrary existing ledger rows
must not be self-certified. No attestation is created from an HTTP request.

A single snapshot/majority transaction then:

1. Inserts `_id`-unique per-account locks (no TTL/automatic financial release).
2. Compare-and-set debits every participant and appends exact held ledger receipts.
3. Advances each already-verified audit cursor to the exact post-debit snapshot.
4. Rechecks consent deadlines after tentative writes, aborting if they expired.
5. Inserts the immutable held escrow snapshot, marks the offer reserved, advances
   the lifecycle and writes its journal entry in the SAME transaction/session.

Any failure must roll back the entire transaction. A duplicate reserve returns
an existing unstarted reserved snapshot only; it cannot restart an advanced
match. The stable round ID must be assigned to the live GameRoom only AFTER
commit by a future trusted coordinator. There is no start call here.

## Integration gates

- No collection/index migration, offer creation service, UI terms acceptance,
  account-lock release, safe automatic refund, game start, persistent moves or
  restart recovery is included.
- The prior standalone settlement adapter does NOT yet advance funding audit
  cursors or release these account locks; it must not be blindly wired to this
  producer. Reservation, start, final settlement/refund, lifecycle and journal
  must be one coherent coordinator. Missing or stale audit state must fail closed.
- Historical provenance and all alternate ledger writers remain unresolved.
  Legacy APIs can still invalidate an audited snapshot. A mismatch blocks the
  next reservation, but that is not a substitute for closing those writers.
- Internal signed provider IDs are persisted as ordinary account identifiers;
  live credential values are not. Signed credentials can still be stolen/revoked;
  apply account/session revocation policy and authenticated transport at integration.
- Pool is explicitly rejected. Its client-state relay is not a payable result.
- No mainnet/Jetton economic policy is selected. Test assets/fees are synthetic.

## Verification

`node --test bot/tests/snakeReservationProducer.test.js`: 35 passing simulated
transaction tests: all-or-none debit, exact audit progression, no duplicate debit,
write failures at each stage (including second player's debit), unique locks,
missing/stale/unverified provenance, identity changes/bans, missing/expired
consent, deadline crossing during writes, missing fee account, conflicting
lifecycle, Pool rejection, and request-shaped query injection rejection.

Real signature verification is covered by the earlier consent suite with actual
synthetic Telegram HMAC credentials. This producer suite injects a test verifier.
These tests do not prove database isolation, atomicity or durability. Real Mongo
replica-set execution remains blocked by startup exit 100 in this environment.
This is NOT production-ready or an audit. Keep paid play disabled until real
DB race/crash/rollback tests and all integration gates pass.

A dedicated real-replica-set test is now supplied at
`bot/tests/snakeReservationProducer.integration.mjs`. It injects a final journal
write failure after tentative debits to test rollback, then races two same-round
reservation requests and verifies exactly-once balances/locks/escrow. It accepts
only an ephemeral Mongo URI, never an external database. Attempted execution
here: **0 passed, 1 failed/blocked at Mongo startup exit 100**. No database
assertion ran. This is test scaffolding, not evidence that real isolation passed.
