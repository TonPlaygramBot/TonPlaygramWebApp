# Pool Royal: Showood mapping, contact precision and player movement

Base: `3f9cb3c44b7aeeccfe9ea8f8e1267cfd772e6196` on `main`.

## Shot feel

- Cushion restitution is now `0.96`, 4% below the previous effective elastic response. The old configured value of `1.012` was already capped at `1` by the spin solver. Cut faces no longer receive an extra restitution multiplier.
- Launch strength increases from `0.93` to `0.98` on the global scale, approximately 5.38%. Slider shape, break multiplier and spin selection remain the same for human and AI shots.
- Contact substeps account for ball speed and elapsed time, with a bounded work budget. Position repair never adds impulses, sound, first-hit events or fouls.

## One table and ball geometry

The previous model fit used the decorative frame bounds and an additional horizontal expansion. Collision code instead used hidden procedural cushions and enlarged circular pocket-jaw approximations. The new profile measures the existing Showood GLB's six cushion outlines, rounded jaw ends, cloth plane and slate pocket apertures. The visible model, rail/jaw collisions, aiming and secondary direction guides use the same transform. Pocket throats remain open.

The asset is pinned to upstream commit `bce1788cddb7650e3e324439d4fe670723e69332`; the download script checks SHA-256 `739903da953520d79b144fde3681c3571721b0d4ed586d330f3a1b6c8d90f529`. No production texture or GLB replacement is included. The source-coordinate aperture circle fits have a maximum radial residual below 0.048 mm; this describes the measured source mesh, not a claim of physical-world simulation precision.

The old setup also enlarged rendered balls by 17.86% while retaining the smaller collision radius. Rendering, placement, ball contact, rails and guides now share `BALL_R`, and resting sphere bottoms meet the cloth datum. Dense/coincident clusters use deterministic position constraints and measured cushion projection. Cue-ball placement searches only for clear positions and never accepts an overlapping fallback. The original legs meet the existing floor while the upper table remains fixed; rubber feet retain their thickness.

## Human players

Pool opts into perimeter walking with bounded speed, shortest-angle turns, standing before travel, alternating steps, planted feet and a settled shooting stance. Stances and walking routes use the measured outer frame while preserving the existing body size. The existing human GLB and cue remain in use. Hands use live cue endpoints and ball/rail clearance; the torso, bridge and feet stay fixed through impact. The standing shooter does not chase a moving cue ball.

Releasing the slider while the player is moving captures power, aim and spin and queues one shot. The HUD shows preparation while the player settles. Changed turns, moving balls, replays or a removed scene invalidate the queue. A missing human model cannot block gameplay. The new movement path is opt-in so Snooker's existing controller behavior remains unchanged.

## Validation and review limits

Regression tests exercise the actual JSX shot, scaling, timing, rail, guide and shot-preparation functions, plus the actual human GLB and measured Showood vertices. Other checks cover dense racks, coincident balls, rail clusters, jaw contacts, placement and shared spin behavior. Build and check results are recorded in the PR.

The in-chat React/Three.js preview uses the same movement and measured contact helpers, with simplified materials and reduced preview-only textures. It inspects shots and walking rather than simulating an entire match.

The review browser rejected the local URL with `net::ERR_BLOCKED_BY_CLIENT`. Live WebGL appearance, physical-phone frame rate and two-device online play remain unverified. Contacts use a planar full-ball-radius envelope; this is not a full 3D model of rubber deformation or airborne ball collisions. Neither microscopic physical accuracy nor issue-free gameplay is claimed.
