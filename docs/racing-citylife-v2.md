# Racing Royal — CityLife V2 Revised

**Draft: the GitHub commit contains the Racing Royal adapter, exact asset catalog/manifest, importer and tests. The 11 GLB binaries have not been uploaded to GitHub. `V2_ASSETS_READY` stays false until the verified import is committed. This PR alone does not display the models.**

Target: `TonPlaygramBot/TonPlaygramWebApp/main`. Audited base: `1b9db3864e98693716563e6382d12d11afe6c858`. This is a new Racing Royal PR, not another change to the older Tirana Streets CityLife implementation.

## Exact source revision

Use only the last delivered `Tirana-CityLife-V2-Revised.zip`, SHA-256:

```
6a6226f87b15efc25a2140515b4bda9396971309fce841f9e6f3f44d9a779038
```

The archive contains 11 base GLBs: an ambulance and a fire appliance, two paramedics, two firefighters and five adult civilian wardrobe variants. It contains no revised mobile LOD set. Do not substitute the earlier `Tirana-CityLife-V2-Asset-Pack.zip`, the V1 review pack or old `_lod1`/`_lod2` models. `assets-source/racing-citylife-v2/archive-manifest.json` is copied unchanged from this exact archive and records per-file checksums, sizes, triangles and animation names.

## Racing-only integration

`tiranaScenery.ts` attaches the new `RacingCityLifeV2Layer` to the existing race scene. The layer is disabled while the binaries are absent and makes no asset requests in that state. After import it selects mapped pedestrian paving outside the complete closed racing corridor, ordinary roads, building footprints and water. Where a complete emergency-crew group does not fit, it is skipped; city geometry and track data are never moved to fit an asset.

Vehicles are stationary trackside decoration. Human rigs use the existing Idle clip. This does **not** add ambulance dispatch, firefighting missions, armed civilian AI, walking crowds or a playable emergency vehicle to Racing Royal. Those are separate Tirana Streets gameplay tasks, not racing behaviour. Existing karts, driving, lap/checkpoint logic, Career objectives, VS AI, Multiplayer, Explore, currencies and on-screen controls are unchanged.

The high-detail revision is intentionally limited to three resident model instances normally and one in battery mode, with one concurrent request. Loading is near-camera, checks bytes/SHA-256 and rejects external GLB resource URLs. Failed assets have no old-model or primitive fallback. The race's existing disposal sentinel retires requests/mixers; late and evicted models are disposed independently. Runtime errors are exposed at the layer's `group.userData.errors`.

This is a conservative review adapter, not a measured phone optimization. Synthetic geometry checks do not certify that the assets look right beside every real circuit.

## Finish this draft on its branch

Requires Python **3.11+**, Git and the exact delivered ZIP. From a clean checkout of `review/racing-royal-citylife-v2-revised`:

```sh
python3 scripts/import-racing-citylife-v2.py /absolute/path/Tirana-CityLife-V2-Revised.zip --check
python3 scripts/import-racing-citylife-v2.py /absolute/path/Tirana-CityLife-V2-Revised.zip --apply
node --test test/racingCityLifeV2.test.mjs
CITYLIFE_V2_ARCHIVE=/absolute/path/Tirana-CityLife-V2-Revised.zip python3 -m unittest discover -s test -p 'test_racing_citylife_v2_import.py' -v
```

The importer checks the archive, exact manifest, all 11 models, self-contained GLB resources, notices, destination paths and worktree before writing. It refuses main/master, detached HEAD, dirty worktrees, symlink destinations, existing asset output and earlier packs. It imports the binaries/HDR/notices into `webapp/public/assets/racing-royal/citylife-v2/`, keeps the delivered sources, preview and historical reports under `assets-source/racing-citylife-v2/package-source/`, then enables the asset gate as its final write. The older reports remain historical delivery records, not evidence of this PR's status. It never commits, pushes, merges or deploys.

Review and commit that resulting asset import to this same PR. Keep the draft status until the full webapp build and portrait in-game checks pass. Do not enable the gate without the exact assets.

## Validation in this session

- All 11 local GLBs matched the supplied manifest's SHA-256 and byte length; their headers/JSON chunks and embedded resource policy were checked.
- 15 Node tests passed: exact catalog, coverage, geometry exclusions, deterministic bounded placement, no city mutation, loading budgets, byte verification and the Racing Royal hook.
- 7 Python integration tests passed against the actual ZIP: complete local import, dry-run, main protection, dirty-tree protection, wrong-archive rejection, overwrite protection and symlink rejection. Import was executed in an isolated Git fixture, not in a full game checkout.
- TypeScript syntax/transpilation checks passed for the new layer and modified scenery file. This is **not** full TypeScript type-checking.
- Not run: full repository install/build, WebGL gameplay, real-circuit placement review, browser loading/disposal stress test, physical-phone performance or CI. No Blender execution or new model authoring occurred for this PR.

## Remaining merge gates

1. Commit the exact 11 GLBs, HDR, notices and package sources using the verified importer.
2. Run the actual webapp build and regression tests, then verify asset URLs and failure handling.
3. Review each circuit's placement/clearance and portrait phone memory/FPS before enabling broadly.
4. Complete the source-specific clothes license review recorded in `ATTRIBUTION.md`.

The supplied models still have shared male base anatomy and incomplete action/work animations. They are not claimed to be photorealistic or production-ready.
