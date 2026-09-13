# Snooker Royal uploaded table and camera baseline

The default Snooker Royal table now uses the supplied MesXwi GLB. The previous importer fitted outer bounds and could form a convex hull around a combined cushion mesh, closing the pocket gaps. The new table has its own measured geometry adapter; the existing rules, ball solver, cue release and camera state machines remain in place.

## Camera baseline

`a560959` (2026-09-13 01:04:39 +02:00, “Restore Snooker camera and AI while enlarging players”) is the camera state that was present during the morning. The later Tailuge changes were reverted. `SnookerRoyal.jsx` on the starting `main` matched that restoration exactly, and the shared human-player and shot-camera modules have no differences from it.

The broadcast, action, pocket, player-eye, overhead and replay camera functions remain unchanged. Eleven function fingerprints against that commit and the existing real-character camera tests guard the morning behavior. Pocket-camera targets now come from the uploaded table's actual openings through the existing camera flow.

## Mapping and rendering

- The same bed-centered transform maps the visible mesh, six separate cushion contours, rounded ends, pocket lips and ball spots. The original atlas and baulk markings remain intact. The baulk end aligns with the existing game's orientation.
- Cloth height equals ball-center height minus ball radius. Tabletop scaling is uniform. Only lower leg sections extend to meet the established arena floor, preserving character and camera coordinates.
- Cushion contours are sliced from actual GLB triangles at the ball-center plane. No whole-table convex hull or procedural jaw circles overlay them.
- Pot detection uses the original cloth cutout polygons. Balls fall into the uploaded pockets instead of traveling along invisible procedural holders.
- Cue placement and colour respots respect the actual cushion noses. Only the active table owns physics; decorative tables cannot replace its mapping.
- Shots remain disabled until the model has loaded. Failed loading provides a retry action. The model is fetched once and cloned for the other tables.
- The prepared asset is 7,408,740 bytes, down from 255,951,228. Its URL is same-origin and included in the Pool/Snooker downloadable game pack.
- The uploaded table keeps its authored finish, base and rails. Legacy procedural finish/base/rail-marker options apply to the explicit classic table; they do not replace parts of the uploaded model.

Asset attribution and the embedded CC BY-NC 4.0 licence are in `webapp/public/assets/snooker-royal/mesxwi/NOTICE.md`. Additional commercial-use permission has not been established by this change.

## Validation

- 55 focused Jest checks pass across live slider-to-impulse execution (including loading/error gates), table selection/specifications, shot release, physics clock, rules, career, deciding black, coaching and audio.
- Six new Node checks pass using the actual GLB: 22-mesh/UV retention; cloth/ball/floor alignment; all contour vertices checked against loaded mesh triangles; 54 pocket trajectories (six pockets × three approach angles × three speeds); six rail rebounds and invalid placements; production table-constructor ownership; morning camera fingerprints.
- Four existing real-character camera checks pass, including both table sizes and portrait projection.
- Strict TypeScript checking passes for the new mapping module and React/Three.js preview.
- The full webapp production build and versioned game-pack generation pass. Existing shared-app large-chunk warnings remain.

The cloud browser rejected `http://127.0.0.1:5173/snooker-review.html` with `net::ERR_BLOCKED_BY_CLIENT`. Full-game WebGL interaction, physical portrait-phone performance, and online two-client play have not been verified. The PR stays a draft for that review; automated checks do not establish that the game has no issues.

## Review

Run the existing webapp dev server and open `/snooker-review.html` to play the actual game. Check a break, corner/side pots, jaw misses, cue placement after a foul, colour respots, player-to-broadcast transitions, overhead/replay, loading failure and a second match on a portrait phone.

`node scripts/build-snooker-table-preview.mjs` builds the self-contained portrait table/collision review. It uses the production mapping adapter and table topology with smaller textures and rounded preview vertex precision. Its three inspection cameras and single-ball shot are a focused table review, not the full game or the production camera choreography.

Regenerate the game asset and mapping with `python scripts/import-snooker-table.py /path/to/snooker_table.glb` (NumPy and Pillow required). The source upload is intentionally not duplicated in Git.
