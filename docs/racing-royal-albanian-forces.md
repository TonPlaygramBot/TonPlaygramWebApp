# Albanian Forces in Racing Royal

The supplied v2 pack adds eight playable vehicles to the existing nine choices,
and six animated officials beside every circuit. Choose **Albanian Forces** in
the garage vehicle selector, or use the vehicle selector in Kart Career. New IDs
are shared with the authoritative multiplayer server.

| ID | Vehicle |
| --- | --- |
| patrol_hatch | Policia Focus patrol hatchback |
| patrol_sedan | Policia Impreza hatchback (legacy asset ID) |
| shqiponja_compact | Shqiponja Focus response car |
| police_van | Policia Sprinter transport |
| fnsh_armored_van | FNSH Sprinter transport (legacy asset ID) |
| renea_armored_van | RENEA armoured 4×4 |
| traffic_bike | Traffic police touring motorcycle |
| shqiponja_bike | Shqiponja response motorcycle |

Patrol, traffic, Shqiponja, FNSH, RENEA and army characters occupy six trackside
posts clear of buildings and the racing ribbon. They play the supplied Idle clip;
Walk remains in both export tiers. They are decorative officials, with no new
combat AI, character controller, seating animations or collision behavior.

## Rendering and loading

React + TypeScript menus and Three.js rendering remain in place. The adapter
turns the pack's +X forward vehicles to the game's forward direction, preserves
wheel/steering pivots, and fits models to the existing 2.7-unit race length.
Camera height and wheel radius use the same scale. Fixed-step physics and screen
left/right steering remain unchanged. Arcade ratings do not describe real-world
vehicle performance or protection.

Liveries retain their original appearance and hide the kart paint swatches.
Supplied blue emergency lenses flash during racing, with steady lighting in the
garage and under reduced motion. No new siren audio is included. Because supplied
vehicle glass is opaque, new first-person mounts provide elevated bonnet/helmet
views with a clear forward ray, not calibrated cockpit seats.

No new GLB is needed to open the default garage. Vehicles load when selected,
with loading/retry states and race/matchmaking gating. Remote models use lower
detail, with an existing kart visual while loading; failed visual loads do not
stop the simulation and can retry next race. Officials load one at a time when
within 75 units (45 in performance mode), and animate only nearby. Late results,
character skeletons, geometry and textures are disposed when leaving.

The asset directory contains 28 self-contained GLBs: full and lower detail for
all 14 models. Textures use JPEG/PNG at up to 1024px full / 512px LOD. No runtime
decoder or app dependency was added. Officials use LODs; full-detail characters
are available for reuse. Sprinter LODs still contain roughly 70k unique triangles;
phone rendering and frame-rate inspection remain manual.

## Source and licenses

Input: `Albanian-Forces-Asset-Pack.zip`, folder `Albanian-Forces-V2`.
SHA-256: `bdbefa10c06ff5f1dc0fc5384f0424d3657d3050a9106b7fd57894928402e64e`.
The uploaded archive retains editable Blender/source files; the repository keeps
optimized runtime exports, thumbnails and source/license notes.

The pack has mixed CC0, CC-BY, CC-BY-SA and Apache-2.0 terms. Applicable ShareAlike
terms remain on derivatives. In-game credits link to `ATTRIBUTION.md`; `notices/`
preserves supplied upstream headers. The repository MIT license covers the
integration code, not third-party models. `PACK-README.md` records donor fidelity
and legacy-name limitations.

Rebuild exports from the unpacked pack:

```sh
npm ci --prefix webapp/scripts/albanian-forces
node webapp/scripts/albanian-forces/build.mjs /path/to/Albanian-Forces-V2
```

The authoring tools and lockfile are separate from the app. The builder
preserves nodes, skinning and clips; deduplicates/welds geometry; simplifies LODs;
resizes textures; and records unique-mesh triangle counts and sizes in the manifest.

## Validation

```sh
node --test test/racingAlbanianForces.test.mjs test/racingMilitaryVehicles.test.mjs test/racing-precision.test.mjs test/kartRoyale.test.mjs
npm run build --prefix webapp
npx --prefix webapp tsc -p webapp/tsconfig.kart.json --noEmit
```

The tests load real GLB geometry with Three.js, check fitting, forward-camera
clearance, pivots and skeletal animation, and cover asynchronous selection,
retry, deduplication, late-result disposal and placement. Multiplayer uses real
Socket.IO clients and checks all eight new IDs. Embedded texture integrity and
size limits were checked separately. No browser/phone rendering or FPS claim is
made. TypeScript has the same four pre-existing TS7016 errors as the base commit.
