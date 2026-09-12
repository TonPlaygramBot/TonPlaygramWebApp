# Tirana Streets gameplay overhaul

This change connects the requested career, aircraft, destruction, police and battlefield systems to the active React/Three.js game. It is prepared as a draft for gameplay review against `main`.

## Playable behavior

- Career starts in free roam with the Glock selected. The existing nine jobs form branching contact chains, with helicopter rescue and fighter patrol added. Old completed jobs, inventory and cash remain readable. Flight checkpoints save the aircraft, pilot, altitude and ammunition.
- Both aircraft can be boarded, flown, landed and rearmed. The helicopter uses its rooftop access; the fighter spawns at a clear nearby apron. The map labels both access points. Aircraft use assisted flight for portrait controls. UP climbs, DOWN descends, left stick steers/throttles and MISSILE fires; landing and stopping are required to exit.
- Missiles sweep their complete travel segment against collision, apply distance/cover-aware blast damage and open bounded local facade breaches. Cars ignite before becoming wrecks, can cause a secondary explosion and retain collision. Wreck materials darken while preserving the original texture maps.
- Shared effects add muzzle flashes, moving tracers, ejected cases, debris, smoke, flames and short explosion lights. Instance pools, eight active missiles, twelve facade breaches and two dynamic explosion lights bound effect costs. This is local facade destruction; complete building structural collapse is not implemented.
- Emergency vehicles transfer from their AI simulation to player ownership once, with occupants dismounting. Bike/van door distances use actual vehicle bounds. Coordinated police use pursuit, interception, roadblock and last-seen search goals, with flanking and regrouping on foot.
- Career running increases to 6.2 m/s and sprinting to 10 m/s. Sedan/sports/bike/armored/bus caps become 110/155/130/90/75 km/h, with capped reverse and brakes. Battlefield on-foot run/sprint increase to 5.2/8.5 m/s in solo and server-authoritative play.
- Solo battlefield offers last operator standing, district sweep, hold, intel extraction and three-wave survival, plus six saved district operations. Enemies spawn in the selected district, see only unobstructed targets, fight each other in last stand, reload, use cover and move toward the shrinking zone. Mission beacons and extraction points appear in the world and tactical map.
- New online battlefield matches use one life and no respawn. The sole survivor wins; an unresolved timeout refunds. Existing deathmatch callers retain their legacy default behavior. Existing stake authorization and settlement code is unchanged.
- Driving shows a CAMERA button in career and solo battlefield, switching cockpit/chase views. Solo battlefield has a mission transport with independent gas, reverse and brake pointers. Online battlefield remains on foot; networked vehicles were not added.
- Career controls keep movement and sprint at the left thumb, combat/pedals at the right, and camera/navigation above. Mode changes are in the operation board, avoiding floating career buttons over live combat.

## Preview and review

`webapp/tirana-gameplay-review.html` mounts the actual game without the account/lobby wrapper. With webapp dependencies and generated game assets installed, run `npm run dev --prefix webapp` and open `/tirana-gameplay-review.html`. Add `?activity=street-career` for career directly.

The review entry uses the same game modules, city and aircraft assets as production. The existing import script verified all 26 original asset hashes, including the helicopter and F-15. Assets are still packaged by the existing prebuild process.

Browser navigation to the local development preview was blocked with `ERR_BLOCKED_BY_CLIENT`. No visual playthrough, GPU shader compilation, physical-phone frame-rate claim or screenshot is represented as verified. The production Vite review bundle compiled successfully; public asset copying was disabled for this local compilation. The city bundle still carries a large existing data payload (approximately 15 MB minified / 9.3 MB gzip).

## Verification

The new domain and presentation tests cover independent mission unlocks, all district spawn locations, bot targeting/reloading, one-life survival/refunds, police interception/search, emergency vehicle ownership, single-transition vehicle explosions, swept missiles, partial collision breaches, aircraft boarding/missiles/checkpoint restore, driving brakes, distinct camera positions, independent pedal pointers and effect cleanup.

The final focused run passed 79 tests, including all 15 new domain/presentation tests and existing full-body, pointer-ownership, campaign and checkpoint regressions. The two Socket.IO integration tests also passed, covering seat ownership, connection replacement, forfeits, refunds and settlement retries with a test ledger. The updated movement anti-cheat test and occupied-wreck regression passed separately. The new tests are included in the Tirana street-career workflow.

The repository-wide `tsc --noEmit` currently reports 318 existing declaration/implicit-any diagnostics; the final run reports no new diagnostics in the new gameplay modules. Broader legacy tests also have stale expectations for map extent, total weapon/population counts and racing fleet count. These unrelated assertions have not been weakened. The movement anti-cheat bound and career catalog expectations were updated to the explicitly requested new movement speed and mission catalog.

Before release, play both modes at 390×844 and 320×640, including rapid camera switching, simultaneous pedal inputs, mission retries during flight, repeated vehicle explosions, close-wall missile impacts, and online last-survivor settlement. Check graphics on an actual phone and adjust the existing Battery setting if required.
