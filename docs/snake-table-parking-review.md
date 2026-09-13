# Snake table and parked weapons

Based on main after #25918 and #25919.

The Snake table is 12% lower and 10% narrower. Chair spacing is independent of
table size; each seat now has the same clearance as the bottom seat. The seated
leg chains turn outward to keep the thighs beside the short tabletop, preserving
bone lengths and foot heights. Camera distance retains its previous calibration.

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

- 89 Snake tests: four table outlines, two/three/four players, three real imported
  firearm meshes, catalog fallbacks, real reserve tokens, asynchronous model
  replacement, repeat-layout stability, and existing pickup/throw/grip/game flow.
- TypeScript checking for changed interaction, parking and preview modules.
- Vite production build.
- Production board/table geometry and real skinned character geometry sampled
  and rendered for idle, pickup, lift, result, next-player pickup, and aiming.
  The default character clears the tabletop envelope; dice and both firearm
  contacts remain within the 0.003 world-unit tolerance. All four portrait result
  sightlines are clear.

Reproduce the interactive review with
`node scripts/build-snake-interaction-preview.mjs /workspace/snake-table-parking.html`
and geometry checks with `node scripts/check-snake-interaction-preview.mjs`.
`scripts/snake-review/render.py` rasterizes the resulting frame JSON files.

The React/Three.js review uses the production table geometry, board and animation
logic, simplified chairs/materials, and a separate overview camera for inspecting
table clearance. Dice playback uses the production portrait camera. The embedded
review includes only the ammunition models used by its three firearm choices.

Live Telegram/WebGL testing on a physical phone was not available. CPU geometry
renders do not establish device frame rate, shadows, or every imported avatar and
table variant's final appearance; those remain part of device acceptance.
