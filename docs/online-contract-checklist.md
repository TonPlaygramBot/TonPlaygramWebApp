# Online Contract Checklist

Use this checklist before enabling any game's **Online** toggle in lobby.

## Contract gates (must all be ✅)

- [ ] **Lobby contract**
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

## Release policy

Only set a game to **Online Ready** when all three contracts pass.

- If one or more contracts are missing: label as **Beta** or **Coming Soon**.
- Never expose an enabled online toggle when any contract gate is failing.
