# Tirana Streets CityLife — existing review pack

This is the previously delivered CityLife implementation, not the requested visual rework. It is staged for review against `TonPlaygramBot/TonPlaygramWebApp/main` at `25f9be958551cfca1c19293adb301404c2c49aa3`.

## Status: draft, not playable from this commit alone

The four source modules and tests are committed. The 30 GLB files, HDR and asset manifest are still in the conversation attachment `Tirana-CityLife-Review-Pack.zip`; **the binary assets are not committed here**. CareerRuntime, CareerGame and careerCore are deliberately unchanged until the exact assets are imported. Merging this staging commit alone does not activate CityLife. No deployed game, multiplayer authority, currency balance, map origin or Racing Royal code is changed.

The delivered archive has SHA-256:

```
7f90091c0213b6ce317f222e182beec593cfc5d7b984e0fab5124bd5d2f3a85f
```

## Existing contents

The archive contains an Albanian ambulance, fire engine, two paramedics, two firefighters and five civilian variants (student, worker, courier, business and local): 11 base models, 30 GLBs including LODs. The source modules retain the delivered civilian walk/idle/flee/melee/armed retaliation states, limited ammunition, line-of-sight checks, emergency dispatch/treatment/fire suppression/return states, and 36/72/120 configurable population budgets. Those budgets are not measured phone-performance results.

The Three.js layer uses the existing GLBs, a near-camera skeletal budget and instanced distant civilians. The navigation adapter uses the existing WORLD, ORIGIN, map routing and collision helpers. The importer retains the original solo-career hooks for medical and fire jobs; it does not implement multiplayer integration.

## Finish the import on this PR branch

Requires Node.js, Python 3, Git, the exact archive already delivered in the conversation and a clean checkout of `review/tirana-citylife-existing-pack`.

```sh
node scripts/import-tirana-citylife.mjs /absolute/path/Tirana-CityLife-Review-Pack.zip --check
node scripts/import-tirana-citylife.mjs /absolute/path/Tirana-CityLife-Review-Pack.zip --apply
node --test test/tiranaCityLife.test.mjs
```

The check pins the complete archive, compares the four staged modules byte-for-byte and validates the original career file hashes and patch anchors. Apply refuses main/master, detached HEAD, a dirty checkout, existing asset output or modified source modules. It copies the original assets to `webapp/public/assets/tirana-citylife/v1`, includes license/attribution notices, preserves the original authoring scripts and applies the existing career integration. No automatic commit, push, merge or deploy occurs. Inspect the resulting diff, run the full build and in-game tests, then commit the imported files to this same PR branch.

## Validation performed for this PR

- Strict standalone TypeScript compilation of the original CityLifeCore passed.
- All 21 original simulation tests passed again. The repository test harness transpiles the current TypeScript source instead of relying on a stale generated JS copy.
- The import wrapper passed `node --check`; complete import/build/gameplay was not executed in this session.
- The original installer's three source hashes still matched main when checked through the connected repository.

## Merge blockers and known limitations

Import and commit the binaries and career changes before considering this a playable integration. Run the complete webapp build, verify every runtime GLB URL, test mission progression/save/replay, pause/resume/disposal, real-city route clearance and portrait mobile performance. Review clothes licensing before commercial distribution.

No new Blender run or .blend generation occurred. The original pack shares male anatomy among civilian variants and has only Idle/Walk/Run skeletal clips. Combat, hose operation and stretcher/carry animations remain unfinished. Vehicle shapes, equipment, lighting, fire visuals and distant NPC materials require the separate visual-quality correction already requested. Collision uses approximate sidewalk offsets and circular vehicle proxies, not full vehicle physics. This PR must not be described as photorealistic, production-ready or an already deployed expansion.
