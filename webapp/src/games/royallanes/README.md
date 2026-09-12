# Royal Lanes bowling

Royal Lanes adds a dedicated entry and lobby to TonPlaygram’s games page. Players can start a free ten-frame AI match or enter a two-player TPG match with equal stakes, quick matching or a private code. Existing bowling GLBs and high-resolution maps are preserved; the existing pool-royale/readyplayer.me.glb supplies the fully visible local bowler, and the bundled table-tennis male/female athletes supply the opponent and neighbouring lanes. Pin-deck kickbacks move outside the gutters to allow corner spares.

## Player flow

- `/games/royallanes/lobby`: native RoomSelector and runSimpleOnlineFlow, with the shared account registration, seating, ready confirmation and gameStart flow.
- `/games/royallanes?mode=ai`: local worker physics against Casual, Club or Pro AI.
- `/games/royallanes?mode=online&tableId=...`: join the authoritative server match. The native Back control returns to the lobby; leaving an active online match can forfeit it.

There are no gameplay buttons or sliders. Horizontal drag aims in the same visible direction; upward swipe bowls, with power from swipe length/speed and hook from late curvature. Pointer cancellation and multi-touch cannot release a ball. Two-finger tap pauses AI only. Turns, pin racks, results and bonus balls advance automatically. The camera shows the full bowler during setup, follows the released ball, holds on pinfall and returns for the next turn. Portrait framing includes a neighbouring human; wide framing includes both NPC lanes.

## Architecture

Game.tsx handles read-only HUD and lifecycle. touch.ts owns gestures. scene.ts renders GLB equipment and authoritative replay poses; camera.ts shares the full-body and ball-follow sequence with the preview. bowlers.ts clones the existing rig and poses actual limbs and fingers. audio.ts synthesizes collision-timed pin resonance, speed-dependent rolling, footsteps and release sounds. backgroundLanes.ts runs two staggered NPC lanes using one separate simulation worker and the same physics, with genuine spare racks and a 30 Hz animation budget. localSession.ts and onlineSession.ts implement a shared session contract. Browser simulation.worker.ts and the bot worker pool both use shared/physicsCore.mjs, replay.mjs, match.mjs and scoring.mjs.

The browser adapter (shared/physics.mjs) and bot worker each import their own installed cannon-es package and pass the same solver into simulateRoll. cannon-es is a production dependency of both packages. Shared match rules and replay utilities do not import either runtime's dependencies, so the bot can start and simulate online matches without webapp/node_modules or root node_modules. Keep both runtimes on the same Cannon version when upgrading.

The physical solver runs at 1/180 second. Ball/pin transforms are sampled at 24 Hz for interpolated playback. Online clients submit only bounded shot intent plus a turn ID and idempotency ID. They never submit pinfall, scores, winners or stake changes. The backend computes physical trajectories in a bounded worker pool, owns turn order and scores, and broadcasts the same replay to both players. A whole frame, including a spare attempt, belongs to one player before the other bowls.

## TPG lifecycle

The same shared seatTable and confirmReady gates reserve the two TPG stakes transactionally only when the complete roster is ready. BowlingMatch persists the reservation; createBowlingStakeService uses the existing kart stake implementation with bowling ledger keys, two players and a 45-minute reservation lifetime. Existing game defaults stay at ten minutes. Payout, tie refund, failure refund and expired-reservation recovery are idempotent and release account locks.

A match waits up to 90 seconds for both clients to load, then starts after three seconds. Each online delivery has 35 seconds; two consecutive missed turns forfeit. Rejoining the same account revokes the previous game socket. A suspended or disconnected client has a 30-second grace period. Both players leaving, startup failure or a 35-minute match limit refunds the match. Settlement failures retry while the room remains retained. Restart recovery refunds expired persisted reservations; it does not recreate an in-progress lane after a process restart.

## Verification

Run from the repository root:

```sh
node --test bot/tests/bowlingDeployment.test.js
node --test test/royalLanes.test.mjs test/royalLanesOnline.test.mjs test/royalLanesStake.test.mjs test/royalLanesTouch.test.mjs test/royalLanesBowlers.test.mjs test/royalLanesBackground.test.mjs test/royalLanesCamera.test.mjs test/kartStake.test.mjs test/blackwaterStake.test.mjs
npm test -- --runInBand test/onlineGamePolicy.test.js test/simpleOnlineFlow.test.js
npm --prefix webapp run build
```

The deployment test imports the bowling service, creates a match and runs real collision workers in a temporary directory containing only the bot's declared Cannon dependency, with no frontend or root dependencies. Other tests exercise physical worker pinfall and reachable corner spares; score and frame edge cases; real Socket.IO identity, replay, timing and reconnect protocol; a complete tied match and exactly-once settlement; transaction rollback/refund/recovery with the repository’s database double; visible gesture directions and cancellation; and actual GLB skeleton, eye height, independent poses, grounded feet and delivery release.

A real MongoDB replica-set transaction run and browser GPU/physical-phone performance are not verified here. The local free-AI preview runs the same free AI renderer and simulation; TPG online play requires the TonPlaygram frontend and bot changes together.

## Human bowling update

The shared approach duration is now 2.2 seconds. Four alternating steps drive pushaway, backswing, a forward bend and sliding release, then follow-through, result reaction and return. The release hand reaches the physics launch centre without a post-release position blend. The renderer reads the replay's actual release timestamp, including reconnects. Quaternius body/clothing skeletons are synchronized, and each lane uses world-space IK with lane-local ball sockets.

Character materials preserve their original scalar/array form so ungrouped meshes render. The lane environment and colliders are 20% wider via shared constants; pins, balls and people retain their dimensions.

See [the implementation and validation notes](../../../../docs/royal-lanes-human-bowling.md).
