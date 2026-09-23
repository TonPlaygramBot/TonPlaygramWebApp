# Tirana Streets: urban driving and cockpit review

This upgrade keeps the approved original vehicle GLBs, embedded images and wheel rig triangles unchanged. `verify-vehicle-collection.mjs` verified all 11 original asset hashes. It does not claim a manufacturer simulator or a replacement for native racing-game physics.

## Driving

Nine shared arcade handling profiles cover compact, sedan, sport, supercar, SUV, van, armored, bus and bike classes. Units remain metres and metres/second. Profiles provide different acceleration, braking, wheelbase, grip and steering; original collection identity selects the profile before generic simulation role. Reverse remains capped at 20 km/h.

Input is integrated in steps of at most 1/120 second, with actual world and nearby-car contacts resolved after each step. The outer-frame delta remains bounded. High-speed steering is progressively reduced, yaw is limited by lateral grip, and existing momentum returns to the nose progressively. Service braking stops without involuntary reverse. Holding throttle and brake while steering requests a handbrake slide; releasing the brake recovers grip. The opposite throttle first brakes the vehicle before reversing. Destroyed/burning vehicles cannot accelerate.

The broad phase selects nearby vehicles once per update instead of rescanning the entire city for each physics step. This is not a continuous swept-body solver: it is bounded substep collision at the game's vehicle-speed ceiling.

## Original cabins and driver seats

| Vehicle | Cockpit source |
| --- | --- |
| Mercedes-Benz S65 | Original `miutuinter`, seat and explicit steering meshes |
| BMW M3 GT3 | Original combined interior/trim mesh |
| Ford Focus | Original combined interior/trim mesh |
| Ferrari 458 | Original interior, leather and carpet surfaces |
| Jaguar I-Pace | Original interior and seat surfaces |
| Volkswagen Golf GTI | Original instrument screens, dashboard, seats, pillars and steering surfaces |
| Range Rover, Audi A8, Fiat Punto, Bugatti, Defender | Class-specific authored basic dashboard; the audited material names did not safely identify a complete original dashboard |
| Bus and other utility vehicles | Authored basic dashboard fitted to the existing class/seat profile |

No generic dashboard is drawn over the six identifiable original cabins. Cabin instances share original geometry and PBR resources; they do not dispose the exterior cache's maps. Only explicitly isolated steering surfaces rotate. A material that also covers large seat/door stitching is deliberately excluded from the wheel animation.

Independent raycasts against the decoded original GLBs found that the old Benz and Ferrari camera mounts looked through a headrest within 4–10 cm of the eye. Their eye positions are now ahead of those headrests. The Golf eye is moved behind the original steering hub rather than directly over it. All six original cabins have a clear central road sightline at their calibrated eye position. Ordinary civilian wrappers and original collection wrappers use their respective native frames; their different +Z/+X conventions no longer rotate the cockpit incorrectly.

## Vehicle materials and wheels

Base-color/emissive texture color spaces and bounded anisotropic sampling are normalized at load time. Blended translucent materials stop writing opaque depth, while masked grilles and opaque surfaces retain depth. UVs, maps, geometry, body colors and authored roughness are preserved. The vehicle helper is applied to collection vehicles, ordinary civilian vehicles and force vehicles.

The original wheel partitions gain front steering parents located exactly at their hubs. Rolling direction, front steering and reverse rotation remain separate. Player collection cars follow the actual driven position rather than an independently smoothed position.

## Verification and limits

- `test/tiranaUrbanDriving.test.mjs`: 14 tests, including decoded original GLBs, source resource ownership, wrapper orientation, near-field windshield clearance, speed-dependent handling, frame cadence equivalence, service brake/reverse, grip recovery and a thin-wall collision at speed.
- Existing original-wheel regression suite passes without changing source hashes or triangle counts.
- Existing driver eye/support-plane tests remain applicable.
- The combined driving/overhaul suite passed 25 tests. Its civilian aircraft expectation now correctly retains zero missiles rather than expecting a negative count.
- Focused TypeScript compilation is run after integration.

Image decoding in the Node geometry tests uses the existing image-bitmap stub; those tests verify asset geometry, material assignments, texture references and transforms, not rendered texture pixels. Visual review on a real mobile WebGL device remains necessary for dashboard appearance, texture filtering, shadows, feel and measured frame rate. The five basic collection dashboards are authored approximations, not scanned original interiors.
