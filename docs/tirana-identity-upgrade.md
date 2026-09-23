# Tirana Streets: identity, Parliament and frame cost audit

Prepared against main tree `bde82ee70cb5e40d82330fb605a830a1594b3e68` on 2026-09-23. This is a substantial code/asset pass, not a claim that the entire city is now photorealistic or that every monument has been surveyed.

## Findings and changes

| Observed issue | Change |
| --- | --- |
| Both crowd selectors sort the entire nearby population, repeatedly computing square roots. | A deterministic nearest-K selection with squared distances and a bounded result; exclude force-owned people before the generic-crowd budget. |
| Slow frames can schedule six physics steps before returning to input/rendering. | Maximum four catch-up steps, preserving 60 Hz and fractional time on ordinary 20–144 Hz displays. Overload deliberately drops excess wall time instead of accumulating work. |
| Navigation rebuilds the line/material every route update and assumes ground level zero. | Reuse power-of-two GPU buffers, follow terrain, clear empty routes, and use the last drawn vertex for the mission beacon. |
| Several dimensional building signs sit behind their flat panels. Only 12 brands have raised models. | Correct mount depth and measured bounds; 19 additional baked GLBs, extending eligibility to 31 brands across 299 mapped signs. |
| Sign requests can hold all loader slots indefinitely. | Timeouts, bounded concurrency, retry delay, an LRU source cache, and cleanup of late model completions. Flat existing signs remain available while models load. |
| Schools and institutions have flat names only. | Raised complete Albanian names, including ë/ç, with a licensed font subset; nearby limits of 4/10 and one construction per update. Institution signs and flags follow terrain. No invented crests. |
| Parliament has a small generic guard group, rather than rows around the hall. | Four authored approaches with six officers each: FNSH on two sides, Shqiponja on two. Placement rejects roads, solid geometry and other posts. Neutral visitors do not trigger pursuit. Returning officers reform their rows. |
| Each original FNSH/Shqiponja uniform has over 130,000 triangles; rendering the larger cordon without an LOD would be expensive. | Offline index-only LODs: FNSH 130,804 → 32,120 triangles; Shqiponja 133,428 → 32,834. Original vertex data, textures, bones, skin weights and animation clips stay shared. At most four nearby cordon officers use full detail; battery uses LOD. Hysteresis prevents repeated topology swaps. The increased visual allowance (26/28) activates only after both required LODs load; failure retains the previous 8/16 limit. |
| Parliament planting and monument coverage remain sparse. | Sixteen authored infill trees between mapped trunks, each with collision and one visual owner; two entrance fan palms based on the packaged reference photograph. Add an authored Ismail Qemali sculpture, pedestal and backing slab at the documented object location. |

The LOD files contain indices and a SHA-256 fingerprint of the exact source GLB. Runtime rejects a mismatching patch. No second copy of the original textures/vertex buffers is downloaded for LOD, and changing LOD does not reset an officer's animation mixer.

## Asset coverage and sources

The 19 new brands are Intesa Sanpaolo, OTP, Union Bank, ABI, Tirana Bank, Fibank, ProCredit, UBA, Eco Market, Sophie, KFC, Burger King, Tirana International, TEG, QTU, Rossmann & Lala, Neranxi, Pizza Hut and Marriott. Artwork is the repository's existing operator-sourced artwork, preserved in the GLB. Each new GLB has at most four material draws. `city-identity/manifest.json` records sources, sizes and triangle counts.

Mapped identities/positions come from the existing city registry. This work does not independently certify every branch remains open or that each fascia's dimensions match the current storefront. Keep operator branding separate from estimated architecture.

Online references consulted:

