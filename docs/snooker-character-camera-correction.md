# Snooker Royal character and camera correction

Prepared against main `729e9afc6376ac7aabe9ba2189eaa248cdd17520` after PR #25874 was merged. The SnookerRoyal.jsx blob on main was verified identical to the local starting file (`c500b9096bcbf50b5d2f207faa8744d91efbbd59`).

Publication uses main `c49c287827419fe743ee0e2dbfc40227deac3e5b`, which landed during this work. Its shared character, bridge, pose, stroke and spin dependencies were loaded into a separate validation checkout for the focused checks and preview build; its unrelated Pool Royal changes are preserved in the PR base.

The character target height now increases from 1.38 to 1.60 cue lengths, approximately 15.9%, with the existing uniform proportions and floor anchoring. This is a deliberate, clearly visible portrait-phone increase rather than the earlier subtle 5.1% adjustment.

The camera uses the established animated-eye handoff without the later position clamp, restoring the prior pose-driven shot view. Targets, position, FOV, orbit settings, blend timing, overhead, replay and gallery ownership remain controlled by the original camera flow. AI shots likewise retain the direction selected by the established planner; career mode no longer adds a second random aim rotation at fire time.

Validation covers the production handoff and actual character rig, established camera ownership, the larger character ratio, and the absence of the career-only AI aim rotation. The real rig is exercised for both seats on four headings at 30/60/120 FPS, both table sizes/scales, and portrait projection. The React/Three.js portrait preview reads its dimensions directly from production.

Browser access to the live development entry returned `ERR_BLOCKED_BY_CLIENT`. Full-game rendering and physical-phone testing remain unverified.

`node scripts/build-snooker-character-preview.mjs /path/to/preview.html` builds an inline portrait character viewer. It uses the existing GLB mesh/skeleton with reduced texture resolution and production dimensions. Its inspection camera and simple table are for reviewing character height and eye clearance, not a replacement for the full game's arena, camera system or shot physics. No production character asset was changed.
