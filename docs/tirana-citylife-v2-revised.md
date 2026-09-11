# Tirana Streets — latest revised CityLife V2 pack

Target: `TonPlaygramBot/TonPlaygramWebApp/main`, **Tirana Streets only**. This follows the merged V1 staging PR #25851. Racing Royal, Kart Royale, map geometry, career saves, currency and multiplayer are not changed.

## Draft status: binary import remains pending

This commit contains the exact revised manifest and checksums, an opt-in V2 URL catalog, a guarded importer and tests. **The 11 GLBs, HDR, original authoring scripts and preview images are not yet committed.** They remain in the conversation attachment `Tirana-CityLife-V2-Revised.zip`. Merging this staging commit alone neither provides the models nor activates CityLife in the game.

Use the latest **Revised** ZIP, not `Tirana-CityLife-Review-Pack.zip` (V1) or the earlier `Tirana-CityLife-V2-Asset-Pack.zip` (a different V2 snapshot). The exact archive SHA-256 is:

```
6a6226f87b15efc25a2140515b4bda9396971309fce841f9e6f3f44d9a779038
```

## Revised models

11 masters: Albanian ambulance and fire appliance; red/navy paramedics; rescue/operator firefighters; student, worker, courier, business and local civilians. The source manifest preserves their file hashes, sizes, triangle counts, clips, vehicle wheelbase and attachment socket metadata. These are the latest previously delivered meshes; this PR does not claim an additional modeling pass.

The source archive describes revisions to the fire-appliance cab, equipment and pump panel, ambulance axle/window/livery geometry, and character eyes, hair, reflective tape and clothing fit. The models retain shared adult male MakeHuman anatomy and Idle/Walk/Run clips. They are authored approximations, not scanned people or surveyed fleet replicas.

## Import onto this review branch

Requires Python 3.9+, Git, a clean checkout of this PR branch and the exact conversation attachment. No Python third-party dependencies are needed for importing.

```sh
python3 scripts/import-tirana-citylife-v2.py /absolute/path/Tirana-CityLife-V2-Revised.zip --check
python3 scripts/import-tirana-citylife-v2.py /absolute/path/Tirana-CityLife-V2-Revised.zip --apply
node --test test/tiranaCityLifeV2Assets.test.mjs
CITYLIFE_V2_ARCHIVE=/absolute/path/Tirana-CityLife-V2-Revised.zip python3 -B -m unittest discover -s test -p test_tirana_citylife_v2_import.py -v
```

The importer verifies the complete archive hash, exact 11 GLB digests and headers, original manifest, HDR and required notices. It refuses a wrong repository, main/master, detached HEAD, a dirty checkout, symlink destinations or an existing destination. Staging is completed before installation; an installation failure removes already installed directories.

It writes only:

- `webapp/public/assets/tirana-citylife/v2/`: exact models, HDR, manifest and license notices.
- `assets-source/tirana-citylife-v2/authoring/`: original source, textures, React/Three.js TypeScript preview, inspection renders, reports and notices.

Review and commit those imported files to this same PR branch. The tool never commits, pushes, merges or deploys. It does not overwrite V1 or patch `CareerRuntime`, `CareerGame`, `careerCore` or `CityLifeLayer`.

## Runtime integration gate

The latest ZIP contains **11 high-detail master GLBs, not the older pack's 30 GLBs or a new 33-file LOD set**. No new mobile LODs are supplied. Never relabel V1 LODs as V2, and never silently substitute V1 meshes. The opt-in catalog resolves only the 11 exact V2 IDs and rejects LOD aliases.

The masters total 853,300 triangles across the collection. They must not be loaded automatically for the existing 36/72/120 crowd presets. Before activating the set, import the binaries, derive matching V2 crowd LODs, adapt the renderer explicitly, verify all URLs and animations, and profile memory, draw calls, route/collision clearance and portrait-device performance. Existing AI and career logic remain untouched by this asset-staging PR.

## Verification performed in this session

- PASS: exact revised ZIP, 11 model hashes/GLB headers, original manifest and HDR verification.
- PASS: five Node catalog/version-isolation tests.
- PASS: nine Python importer tests, including real-archive import in a clean temporary Git checkout, main/dirty/wrong-repository refusal, symlink protection and installation rollback.
- NOT RUN: complete webapp build, live game, physical-phone performance or new visual/animation certification.

No Blender run, new `.blend` production, new combat/work clips, photorealism claim or deployment is part of this PR. Original source-specific licensing remains applicable; importing preserves the MakeHuman/wardrobe, Webots Apache and Poly Haven notices instead of assigning a blanket license.
