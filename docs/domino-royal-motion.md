# Domino Royal character motion

The board and the original one-to-seven-tile rack anchors stay fixed. Both hands target the visible outer rack surfaces, selected from the actual row direction for each seat and view. Plays and stock draws use one contact/lift/carry/release timeline, and pass audio fires at the right-hand tabletop contact.

Hand articulation uses anatomical palm normals and finger hinge axes from the bind skeleton. Pinches anchor the actual index skin at the selected edge and conform the thumb to the bounded tile, with the other fingers tucked back; support, flat-palm washing, and fist contact have separate shapes. The actual skinned hand surface supplies contact clearance. Legacy shared-rig callers retain their existing behavior.

The hand has a separate 350 ms return after touchdown. The domino remains planted while the hand withdraws above the row and returns to its support grip. Gameplay callbacks wait for that return. Active body poses blend into and out of idle, and the neck/head counterpose keeps the face above the table during deep reaches.

The opening displays all 28 pieces face-down, washes them across the cloth using planar palm impulses and conservative collision footprints, then draws the randomized authoritative deal one tile at a time. Online clients replay the same hand manifest. Input stays locked through motion, duplicate revisions do not replay actions, and newer snapshots wait for release. Appearance changes also wait for motion to finish.

Human racks with eight or more tiles scale by `7 / count` inside the original seven-tile span. Drawing and playing interpolate between rack and board scales.

## Review

- Production scene: `/domino-royal-review.html?players=2&width=390` (also 4 players; 320/390/430px).
- Isolated React/Three.js/TypeScript motion preview: `node webapp/scripts/build-domino-motion-preview.mjs`. It embeds the default shipped avatar with original geometry and skeleton; only textures are reduced. It reuses production motion functions and opens with both rack supports visible in portrait. Play/pause and scrubbing expose pickup, carrying, release, drawing, knock, and shuffle poses. Its fitted camera and simplified furniture are review-only.
- Offline mesh review: `python3 webapp/scripts/render-domino-hand-poses.py /tmp/domino-hand-poses`. Requires Node dependencies, g++, and Pillow. This evaluates the production motion and actual skinned model, then writes depth-tested geometry renders for every seat plus the 390px review camera. The simplified materials make finger and table intersections visible. These are mesh inspection renders, not screenshots of the full app.
- Preview source refresh: `node webapp/scripts/refresh-domino-review-motion.mjs`. Verify with `check-domino-review-parity.mjs` and `check-domino-review-orchestration.mjs` in the same directory. The build rejects stale production function extracts.
- Finite skin contact report: `node webapp/scripts/check-domino-skin-contact.mjs /tmp/domino-skin-contact.json`. This measures each distal thumb/index skin surface against the bounded domino body, independently of the solver's virtual contact diagnostic. Its box approximation does not reproduce rounded bevels; review the mesh images alongside the reported gaps and penetration rather than treating a zero virtual error as visual acceptance.

## Validation

```sh
node --test test/dominoRoyalMotion.node.mjs webapp/src/pages/Games/shared/seatedHumanActors.domino.test.js
node --test test/dominoRoyalHdriCatalog.test.js test/dominoRoyalMatchmaking.test.js
```

The focused motion/rig checks include the actual RPM skeleton at all four seats, placement and face-down stock paths, fixed roots/hips/tile transforms, hand conservation, audio event timing, cancellation, and online replay. Additional checks cover palm direction independent of tile printing, outer rack edges, continuous wrist frames, separated shuffle lanes, and a planted release phase. Existing Domino and shared Snake regression suites also run against the changes.

The existing seat-to-table geometry requires forward reach on distant actions. Retargeting turns the upper torso toward the reaching hand and balances forward lean with the available arm reach, preventing the support shoulder from folding directly over its stationary rack hand. Temporary arm extension remains capped at 1.35 for ordinary actions and 1.65 only for the opposite seat reaching the far stock; the next base pose restores bone lengths.

The mesh-render review exposed and drove repairs to inverted palms, backward finger curl, false fingertip contact, crossing shuffle hands, and deep-reach head clearance. Centre-table opening pickups still have a fast pre-grip approach; a slower pacing refinement was deferred when the user requested the PR immediately. Full live visual acceptance remains pending: this environment's cloud browser blocked local preview URLs under its URL policy. The offline mesh review and in-chat inspection do not establish full-app rendering and interaction on a physical phone.