- [BKT contact](https://www.bkt.com.al/en/contact-us), [Hoxha Tahsim branch](https://www.bkt.com.al/atm-branches/branch-atm-hoxha-tahsim), [Myslym Shyri branch](https://www.bkt.com.al/atm-branches/branch-atm-myslym-shyri).
- [Raiffeisen branches/ATMs](https://www.raiffeisen.al/sq/individet/menyrat-e-bankingut/deget-dhe-atm.html), [Tirana Bank branch contacts](https://www.tiranabank.al/d/604/kontaktet-e-degeve), [OTP's official branch locator](https://otpbank.al/en/), [ProCredit Albania](https://www.procreditbank.com.al/).
- [Toptani's official site](https://toptani.com.al/en/) and the operator URLs retained in the three existing sign-reference registries. Toptani itself remains on its existing artwork treatment in this pass.
- [Parliament's public tour](https://edukimi.parlament.al/en/per-qytetaret/turi-parlamentar) and the existing `references/city-parliament.jpg` photograph for the two entrance palms. Tree sizes/placement are authored, not a measured planting inventory. The cordon is game design, not a claim about real security deployments.
- [Tirana municipality: Sulejman Pasha](https://tirana.al/pika-interesi/shtatorja-e-sulejman-pashes), [Unknown Partisan](https://tirana.al/pika-interesi/monumenti-i-partizanit-te-panjohur).
- [Ivan Ruggiero's 2024 Ismail Qemal Vlora photograph](https://commons.wikimedia.org/wiki/File:Ismail_Qemal_Vlora_statue.jpg): object location **41.320574, 19.820227**, distinct from the photographer's location. Original sculpture approximation; photograph is not used as a texture. The modeled suit, beard, pedestal and tall stone backdrop are visual estimates, not a scan. Reference photograph: Ivan Ruggiero (Wikimedia), CC BY-SA 4.0.
- [Visit Tirana: Independence Monument](https://www.visit-tirana.com/locations/independence-monument/) documents its split tower form and 6.5 m height. **Not added**: a reliable object anchor and a complete reference set were not established. Do not substitute Vlorë's monument.
- [Meshoptimizer documentation](https://github.com/zeux/meshoptimizer/blob/master/js/README.md) for attribute-aware, index-only simplification. Build dependency pinned to 1.1.1.

## Reproduce the assets

From repository root after installing the webapp dependencies:

```sh
python tools/build_tirana_identity_relief.py
node webapp/scripts/build-tirana-institution-font.mjs
node webapp/scripts/build-tirana-identity-models.mjs
node webapp/scripts/build-tirana-cordon-lod.mjs
blender --background --python tools/blender/tirana_city_identity_upgrade.py
```

Pillow is needed for contour baking. The Blender script imports the 23 baked, textured models (19 signs, three monuments, entrance palms), packs textures, and saves editable `.blend` projects under `assets-source/tirana-identity/blender`. These GLBs were generated and checked here; **Blender was not available and the `.blend` export was not executed**. The existing original uniform rigs remain their own source assets. The normal game-pack generator already recursively includes both asset folders.

The licensed Gentilis subset and its license live in `institutionTypeface.json` and `assets-source/tirana-identity/FONT-LICENSE.txt`.

## Verification

- Focused Node tests: 46 passing across the upgrade, institution guards, city life, mobile runtime and gameplay overhaul suites.
- `tsc -p webapp/tsconfig.tirana-living.json --pretty false`: passes.
- Esbuild bundles the complete `StreetCareerGame.tsx` entry, including the renderer.
- Every new GLB is checked for valid buffer/accessor ranges; all artwork is embedded. Monument/palm models parse with the project's Three loader.
- Both real uniform GLBs parse for a geometry/rig test: the reduced indices stay within the original vertices; UV, normal, skin attributes and materials retain object identity; a sampled walk animation produces finite skinned coordinates; switching back restores the exact original geometry. Image decoding is omitted in this Node-only rig test.
- The isolated full-population CPU sample uses 60 warmup + 240 measured steps. See `tirana-identity/cpu-before.json` and `cpu-after.json`.

| CPU simulation measure | Main baseline | This branch |
| --- | ---: | ---: |
| NPCs | 1,764 | 1,782 |
| Traffic | 2,408 | 2,408 |
| Median step | 4.68 ms | 4.36 ms |
| p95 step | 7.12 ms | 6.20 ms |
| p99 step | 9.05 ms | 9.70 ms |
| Maximum step | 10.24 ms | 14.88 ms |
| Steps over 16 ms | 0/240 | 0/240 |

These are single machine CPU samples, not GPU frames or proof of a speedup. The tail varies; repeat comparable runs on target devices before making an FPS claim.

## Review limits and remaining work

The live lobby reports WebGL unavailable in this browser. The browser security policy also blocks local HTTP/file previews. No visual pass or on-device FPS measurement is claimed. The portrait React/Three model review is statically bundled and includes a labeled SVG projection fallback, but its layout could not be browser-verified here.

```sh
node webapp/scripts/build-tirana-identity-review.mjs --out /workspace/tirana-identity-upgrade.html
node --test test/tiranaIdentityUpgrade.test.mjs test/tiranaInstitutionGuardIndex.test.mjs test/tiranaCityLife.test.mjs test/tiranaMobileRuntime.test.mjs test/tiranaGameplayOverhaul.test.mjs
```

Before merge, inspect close/distant guards and LOD transitions on a mobile GPU, school lettering, all logo caps/counters/colors, Parliament placements and sculpture proportions. Run the Blender export and inspect the editable sources. Complete a sourced inventory and art pass for remaining square/school statues and building-specific facades; this PR does not claim that inventory is complete. It is not a production deployment.
