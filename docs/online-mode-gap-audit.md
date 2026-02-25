# Online Mode Gap Audit (Games Page)

_Last updated: 2026-02-25._

This audit reviews every game exposed on the Games page and maps it against the existing online contract gates:

1. Lobby contract
2. Runtime contract
3. Backend contract

It is intentionally scoped to readiness and delivery planning (no gameplay logic changes).

## Current snapshot

| Game | Catalog status | Observed implementation status | Priority |
|---|---|---|---|
| Pool Royale | Online Ready | Strongest implementation (custom table sync/events beyond lobby seat/start) | P0 keep stable |
| Snooker Royal | Online Ready | Strong implementation (custom snooker sync/events) | P0 keep stable |
| Snake & Ladder | Online Ready | Dedicated online flow and multiplayer socket events | P0 keep stable |
| Chess Battle Royal | Online Ready | Advanced online hooks and table flow | P0 keep stable |
| Domino Royal 3D | Beta | Readiness gate exists in lobby; online toggle can be blocked when backend not ready | P1 promote after backend gate passes |
| Ludo Battle Royal | Beta | Readiness gate exists in lobby; online alerts/fallbacks present | P1 promote after backend gate passes |
| Texas Hold'em | Beta | Shared matchmaking enabled in lobby; backend marked incomplete | P1 harden backend + disable toggle while beta |
| Air Hockey | Beta | Shared matchmaking enabled in lobby; backend marked incomplete | P1 harden backend + disable toggle while beta |
| Goal Rush | Beta | Shared matchmaking enabled in lobby; backend marked incomplete | P1 harden backend + disable toggle while beta |
| Murlan Royale | Beta | Shared matchmaking enabled in lobby; backend marked incomplete | P1 harden backend + disable toggle while beta |
| Table Tennis Royal | Beta | Shared matchmaking enabled in lobby; backend marked incomplete | P1 harden backend + disable toggle while beta |

## Key gaps found

## 1) Policy mismatch: Beta games still expose active online entry in several lobbies

The release checklist explicitly says not to expose enabled online toggles unless all gates pass. Some games follow this policy (Domino/Ludo), while several Beta games still show active online mode.

**Impact:** user trust risk, failed queue attempts, refunds, and rating damage.

### 2) Readiness source-of-truth is not uniformly enforced

Games page uses centralized readiness labels, but lobby enablement is not uniformly wired to those labels. This causes "Beta" cards that still behave like launch-ready online products.

### 3) Backend completion path is implicit, not explicitly tracked by game

`onlineContract.js` stores backend false/true flags, but there is no per-game engineering checklist in repo to move Beta → Online Ready with explicit acceptance criteria and owners.

### 4) Cross-game telemetry KPIs are not codified in docs/checklists

The contract mentions queue/start/refund telemetry, but there is no dashboard-level target spec (e.g., timeout rate, queue time p95, rematch conversion) for launch gates.

## Recommended implementation plan (mobile-first, top-rated quality)

## P0 (this week)

1. **Unify lobby gating with `getOnlineReadiness(slug).ready` for every game lobby.**
   - If not ready: disable online option and show Beta tooltip/message.
   - Keep local/AI fully playable.
2. **Define launch SLOs for online mode** (per game and global):
   - queue time p50/p95
   - match start success rate
   - timeout/refund rate
   - reconnect success rate
3. **Add pre-launch smoke script for all online games**:
   - seatTable
   - lobbyUpdate
   - gameStart
   - leave/refund

## P1 (next sprint)

4. **Backend authoritative settlement completion for all Beta games.**
   - authoritative win/loss result
   - anti-double-settlement idempotency keys
   - reliable stake reserve/refund ledger path
5. **Runtime resilience hardening on mobile networks**:
   - reconnect + state reconciliation within 3–5 seconds
   - suspended-app resume handling
   - stale table cleanup
6. **UX polish for competitive retention**:
   - clear queue states (searching / found / connecting / failed)
   - rematch CTA and party/invite affordances
   - lightweight post-match performance summary

## P2 (quality scaling)

7. **Anti-cheat baseline per game type**:
   - server-side move validation where feasible
   - suspicious action rate instrumentation
8. **Performance budget enforcement**:
   - frame-time and memory targets on mid-tier Android
   - reduced effects profile auto-toggle
9. **Monetization reliability**:
   - escrow status visibility in lobby + match HUD
   - dispute-safe transaction log links

## Added task board (ready to execute)

- [ ] Create `ONLINE_GATING_TASK`: wire every lobby online toggle to centralized readiness.
- [ ] Create `ONLINE_BACKEND_TASK`: finish backend contract for Texas Hold'em, Air Hockey, Goal Rush, Murlan Royale, Table Tennis Royal, Domino Royal, Ludo.
- [ ] Create `ONLINE_QA_TASK`: automated online smoke test matrix for all game slugs.
- [ ] Create `ONLINE_METRICS_TASK`: publish target thresholds and dashboard widgets.
- [ ] Create `ONLINE_MOBILE_TASK`: reconnect/resume test pass on portrait mobile devices.

## Acceptance criteria to mark a game "Online Ready"

A game can move from Beta only when all are true:

- [ ] Lobby gating + stake flow passes (including timeout refund path).
- [ ] Runtime joins room and reconciles state after reconnect.
- [ ] Backend settles result authoritatively and idempotently.
- [ ] QA smoke tests pass on at least one Android + one iOS Telegram webview target.
- [ ] KPI targets met for 7 consecutive days in production-like traffic.
