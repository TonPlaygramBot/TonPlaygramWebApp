# Murlan human characters and card handling

This change restores the seven-character roster present on August 4, 2026
(`5ce93489a6ddfc1ec45d8d66f8e6531263f23054`). The roster was still configured on
main, but the human-character feature flag had been disabled on August 31
(`14cfe5c4f3c169517c5a945974668837a7948f46`). The default character now uses the
original RPM GLB already bundled in the repository. Its production mesh,
skeleton, textures, and materials are preserved.

## Behavior

- The human player's cards retain their original size, position, spacing,
  orientation, and selected-card lift from the morning version before PR #25892
  (`5007896fb90fe05c8df85d0a34426b9c93f70939`). A bounded seated lean and arm solve
  bring the supporting hand to those fixed cards without stretching arm bones.
  AI cards retain their compact fan. The right hand picks up the opposite lower
  corner. Ring and little fingers keep a relaxed curl. Finger lookup includes the
  original model's `LeftHandIndex1` / `RightHandIndex1` naming.
- The right hand reaches for the played cards, carries the same visible meshes,
  releases them, and returns. Pairs, bombs, and straights share the pinch while
  carried and spread into their individual table slots after release.
- Pickup blends from the current arm pose, approaches just off the card face,
  brings the index finger to the edge before the thumb closes, and lets the
  middle finger follow for support. The wrist turns after extracting the card.
  The remaining cards keep their original screen transforms.
  During the carry,
  the card keeps its size
  while held; the table's larger reading scale applies only after release.
  A short contact pause, finger opening, and eased return replace the abrupt
  resets. The arm solver preserves bone lengths. The table center is beyond seated arm reach, so cards settle
  from the reachable release point into their table slots; fingers do not remain
  attached all the way to the center of the table.
- Inputs are locked during the action to prevent overlapping moves. Scene
  rerenders retain an existing card transfer and rebuild selection targets.
- AI must include the opening spade. Every remaining player gets a response when
  the trick leader has finished. Shared rules reject duplicate/unowned cards and
  empty-table passes before mutating state.
- Legal move generation enumerates possible combination shapes instead of every
  subset of an 18-card hand. Avatar rebuilds ignore stale asynchronous results.

## Verification

Run from the repository root with Node 24 and webapp dependencies installed:

```sh
npm run test:murlan
cd webapp
npx vite build
```

The 28 targeted tests include 90 seeded complete games with two, three, and four
players, card conservation, opening-card constraints, and parity with exhaustive
combination enumeration. The original avatar's hand/contact math is checked
across four seat rotations and at 30, 60, and 120 fps. Production action tests
check singles, pairs, four-card bombs, and five-card plays, including exact final
table transforms and absence of placeholder meshes.
The additional transition test checks continuity at pickup, release, and return
for both ends of an 18-card fan in every seat.
The player-layout regression tests exercise the production scene update with a
human rig enabled against 76 frozen morning transforms (1, 5, 14, and 18 cards,
selected and unselected). They also check fixed-fan support, reach to every card
in an 18-card hand, pickup continuity, unchanged unplayed cards and bone lengths,
and index-before-thumb closure.

The Vite production build passes. The full asset-download prebuild was not
validated: the environment could not fetch unrelated Tirana assets.

## Visual review

With the development server running, open `/murlan-review.html?portrait=1` for
the production offline arena inside a 390 × 844 portrait frame. It defaults to
four players; use `players=2` for a two-player review.

`node scripts/build-murlan-card-preview.mjs <output-path>` builds an isolated
React/Three.js card-handling review using the production rig/action functions.
Only this inline review downsamples textures. Its closer portrait camera and table staging
are separate from the production arena.

CPU-rendered snapshots of the original skinned avatar were inspected at holding,
gripping, carrying, and release poses. The fixed-layout follow-up also checks
holding, index contact, thumb closure, and lift snapshots. The available browser
could load the app but failed to create a WebGL context,
so the 3D game was not visually played. Before marking this ready for release,
review on a WebGL-capable phone in portrait: initial deal, all four seats,
single and combination pickup/release, selection, passing, and match completion.
Also check a live multiplayer session and the six remote character models.
Those checks remain unverified by this change.
