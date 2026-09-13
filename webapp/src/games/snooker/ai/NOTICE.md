# Snooker Royal / Tailuge integration

Upstream: https://github.com/tailuge/billiards

Pinned revision: `e6ed0dba43e09177540f176ad7a62b1ef6f64415`

Author: tailuge. Upstream declares GPL-3.0; the complete licence is in `COPYING`.

`tailugeAim.ts` adapts the ghost-ball construction, cut-angle scoring and ray/ball
geometry from `src/network/bot/aimcalculator.ts`. Vector3/Three.js operations
were replaced with dependency-free 2D values; radius and pocket positions are
provided by Snooker Royal. This directory contains only aiming code; the full engine and table added by
the later integration are documented in ../vendor/tailuge/NOTICE.md. The upstream ClawBreak constant-power/nearest-ball
policy is replaced with the local `shotPlanner.ts` adapter's route checks and
the Tailuge physics power mapping.

The adaptation and planner are GPL-3.0-only. Distribution of the combined
Snooker Royal game incorporating them must comply with GPLv3, including
providing corresponding source and these notices. The repository's existing
MIT notice remains applicable to its original code; it does not replace the
GPL terms on this integration. Existing asset licences remain applicable.

Changes made for this integration:

- exact authoritative snooker ball-on filtering;
- evaluation of legal target/pocket pairs using actual table mouths;
- swept ball clearance and first-contact checks;
- cut-dependent power request through the existing power mapping;
- deterministic direct, one-cushion and two-cushion contact search;
- cache of the last layout and rules state, with no mutation of live balls.

This is geometric planning, not a complete rollout of the production physics.
Cushion friction, throw and spin can change an estimated route. When no clear
route is found the planner marks its last-resort attempt `verifiedContact: false`;
the real shot still goes through TailugeSnookerRules, including foul penalties.
