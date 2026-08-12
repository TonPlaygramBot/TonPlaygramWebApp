# Online Contract Checklist

Use this checklist before enabling any game's **Online** toggle in lobby.

## Contract gates (must all be ✅)

- [ ] **Lobby contract**
  - Resolves the signed-in user's canonical TPG account number before queueing.
  - Sends `tpcAccountNumber` on register, seat, ready, leave, and reconnect events; legacy IDs are aliases only.
  - Seats through shared `seatTable` flow.
  - Sends `confirmReady` and handles timeout/cancel cleanup.
  - Enforces stake reserve/refund rules.
- [ ] **Runtime contract**
  - Reads `tableId` + `accountId` from URL/session.
  - Registers socket session and joins game room.
  - Applies socket state updates/reconnect flow (not local-only simulation).
- [ ] **Backend event contract**
  - Emits/handles `seatTable`, `lobbyUpdate`, `gameStart`, `leaveLobby`, refund/cancel.
  - Match completion, stake settlement, and win/loss are authoritative.
  - Telemetry emits queued → matched → started → completed/refunded.
  - Rejects zero/fractional stakes, non-TPG tokens, offline modes, identity conflicts, and unseated ready/leave requests.

## TPG stake contract

Online tables use the platform's server-side TPG ledger as escrow. A lobby may
only advertise online play when it can reserve the stake before seating, refund
an unmatched/cancelled player exactly once, and settle the completed match from
authoritative server state. Wallet addresses and Telegram IDs are authentication
inputs; neither is a matchmaking key. The canonical TPG account number is the
only player key stored in a table roster.

## Release policy

Only set a game to **Online Ready** when all three contracts pass.

- If one or more contracts are missing: label as **Beta** or **Coming Soon**.
- Never expose an enabled online toggle when any contract gate is failing.
