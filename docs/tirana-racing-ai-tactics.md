# Tirana Racing Streets AI tactics

The shared deterministic racecraft planner now considers the swept lane-change corridor and a 0.7-second rear-traffic projection. A fast rival approaching from behind can veto a pass before it is alongside. A previously committed pass is cancelled if its corridor becomes occupied; hysteresis no longer forces an unsafe manoeuvre.

Passing candidates include a clearance lane beside the slower kart, instead of only both road edges and centre. A successful choice is held for 1.35 seconds to reduce weaving. The existing current-lane braking, no-forward-progress recovery and equal simulation rules remain unchanged. No player-distance rubberband, teleporting catch-up, hidden nitro or difficulty-specific weapon advantage was added.

Verification: `node --test test/racingRacecraftTactics.test.mjs test/racingPaceUpgrade.test.mjs` passed 13 tests. Six new cases cover measured passing room, fast rear traffic, unsafe commitment cancellation, safe hold, blocked-lane braking and deterministic immutable planning. The existing suite includes all-circuit ordered three-lap AI completion. This is numerical regression coverage, not a visual racing playtest or proof of optimal racing decisions.
