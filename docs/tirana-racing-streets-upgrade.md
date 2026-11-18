# Tirana Racing Streets

Display rename only: saved IDs, route `/games/kartroyale/lobby`, multiplayer protocol and download pack IDs remain compatible. Career, Time Trial and Combat are not restored as selectable modes.

## Race changes

Standard races now contain personal, deterministic rocket/shield/boost supplies. One slot per kart; E or the touchscreen pickup button activates it. Pickups respawn after 12 seconds for that kart. Rockets fly straight, expire at the course edge, and slow a rival rather than damaging or eliminating it. Four-second shields block rockets. Boost gives a short turbo burst. A brief immunity window prevents stacked hits. Client requests contain only a strict boolean use action; inventory, projectiles, hits and timers are owned by the server online and the fixed-step simulation locally. AI earns and uses the same supplies.

Base cruise/turbo limits changed from 33/44 to 31/41 (~6–7% lower), equally for human and AI karts. AI passing now considers rear closing speed, abandons newly unsafe passes and uses moderate lane offsets with steadier commitment. No catch-up teleport or player-distance speed advantage was added.

Pickup rotation/bob, rocket flame, shield shell and impact rings use bounded instanced meshes. Reduced-motion disables bob/rotation/flame pulsing and impact rings. Touch pickup input clears on cancel, blur, modal disable and consumption.

## City

Existing verified CC0 plaster uses its source 2.2m physical scale; generic building caps now use the existing CC0 rough-concrete PBR material. Source footprints, road geometry, collision geometry and landmark models are preserved. This is not a new photogrammetry map or wholesale asset replacement. See asset audit for evaluated Poly Haven/Sketchfab candidates and commercial-license caveats. No unverified third-party model was imported.

## Verification and limitations

- 33 focused Node tests passed (gameplay, rendering budgets, controls, AI completion and city UV/material groups).
- 25 navigation/runtime tests passed.
- 25 item/online/pace tests passed, including actual Socket.IO spoofed inventory/string-input rejection and serialized state.
- Root TypeScript build and standalone Racing Vite production build passed. Vite retains pre-existing large-chunk warnings.
- Broad racing/kart run: 258/262 passed initially. One neutral-input fixture needed the new `useItem:false` field; after correction that entire file passed 8/8. Remaining failures are two stake suites missing bot `uuid` dependency and the pre-existing Farke road-ribbon assertion.
- Scoped kart typecheck still reports the same 16 pre-existing TS7016 declarations in unrelated Tirana modules; no new diagnostics.
- Full rendered mobile/desktop gameplay is not verified: Chromium has been blocked by the execution sandbox. Visual readability, city materials and multiplayer latency need real-device playtesting before release.
