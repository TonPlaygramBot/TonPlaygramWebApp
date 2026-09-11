# Albanian Forces integration

Tirana Streets now uses the supplied Albanian Forces v2 models for nearby law
enforcement units in the normal game and Street Career. The shared simulation
assigns `forceVehicle` and `forceCharacter` IDs and carries them in public
snapshots. Existing unit kinds, wanted mechanics, collision and driving remain
the source of gameplay behavior.

| Response | Vehicle selection | Uniform |
| --- | --- | --- |
| Routine city patrol | Patrol Impreza | Patrol |
| One star | Patrol Focus, traffic motorcycle, Patrol Impreza, police Sprinter | Patrol / traffic |
| Two stars | Shqiponja compact / motorcycle | Shqiponja |
| Three stars | FNSH Sprinter | FNSH |
| Four stars | RENEA armored vehicle | RENEA |
| Five stars | RENEA armored vehicle | Army |

One-star/two-star selections rotate by dispatch slot and elapsed half-minute;
all choices are deterministic. Five-star vehicles use the armored model because
the pack has an army soldier but no dedicated army vehicle. Legacy saves and
older server snapshots resolve police to the Focus and military to the armored
vehicle, with corresponding default uniforms.

`AlbanianForcesVisuals.ts` owns demand loading, near-distance selection, private
character skeletons, Idle/Walk blending, vehicle wheel/steering pivots and private
flashing-lens materials. It shares the existing weapon-holder system. Up to two
downloads run at once; at most eight source templates are cached. Distance and
count limits fall back to the existing low-detail actors, including on failure.
City startup does not wait for the new pack. Street Career routes enforcement
NPCs through this same renderer, leaving the civilian cast intact.

The pack contains Idle and Walk, not shooting/entry/riding animation libraries.
Running reuses Walk at a faster rate. This change adds no new drivable-vehicle
ownership or character-selection flow. Vehicles retain their physical metre
scale; no browser or phone frame-rate claim is made.

## Verification

- Full webapp production build passed.
- The new visual module passed focused strict TypeScript checking.
- All 14 optimized GLBs passed Khronos glTF Validator with zero errors.
- Seven new tests passed: pack hashes/rigs/pivots, full dispatch coverage, actual
  simulation snapshots, legacy roles, real vehicle loading/orientation/wheels,
  independent animated officer skeletons, and failed/late-load cleanup.
- The existing City Life + Street Career suites report 40 passes and two failures
  on both the modified tree and the original `b080689` main source: stale traffic
  count (`23` expected, `31` actual), and a source-text online-guard assertion.
- Browser/phone visual testing was unavailable in this session.

```sh
node --test test/tiranaAlbanianForces.test.mjs test/tiranaAlbanianForcesRuntime.test.mjs
cd webapp
npm run build
```
