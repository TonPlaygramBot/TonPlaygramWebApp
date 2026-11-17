# Paid Snake / Pool containment rollout

Stacked on wallet containment #26102. Deploy both changes together, never the
cashout/reward pause on its own while new paid entry remains open.

The shared immutable pause policy stops affected negative profile transaction
requests before persistence (including Pool's pre-match stake and cue fees),
and stops `pool-training-attempt` bundles on account/store-purchase plus both
legacy store purchase routes. Unrelated store goods remain unchanged.

The central seat function, validated socket seating, match-start scheduling and
delayed callback, existing-room reconnect, all four Pool join/sync/frame/shot handlers, and legacy HTTP seating reject paid
Snake/Pool entry. Numeric zero and explicit zero-stake tournament objects remain
free. Missing/malformed stakes on affected existing rooms fail closed. Free Pool
tournament service itself creates only zero-stake tables, no prizes.

Frontend lobbies refuse paid entry before any debit. Pool attempt purchases show
the pause instead of calling purchase APIs. Snake shows the notice and forces
its displayed prize to zero, including URL-driven AI sessions. Pool lobby shows
the notice; practice itself remains available. No paid reward promise is made by
the notice. Existing training roadmap reward labels have not been redesigned.

Already-paid/staked sessions and training attempts require operator
reconciliation. This patch does not invent credits or refunds, erase data, or
prove historical balance legitimacy. Cached clients get server denials. Positive
refund requests and unrelated game's transactions remain unchanged, not certified
secure. Malicious clients relabeling generic ledger writes are outside this
rollout guard; broad ledger hardening is still required.

Validation: Node route tests use actual Express registrations and throwing model
and notification doubles. Pool socket tests execute actual extracted registered handlers in a VM with
mocked dependencies (paid/free variants). Generic seat/start coverage checks
wiring in server source plus policy cases, NOT a live end-to-end socket/DB test. JSX parsed with Babel; no full
production build or browser visual verification is claimed. No merge/deploy.
