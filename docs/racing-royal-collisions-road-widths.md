# Racing Royal collision and road-width correction

Free Roam previously collided with buildings and lakes but omitted tree trunks,
roadside ironwork, street furniture, and river channels. Race surfaces also added
six metres to mapped road widths, allowing the course to cover scenery.

## Behavior

- Free Roam indexes the same tree, railing, bridge, lamp, and street-fixture
  registries used by the city renderer. River hazards share the rendered channel
  outline. Swept contacts use the kart's oriented footprint and continue with the
  velocity left after impact, including when reversing or boosting.
- Concrete and trees absorb most head-on momentum. Metal allows more sliding
  along its surface. Impact angle and closing speed govern friction, rebound,
  damage, and bounded chassis rotation. Sound and particles distinguish the
  material. Contact cooldowns prevent repeated damage from one impact; position
  correction always remains active.
- River or lake entry stops the kart, produces a splash, and returns it after
  0.9 seconds to a checked dry road position. Bridge decks remain driveable.
  Recovery cannot award gates, laps, or boost. This retains the game's existing
  recoverable arcade damage model rather than simulating vehicle destruction.
- Courses use source road widths, including narrow rural paths. Rounded joins
  and tapered widths stay inside the joined source road ribbon. The extra
  six-metre widening and six-metre minimum have been removed.
- The complete course footprint excludes spectators, canopy, railings, and
  lamps, including at mitered corners and adjoining sections of the course.
- More humps are distributed along each circuit, with a share on turn
  approaches. Their dimensions fit the local road. Slow crossings work through
  the suspension; faster crossings produce a small ballistic hop. Corner hops
  are smaller, and ordinary humps do not grant nitro.

## Verification

The regression run covered 115 tests: 113 passed. The two failures in
`tiranaStreetDetail.integration.test.mjs` reproduce on unchanged main at
`c060682a1a07a45d5bc8f03d3f77f10ad259542c`: an obsolete source-map hash and an
obsolete scene-adapter text assertion. They are unrelated to these changes.

The 12 new environment tests cover boosted and reverse sweeps, material
responses, repeated/separating contacts, safe water recovery, bridge and island
boundaries, jump clearance, production obstacle registries, source-width course
edges, scenery exclusion, corner humps, and takeoff/landing behavior. Existing
tests also complete full AI races on every circuit and exercise touch controls,
driver articulation, suspension, and deterministic simulation.

The production Racing Royal entry bundles successfully with esbuild. The kart
TypeScript project still reports the same 14 pre-existing missing-declaration
diagnostics as unchanged main; this change adds no diagnostics.

The portable portrait preview uses the production physics, controls, kart, and
driver code with reduced scenery. Build it with:

```sh
node tools/previews/build-racing-manual-preview.mjs /workspace/racing-royal-collisions.html
```

The preview builds below the one-megabyte inline limit. Live browser inspection
was unavailable because the session browser blocked the local preview URL;
visual and device playtesting remains to be performed in the deployed game.
