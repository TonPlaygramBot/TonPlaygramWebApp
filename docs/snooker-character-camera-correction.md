# Snooker Royal character and camera correction

Prepared against main `729e9afc6376ac7aabe9ba2189eaa248cdd17520` after PR #25874 was merged. The SnookerRoyal.jsx blob on main was verified identical to the local starting file (`c500b9096bcbf50b5d2f207faa8744d91efbbd59`).

Publication uses main `c49c287827419fe743ee0e2dbfc40227deac3e5b`, which landed during this work. Its shared character, bridge, pose, stroke and spin dependencies were loaded into a separate validation checkout for the focused checks and preview build; its unrelated Pool Royal changes are preserved in the PR base.

The character target height increases from 1.38 to 1.45 cue lengths, approximately 5.1%, with the existing uniform proportions and floor anchoring.

The pre-PR camera presets and human-eye handoff were unchanged by #25874. Executing the actual GLB pose exposed eye positions below the cloth during address/strike. The handoff runs after the orbit camera's clearance check, allowing the animated eye to override it. The correction clamps a cloned eye position to the actual cloth plus the existing cue-camera clearance, in local coordinates before world scale/translation. The original position is untouched when already safe. Targets, horizontal position, FOV, orbit settings, blend timing, overhead, replay and gallery ownership are preserved.

Validation: 4 new Node tests using the production handoff and actual character rig, 3 existing shot-camera tests, and 13 focused Jest shooting/table checks passed (20 checks total). The real rig was exercised for both seats on four headings at 30/60/120 FPS. Tests cover both table sizes/scales and portrait projection. Strict TypeScript checking passed for the React/Three.js preview. Vite production compilation passed with output/public-asset copying disabled; existing asset-resolution warnings remain.

Browser access to the live development entry returned `ERR_BLOCKED_BY_CLIENT`. Full-game rendering and physical-phone testing remain unverified.

`node scripts/build-snooker-character-preview.mjs /path/to/preview.html` builds an inline portrait character viewer. It uses the existing GLB mesh/skeleton with reduced texture resolution and production dimensions. Its inspection camera and simple table are for reviewing character height and eye clearance, not a replacement for the full game's arena, camera system or shot physics. No production character asset was changed.
