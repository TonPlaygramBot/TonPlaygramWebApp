# Turi materials, contact poses and street behavior

This update keeps the existing Turi GLB, face images, black clothing, UÇK atlas,
skin weights and original Idle/Walk/Run clips. It changes their presentation and
the runtime systems around them; it does not replace the character or city.

## Changes

- Human material preparation preserves source images, UV transforms, alpha and
  authored packed PBR channels. Color and data textures use separate views when
  needed. Anisotropy is bounded by the device capability and an 8× ceiling.
- Weapon contact uses the actual metacarpals to place palms rather than wrist
  joints. Finger curl uses measured anatomical directions. The weapon and both
  grips receive the same recoil offset. Sidearms use a support-grip position;
  long guns are held closer to the shoulder within Turi's measured reach.
- Steering contacts and the basic cabin share wheel radius, rotation axis and
  terrain frame. Seated pelvis alignment and leg IK place feet in the footwell.
  Vehicles without authored pedal sockets still use estimated footwell targets.
- The character picker, campaign and City Stories reuse GLB source bytes while
  parsing independent skeletons/materials. The cache is limited to 24 MiB, two
  entries and two minutes. Cancellation of one caller cannot cancel another;
  invalid downloads and parse failures can be retried.
- Selected character loading supports local Draco, KTX2 and Meshopt decoders.
  The unselected generic operator and shared NPC sources no longer block or
  compete with the selected character during initial entry. Visible NPC sources
  take priority over fallback preloading, with two concurrent NPC requests.
- Pedestrians use continuous vehicle-crossing prediction, detour around parked
  and wrecked vehicles, recheck changing vehicle obstacles, and flee from the
  observed gunshot origin. Tracking a moving attacker requires line of sight.

## Assets and licensing

No new third-party model, paid pack, procedural replacement or generated texture
is added. Original GLTF/GLB assets and their individual credits remain intact.
The existing animation adapter continues using the bundled Quaternius Universal
Animation Library Standard CC0 motion samples where native clips are absent.
See `webapp/src/games/tiranastreets/street-career/data/HUMANOID-MOTIONS-LICENSE.md`.
CC0 for those samples does not change the licences of any character or weapon.

Sources reviewed:

- https://quaternius.itch.io/universal-animation-library
- https://threejs.org/manual/pages/color-management.html
- https://threejs.org/docs/pages/Texture.html

## Reproducible checks

From the repository root, with root and webapp dependencies installed:

```sh
node webapp/node_modules/typescript/bin/tsc -p webapp/tsconfig.tirana-gameplay.json
node --test --test-concurrency=1 test/tiranaPrecisionContacts.test.mjs test/tiranaPlayerByteCache.test.mjs test/tiranaPedestrianAwareness.test.mjs test/tiranaCityStoriesPlayer.test.mjs test/tiranaHumanQuality.test.mjs test/tiranaHumanAnimation.test.mjs test/tiranaUploadedPlayerRigs.test.mjs test/tiranaPlayerVehicleUpgrade.test.mjs test/tiranaHeldWeaponLoading.test.mjs test/tiranaPredictiveTraffic.test.mjs test/tiranaCrowdResponse.test.mjs test/tiranaPedestrianDefense.test.mjs test/tiranaPedestrianDefenseGameplay.test.mjs test/tiranaLobbyLoading.test.mjs test/tiranaVisibilityBudget.test.cjs test/tiranaDriverBattlefield.test.mjs
```

The actual `turi.glb` is parsed for contact, material and lifecycle tests. These
tests measure configured palm/socket targets and finite joint transforms; they
do not establish visual skin contact with every weapon's mesh or every imported
vehicle interior.

For the actual portrait game in a browser-enabled environment, start Vite in
`webapp`, then run:

```sh
TIRANA_BASE_URL=http://127.0.0.1:5178 BROWSER_PATH=/usr/bin/chromium node scripts/verify-tirana-gameplay.mjs
```

The script selects Turi, enters Street Career, checks the real WebGL canvas,
switches weapon/camera, exercises movement and pause/resume, and writes screenshots
and a JSON report. Browser launch failure is a failed check, never a pass.

## Validation limits and remaining work

The production Vite gameplay entry bundles successfully with actual dependencies
(2,075 modules). Its existing city/map data chunk is approximately 15.19 MB before
gzip / 7.70 MB gzip. Character-transfer reuse is verified, but geography streaming
remains a separate startup bottleneck. No measured startup-speed or FPS percentage
is claimed.

WebGL rendering could not be verified in this workspace: Chromium failed before
page creation with `socket() Operation not permitted`. Shared Chrome could not
reach local Vite, and further inspection was rejected by browser security policy.
There is no verified visual screenshot, interactive chat preview or phone FPS
measurement from this run. Review aim/reload extremes, all imported wheel hubs,
pedal contact, and Android/iOS portrait rendering on a browser-enabled device.

Older unrelated tests also fail on unchanged baseline code: the legacy runtime
mock harness omits newer dependencies/actor fields (24 failures reproduced with
baseline sources), a mobile cabin test expects an older Benz eye socket, and an
infrastructure test expects at least 100 city bicycles. These are not represented
as passing or repaired by this update.
