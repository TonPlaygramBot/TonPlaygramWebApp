# Domino Royal character motion

The board and the original one-to-seven-tile rack anchors stay fixed. Both hands target the visible outer rack surfaces. Plays and stock draws use one contact/lift/carry/release timeline, and pass audio fires at the right-hand tabletop contact.

The opening displays all 28 pieces face-down, washes them across the cloth using planar palm impulses and conservative collision footprints, then draws the randomized authoritative deal one tile at a time. Online clients replay the same hand manifest. Input stays locked through motion, duplicate revisions do not replay actions, and newer snapshots wait for release. Appearance changes also wait for motion to finish.

Human racks with eight or more tiles scale by `7 / count` inside the original seven-tile span. Drawing and playing interpolate between rack and board scales.

## Review

- Production scene: `/domino-royal-review.html?players=2&width=390` (also 4 players; 320/390/430px).
- Isolated React/Three.js/TypeScript motion preview: `node webapp/scripts/build-domino-motion-preview.mjs`. It embeds the shipped textured avatar and reuses the production rig and extracted motion/layout helpers. Its fitted camera and simplified furniture are review-only.

## Validation

```sh
node --test test/dominoRoyalMotion.node.mjs webapp/src/pages/Games/shared/seatedHumanActors.domino.test.js
node --test test/dominoRoyalHdriCatalog.test.js test/dominoRoyalMatchmaking.test.js
```

The 26 motion/rig checks include the actual RPM skeleton at all four seats, placement and face-down stock paths, fixed roots/hips/tile transforms, hand conservation, audio event timing, cancellation, and online replay. Four existing Domino Vitest suites pass (14 checks). The app production build and the dedicated review entry build pass.

The existing seat-to-table geometry requires a deep forward waist lean on distant actions. Arm retargeting uses the minimum extension needed, capped at 1.35 for ordinary actions and 1.65 only for the opposite seat reaching the far stock; the next base pose restores bone lengths. The measured far-stock maximum is 1.6341 and maximum tested fingertip residual is 0.0004 world units. Legacy callers keep their original default pose/arm behavior.

Full live visual acceptance is still pending: this environment's cloud browser blocked both local preview URLs and the synchronized HTML file under its URL policy. Automated geometry and UI checks do not establish the final appearance on a phone.
