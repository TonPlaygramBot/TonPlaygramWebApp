# Snake table and parked weapons

Updated from main after #25923 to restore the original seated legs.

The Snake table retains its 10% narrower footprint. The original seated leg pose
is restored: there is no outward leg rotation and no character or leg resizing.
The tabletop surface is now 0.835 world units high, with its edge thickness at
40% of the original profile. Its lowest underside is about 0.745, leaving roughly
0.030–0.037 clearance above the tested character's thighs under the octagon.
The front nameplate fits inside the thin fascia instead of hanging into leg space.
Chair spacing remains independent of table size; each seat has the same clearance.

The procedural Snake table has a flush cloth/wood surface and its nameplate is
on the front fascia. Other games retain the existing table defaults. Imported
tables use the new target dimensions and a conservative directional footprint.

Weapon parking measures visible geometry, finds its flattest orientation, and
places its lowest point 0.002 world units above the surface. Slots reserve the
board platform, individual reserve tokens, every player's dice landing area, and
other weapons, with 0.035 world units between footprints. The search preserves
full size when possible, then fits oversized models uniformly. The narrow hexagon
can require a rifle to use 75% of its nominal display size to preserve the dice lane. It searches the
nearest slots first and never accumulates scaling across updates. Both firearms
and vehicles are flattened and placed again after their imported asset arrives.
Table metadata stays live when an imported table replaces the procedural one.

## Verification

- 90 Snake tests, including original leg-pose/size preservation: four table outlines, two/three/four players, three real imported
  firearm meshes, catalog fallbacks, real reserve tokens, asynchronous model
  replacement, repeat-layout stability, and existing pickup/throw/grip/game flow.
- TypeScript checking for changed interaction, parking and preview modules.
- Vite production build.
- Production board/table geometry and real skinned character geometry sampled
  and rendered for idle, pickup, lift, result, next-player pickup, and aiming.
  The default character’s thighs remain beneath the tabletop with a small underside gap; dice and both firearm
  contacts remain within the 0.003 world-unit tolerance. All four portrait result
  sightlines are clear.

Reproduce the interactive review with
`node scripts/build-snake-interaction-preview.mjs /workspace/snake-thigh-clearance.html`
and geometry checks with `node scripts/check-snake-interaction-preview.mjs`.
`scripts/snake-review/render.py` rasterizes the resulting frame JSON files.

The React/Three.js review uses the production table geometry, board and animation
logic, simplified chairs/materials, and a separate overview camera for inspecting
table clearance. Dice playback uses the production portrait camera. The embedded
review includes only the ammunition models used by its three firearm choices.

Live Telegram/WebGL testing on a physical phone was not available. CPU geometry
renders do not establish device frame rate, shadows, or every imported avatar and
table variant's final appearance; those remain part of device acceptance.
