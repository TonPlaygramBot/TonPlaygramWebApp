# Royal Lanes human bowling

The main game retains its React/TypeScript/Three.js architecture, portrait gestures and authoritative online scoring, with a full-body camera that follows each released ball. No character binaries or external model downloads were added.

| Existing character | Source | Use |
| --- | --- | --- |
| Ready Player Me club bowler | `webapp/public/assets/pool-royale/readyplayer.me.glb` | Local player; fallback if athlete assets fail |
| Adrian, male athlete | `webapp/public/assets/table-tennis/athlete-male.glb` | Neighbouring bowler |
| Maya, female athlete | `webapp/public/assets/table-tennis/athlete-female.glb` | Opponent and independently skinned neighbouring bowler |

The athletes carry the existing Quaternius CC0 provenance; the club bowler retains the app's existing Ready Player Me permission. Existing source assets, textures and licences are unchanged. The bowling offline pack now includes these three shared files.

## Behavior loop

Ready → pushaway → alternating approach steps → pendulum backswing → forward bend and slide → hand release → follow-through → watch pins → result reaction → return → ready.

The server and local session share a 2.2-second approach. Rendering uses each replay's `releaseAt - startsAt`, so reconnects and differing frame rates retain the same release event. Cubic arm interpolation carries motion through the pose keys. Feet alternate support; leg/arm IK operates on actual skeletal limbs. The release socket matches the ball's initial physics position instead of blending between two disconnected origins.

Each cloned character owns its skeleton and materials. Canonical bone names adapt RPM and Quaternius rigs; duplicate athlete clothing skeletons follow their matching body bones. Neighbouring lane translations are applied once: limb targets are world coordinates, while exported hand and eye sockets are relative to the lane parent.

Two neighbouring lanes have staggered waiting periods, differing AI shots, physical ball/pin replays, spare attempts, reactions and returns. A single extra worker handles their simulation, with at most one outstanding request per lane. NPC animation runs at up to 30 Hz, pauses with the AI match/hidden document, and cleans up on exit. These lanes do not submit online actions or affect match scores.

## Visible characters, camera and lane width

Character material cloning preserves single materials as single materials. Previously, converting them to arrays left GLB parts with no geometry groups unable to submit draw calls, hiding the humans. The main player now uses the complete visible rig, including the head.

The shared `BowlingCamera` frames the full player and one neighbouring bowler on portrait screens; wider screens include both neighbouring lanes. After release it eases behind the displayed replay ball, follows its lateral motion, stops before the pin deck, holds the pinfall view, and returns before the next delivery. The same camera runs in the game and inline preview. Reconnects use the authoritative release time.

Lanes are 20% wider: 1.2648 m of playable wood and 2.94 m between lane centres. Shared constants align the horizontally scaled alley, board lines, foul lines, reflection, NPC lanes, gutters, kickbacks and both physics runtimes. Character proportions, ball radius and pin rack dimensions stay at their original sizes. This intentionally gives edge shots more playable space.

## Shots and sound

Mostly horizontal strokes remain aim gestures. Release velocity uses the latest 140 ms of the stroke, excluding a stationary hold. A gesture must begin during an available turn; cancellation and multi-touch do not submit shots. A synchronous submission guard prevents duplicate throws during React state updates. Screen-right stays right; upward swipes bowl.

The shared collision solver adds bounded, finite impact events to its replay. Audio uses those timestamps and strengths, damped pin resonances, filtered rolling noise, release/footstep sounds, a short room response and stereo placement. At most three rolling voices exist. Pause, backgrounding, mute and disposal stop/suspend playback. Changing the sound preference no longer recreates the match. These are procedural sounds, not recorded bowling samples.

## Validation and preview

- Material/draw-call checks cover all three original human rigs. Actual deformed vertices and alley raycasts verify player/neighbour framing at 320/844, 390/844, 390/488 and 768/600 aspect ratios. Centre and gutter replays exercise camera travel/return at 30/60/120 FPS; surface/collider checks verify the wider edges and gutter classification. These are CPU checks, not GPU screenshots.
- Actual GLB skeleton checks run three repeated deliveries per rig at 30, 60 and 120 FPS: 27 complete deliveries. They check grounded feet, finite transforms, a release gap below 1 cm, plausible hip height and independent clothing/body alignment.
- Neighbour tests run 130 seconds of game time, checking repeated cycles, actual spare racks, world-space ball attachment on translated lanes, stereo sides and worker disposal.
- Existing rules, real collision workers, browser/backend replay equality, Socket.IO authority, timed turns, reconnects, TPG settlement and isolated backend deployment tests are retained. Timing checks now use the shared approach constant.
- TypeScript checks cover the main game and React preview. The frontend production bundle compiles. The standard build's public-asset copy exhausted this environment's disk, so final compilation uses Vite's `copyPublicDir: false`; the original public assets remain in the source checkout.
- Browser access to local HTTP and local files is blocked in this environment. GPU appearance, audible quality and physical-phone performance have not been visually/audibly verified. The preview is provided for review, not as evidence of that verification.

`webapp/royal-lanes-preview.html` runs the actual free-AI game; `royal-lanes-portrait.html` embeds it at 390 × 844 for local development. `node scripts/build-royal-lanes-preview.mjs` builds the in-chat motion viewer with the same bowler controller, ball-follow camera, wider lane constants, gestures, audio and physics, the two athlete rigs, and the original alley/pin geometry. The viewer uses reduced texture resolution/vertex precision and a simpler ball material to stay below the inline size limit; it is not the complete scoring/network interface.

Ship frontend and backend together for consistent approach timing, wider lane colliders and collision audio events. Stake handling, scoring rules, ball/pin dimensions and material friction/restitution are unchanged; the wider lane boundaries affect edge trajectories and pinfall.
