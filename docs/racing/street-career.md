# Tirana Racing Streets: closed-circuit career

Career is an explicit garage button. Old free-roam/action/trial links still open the normal garage. It mounts a separate renderer only after the garage unmounts, and returns without retaining held controls. No old city jobs or on-foot/free-driving missions are reactivated.

Every current `TRACKS` entry becomes one stage, keyed by stable track ID (not its index). The route work supplies 20 entirely new urban circuits: this module does not invent routes. Stages unlock in catalog order; replay remains available. Top-three, then top-two, then first-place targets and increasing AI pace provide progression. A completed finish, podium, win, and at least 90% finishing condition each grant 25 local XP once per route; stage clearance grants its listed bonus once. Replay can improve time/earn missing tasks, never repeats an already-earned bonus.

The player can choose the existing Turi or helmet driver, existing karts, paint, rocket allowance and shield allowance. 300/600 earned XP unlock second rocket/shield charges. Supplies refill per attempt; load them into an empty item slot and use normal race pickup controls. Existing arcade rockets and four-second shields remain unchanged. Local career supplies cannot be loaded in network, paused, countdown or finished states. Standard races do not receive them.

## Persistence and limits

Dedicated versioned localStorage stores validated route/task completion, best times and loadout. XP is derived from known completions, not trusted from the stored total. Unknown/removed rural IDs and invalid selections are discarded; corrupted/unavailable storage falls back safely and save failures are visible. Existing cup/TPG/account state is untouched.

This is device-local practice progression, not secure competitive entitlement or cloud synchronization. Users can edit their own local saves. No wallet/API mutations, paid purchases, transfers, NFT calls, or withdrawals. A quit, unfinished race or invalid/mismatched/online result earns no reward. Renderer result standings are sorted before position evaluation.

## Verification

7 core tests: dynamic route count, unlocks, one-time reward/task semantics, invalid results, save/load failure and migration, bounded item slots, malformed XP.
26 React/navigation/renderer tests: garage/career lifecycle, retired-link fallback, customization persistence, blur/pause/held-input cleanup, completion once, local-only supply guards, existing launch regression coverage.
Kart Vite build passes. Scoped TypeScript currently reports 16 pre-existing missing declarations in imported Tirana scenery files, none in changed files. JS core/test explicit lint passes. Project ESLint does not configure TS/TSX checks. Full production build, physical-device play and visual driver/loadout validation remain pending; integrate route worker changes before asserting visually verified stages.
