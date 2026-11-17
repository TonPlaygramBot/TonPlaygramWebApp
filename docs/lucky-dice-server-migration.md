# Lucky dice/card reward migration (stacked draft)

Depends on server spin grants (#26088) and daily100 migration (#26092). Those
prerequisites are included in this development branch; review only the additional
Lucky changes after the prerequisite PRs and rebase before merging. This is NOT
an independent cherry-pick onto main.

## Preserved economics

Compared with main's rewardLogic.ts, LuckyNumber and SpinGame:
- Two uniform d6; card index is sum minus 2 (legacy maximum index 10; Q remains
  decorative rather than silently changing the odds).
- Independent uniform suit: hearts x2, spades x0.5, diamonds x1.5, clubs x0.75,
  floored, for numeric prizes only.
- 15% BONUS_X3, 15% FREE_SPIN, 70% uniform numeric draw from 400/600/800/1000/
  1200/1400/1600. BONUS_X3 is the SUM of THREE separate uniform numeric draws,
  not one prize multiplied by 3 and not multiplied by the card suit.
- FREE_SPIN grants 2 to the account's server Spin & Win entitlement count.
- Lucky requires 15 seconds elapsed after reservation (not proof of video viewing),
  then a 4-hour cooldown from successful claim. Pending outcome persists across
  refreshes/devices so retries cannot reroll it.

All dice/suit/prize fields come from the server. Balance, receipt, claim state and
cross-game free spins commit together in one conditional Mongo User update.
Claim succeeds before cosmetic animation; closing a page cannot lose the award.
BONUS_X3 is credited immediately and its three outcomes are displayed inside Lucky
Card instead of interrupting a possibly-active Spin & Win animation. That is a
cosmetic placement change, not a second credit or consumable bonus token.

## Behavior differences requiring gameplay review

The legacy UI assigned 12 card suits once per component mount and reused them
while that component stayed mounted. This server design samples the winning suit
for each reserved roll. Marginal suit odds and payouts match, but correlations
between repeated rolls in one long-lived screen do not. Exact per-mount parity
would need a server-owned board/session lifecycle, not trusted browser suits.
Do not describe this as exact behavioral parity or deploy without reviewing it.
The four-hour timer begins at successful claim before cosmetic dice animation,
rather than after the old local dice animation completed a few seconds later.

## Legacy migration and release blockers

Existing localStorage freeSpins/bonusX3/luckyRollTs are not trustworthy account
entitlements. They are NOT imported, reset or erased. Their legitimate values
cannot be separated from forged ones without other evidence. Audit/propose an
explicit owner-approved migration for legacy entitlements before deployment;
do not silently promise compatibility or wipe them. New awards use server state.

Generic balance/transaction APIs, other game reward writers and legacy ledger
reconciliation are still outside this migration. Old client builds can still
forge/overwrite rewards. Coordinate rollout and migrate/restrict those writers
before monetary/store release. Existing server-issued entitlement balances are
preserved; this change neither clears spin pending grants nor consumes bonus
prizes in another game's UI.

Operator-model tests are not proof of actual Mongo concurrency. Real Mongo
integration suites, shared balance reconciliation checks, full build, device
retry/navigation/video UX and existing game dice regression tests must pass before
merge/deploy. No production database or deployment is touched by this draft.

## Retry-key transition

The earlier #26088 client used the first available account hint for its local
request cache. The new client uses the full account/Google/Telegram tuple. An
old UUID retry hint is copied once into the current scope, retaining the old key
for its original sign-in. A per-scope marker prevents replaying that old receipt
forever after success; an existing newer request takes precedence. The server
still resolves the signed owner and validates eligibility, so this cache hint
cannot transfer another account's receipt or authorize a bonus. This recovery
is separate from untrusted old freeSpins/bonusX3 entitlements, which are NOT
imported. Failed responses retain the scoped retry ID for safe recovery.
