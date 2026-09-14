# Racing Royal: smaller karts and passing clearance

Prepared from `main` at `0a5f9e46021719c516e6346c3b27af7f44dc900e`.

## Implemented in this draft

The eight kart models use a 2.0 m target length instead of 2.7 m: a 25.9% linear
reduction. The shared browser/server simulation uses a 2.0 m body length and
approximately 1.274 m body width. The asset adapter scales uniformly; the existing
LOD fit, wheel radius and driver-eye transform use that same fit. Attached drivers
remain under the vehicle body. Collection and military vehicle dimensions,
Tirana map coordinates and building dimensions are unchanged.

AI passing room now depends on the kart footprint rather than subtracting 2.4 m
from each road half-width. Default opposing lane offsets are 0.9 m; body-aware
passing separation avoids treating a clearly adjacent kart as a blocker. The
existing steering sign, speed tuning, braking, progression and contact responses
are retained.

The cached course builder attempts a 4.8 m minimum race ribbon on every listed
circuit. This is an event-only shoulder extension, not a change to source OSM
road widths. Candidate segments use the actual joined corner geometry and a
continuous conservative building/water clearance check, including the space
between samples and room for barriers. Unsafe widening is reverted. Existing
wider roads are not narrowed. **A bottleneck is reported, not silently called
fixed:** `track.passingAudit.unresolved` retains its sample coordinates and width.
Such sections still need route-specific review or rerouting before this request
can be considered complete.

Race exclusions are passed to the previously unmasked urban furniture, mapped
park furnishings, trade details and fuel-brand layers. Whole furniture footprints
are excluded before instancing or streaming: cafe clusters (4 m), individual
river bins (0.35 m), benches (1.1 m) and playgrounds (3.2 m). Fountain geometry is
omitted in race mode when its conservative full-object envelope conflicts with
the ribbon; it is not merely hidden for one update. Bin instance capacity now
includes the additional river bins. Free Roam receives no race mask and retains
its scenery. Existing tree, street-detail and other track-aware layers continue
to use the final race ribbon.

## Verification actually performed

- `node --test test/racingClearance.test.mjs`: 14 focused tests passed. These run
  the new dimensions/clearance helpers and the unchanged production joined-edge
  geometry on synthetic courses, not the full Tirana map.
- Changed JavaScript passes Node syntax checking; changed TypeScript passes
  TypeScript syntax/transpilation checking. This is not a complete type check.
- Original edited files were matched against their baseline Git blob hashes
  before applying the changes.

## Required before merging

Run in the complete repository with its existing dependencies:

```sh
node --test test/racingClearance.test.mjs
node tools/audit-racing-clearance.mjs racing-clearance-audit.json
node tools/verify-racing-rural.mjs
```

The all-track audit enumerates every `TRACKS` entry, records narrow sections and
uncertified building/water envelopes, and exits nonzero when any circuit needs
inspection. Its conservative warnings can include safe bridges: review them;
do not weaken clearance checks just to turn the report green. This audit has
**not** been executed on the complete production map in this session. No
per-track clearance totals or all-tracks-passed claim is made.

The complete application build/type check, existing racing regression suites,
full-lap AI races, actual GLB bounding-box inspection, streamed/dynamic scenery
inspection, multiplayer comparison and portrait phone/WebGL testing have not
been performed here. Check two karts side by side at every narrow bend, bridge,
start grid, shore section and join, and let streamed scenery and pedestrians
update before approving a circuit. A static building/water check is not proof
that every rendered tree, human or decorative mesh is clear.

Keep this change as a draft until those checks pass. No change is merged to main
or deployed by this patch. When approved, ship the browser and authoritative
server together so their kart footprints and course widths match. Auth,
balances, staking, rewards, settlement and anti-cheat behavior are not changed.
