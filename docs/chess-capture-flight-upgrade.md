# Chess capture presentation update

Visual-only changes; no chess rules, targeting, networking or real-world weapon controls.

- Lower the short rocket / drone lane about 16%, and other ground missile apex constants about 14–15%. Jet/helicopter lanes remain unchanged.
- Ukrainian quadcopter holds directly above the capture square before dropping its visible payload, then departs beyond that square. Airframe heading stays level; only selected propeller assemblies spin.
- Payload attachment uses fitted airframe underside and missile tail bounds, including models whose geometry sits above their root. Exact-time release sampling avoids frame-skip jumps. The drop accelerates vertically and preserves the existing capture/impact timing.
- Rotor selection recognizes the source GLB's four Circle002–005 assemblies with local Z blade-plane normals; named fallbacks exclude motor/frame/body and ancestor containers. Original rest quaternions are preserved and clones have independent animation state.
- Explosion uses a short warm flash, cooling orange fire, radially expanding billows and delayed rising smoke, rather than pink orbiting spheres. Effect meshes are fixed-size pools per explosion and disposed when finished.

## Verification

32 Node tests passed: 4 delivery/drop/blast, 5 rotor assembly fixtures, 23 existing chess rules/physical movement tests. Tests cover hold/release/departure, accelerating vertical fall, 30/60/120 FPS path samples, blast lifetimes, model-body invariance, fallback and clone isolation. Source GLB node metadata was inspected.

Root TypeScript build passes. The complete ChessBattleRoyal dependency bundle builds with esbuild. Modified JavaScript/JSX passes an undefined-variable lint check. Full-game visual QA could not run because Chromium cannot start in this sandbox; no rendered visual approval is claimed. This is an art-directed in-game effect, not a physical simulation. No multiplayer integration or full unrelated-games asset build was run for this presentation-only change.
