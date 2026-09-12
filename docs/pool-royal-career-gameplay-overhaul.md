# Pool Royal career and gameplay overhaul

## What changes

- A portrait-friendly career calendar spans five seasons and 100 appointments: coaching, friendlies, league fixtures, tournaments and featured opponents. Ranking points, titles and completed fixtures come from saved results. Existing career stage IDs remain compatible.
- The training centre offers 50 coached drills in five tiers, covering potting, stun, draw, follow, left/right english, escapes and position play. Completion checks the shot allowance, final cue-ball zone, requested spin and scratches. Standalone training saves best stars and remains separate from career unlocks. Free practice remains available.
- Six original fictional snooker characters use source-generated, articulated Three.js geometry, waistcoats and finger joints. Career opponents have different aiming accuracy and safety preferences. The character source and generated geometry have an MIT license in `webapp/src/pages/Games/shared/OPEN_SNOOKER_PLAYERS_LICENSE.txt`; no professional athlete likeness or unverified third-party model is included.
- Cue delivery accelerates into exact rendered tip contact, launches the shot once, and follows through. A skipped render frame still displays contact before continuing. Ball orientation follows simulated angular velocity, including sliding and reverse draw rotation. Centre strikes no longer receive artificial topspin. Cloth impulses cannot reverse slip within one substep.
- The bridge placement helper now runs after cue alignment, keeps its channel along the shaft, retreats from nearby balls and uses the existing mechanical rest for crowded positions. Palm height and finger pose follow the shot.
- Spin selection tests the physical tip approach against nearby balls. Camera position and broad rectangular proximity limits no longer reject clear spin directions. Physics receives the selected strength without a second deadzone pass.
- Cushions lose less tangential speed, with a small restitution increase for table presets below the cap. Restitution is capped at 0.995 to prevent energy gain from presets above 1.
- Ball-in-hand requires a valid placement before firing. Invalid crowded candidates are rejected; object-ball clearance, pocket mouths, table bounds and break placement regions are checked. Position changes reset velocity, spin and lift.
- The white head string and penalty spot use the cloth's exact plane and remain visible after an external table finishes loading. The unsupported separate marking lift is removed.
- Racks use diameter-based hexagonal spacing. Numbered racks place the 8/9 in the centre; 8-ball back corners contain opposite groups. The apex sits on the foot spot. Training layouts also have pairwise-clearance regression coverage.

## Rules and compatibility

Explicit `variant=8ball` now opens American 8-ball instead of silently falling back to UK rules. Existing UK choices retain their house-rule behavior. The selected breaker is synchronized with serialized rules. American break fouls retain a headstring placement region; mixed numeric rail IDs cannot count a ball twice. An 8 on the American break is spotted using the existing spotter. The existing UK `blackOnBreak: re-rack` option now restores the rack for the same breaker.

The American break checks use the [WPA rules](https://wpapool.com/wp-content/uploads/2026/01/2026.01.02-WPA-Rules.pdf) as a reference. This remains an implementation of the game's house policies: automatic spotting/placement is used, rather than presenting every referee option. This change does not claim full tournament rule coverage (for example, the 9-ball push-out and three-point-break options are outside this change).

## Verification

Run the focused tests from the repository root:

```sh
node --test test/poolRoyalGameplay.node.mjs test/poolRoyalHumanPlayers.node.mjs test/poolRoyalShotReview.node.mjs
node node_modules/jest/bin/jest.js --runInBand test/poolRoyaleRules.test.ts test/poolUk8Ball.test.js test/poolRoyaleCueStrokeTimeline.test.js test/poolRoyaleCareerProgress.test.js test/poolRoyaleTrainingProgress.test.js test/poolRoyaleSpinController.test.js test/poolRoyaleShotLifecycle.test.js test/poolRoyaleShotState.test.js
```

The game and career browser bundles compile; the new TypeScript components and shared player helpers type-check. A focused undefined-reference lint check also passes.

The local browser preview was blocked by this work environment (`ERR_BLOCKED_BY_CLIENT`). Mobile WebGL appearance and touch feel still need device review. The broader pre-existing `test:pool-players` command also includes a Snooker Royal source-pattern assertion that already fails against the unmodified Snooker source; the focused Pool Royal player/shot tests pass.

Review on a phone in portrait at `/games/poolroyale/career` and `/games/poolroyale/career?tab=training`. Check a low centre strike, draw/follow, both sidespin directions, a crowded bridge, a break scratch, a UK black-on-break re-rack, and the head string/spot after an external table loads. Progress remains device-local, as in the existing game.
