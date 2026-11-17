# Lucky dice/card frontend migration

LuckyNumber reserves and claims `kind: lucky` using the shared spin reward API.
The existing ad modal waits before claiming; the server enforces the minimum
reservation delay. Only a confirmed claim starts cosmetic dice/card animation.
The server's dice, selected card, suit, base prize and final amount drive the UI.
No animation callback can change the amount, credit a balance or grant a bonus.
Closing/reopening and failed claims retain the same retryable server reservation.
Daily100 remains on its separate atomic daily endpoint.

`DiceRoller.forcedValues` and `CardSpinner.forcedOutcome` are optional for other
games; absent props retain their legacy behavior. Invalid supplied outcomes never
fall back to randomness. CardSpinner's callback reference no longer restarts its
animation when its parent rerenders.

FREE_SPIN refreshes the authoritative SpinGame status without claiming or spinning.
If a spin operation is busy, the refresh is deferred until it settles.
BONUS_X3 displays all three numeric rewards and their sum in Lucky Card. It does
not commandeer SpinGame's wheels: this intentionally avoids displacing an active
spin or paying a bonus twice. The bonus is already credited atomically.
Legacy local cooldowns/freeSpins/bonusX3 are neither trusted nor erased/imported;
a visible note says older bonuses still require verification.

Shared reward operations are isolated by accountId, Google ID and Telegram ID.
Auth/account/storage events invalidate in-flight results; live identity is checked
before callbacks and wallet updates. Retry cache keys now include that complete
identity rather than only the first available hint. The server remains the only
authority. Existing server pending reservations are recovered through status/start.
Ad completion callbacks are stable across countdown rerenders.

Checks: focused frontend tests cover server-selected numeric/free/bonus outcomes,
claim failures and retries, close/reopen, no client credits, forced animation values,
invalid values, repeated clicks, cross-account in-flight start/claim isolation,
server free-spin refresh while idle/busy, daily flow regression, and legacy dice
component behavior. Bundle and targeted TS checks are separate from full production
build, device testing and real API end-to-end verification, which remain required.
