# Tirana Streets sound and regional detail

This change adds sound and improves aircraft, missiles, demolition and nearby buildings. It builds on the gameplay, camera, weapon and menu changes already merged in #25890.

## Runtime behavior

- Shared procedural Web Audio covers weapon fire/reload, footsteps, launch, blast, fracture, ignition and vehicle/aircraft loops without downloading audio assets. Positional events use camera-relative stereo, distance attenuation and propagation delay. One compressed master bus caps one-shot voices at 24. Pausing cancels scheduled sounds; mute and disposal release voices.
- Helicopter blades use their actual AW101 node names and rotate around their authored geometry centers. Spin-up, rotor blur, ground downwash and jet exhaust add motion. A missing helicopter no longer prevents the jet from updating. Screen-relative control axes are unchanged.
- Career uses its authoritative simulated missile positions and directions. The one-draw-call missile pool has nose geometry and fins, and is capped at eight. Legacy events use a bounded straight trajectory instead of the former artificial arc.
- Six bounded particle pools provide flash, drifting smoke, ballistic rubble, delayed ground dust and distance-sampled missile trails. Fracture events add structural debris without a second fireball. Reset restores fracture material hooks and clears particles, lights and trails.
- A lazy Blender detail kit adds recessed windows, balconies, AC, plinths, gutters, downpipes, tanks, porches and reservoir coping around Farkë, Surrel, Qyteti Studenti, Njësia 2, Depo e Ujit and Grand–Pjetër Budi. Existing bespoke and aged facades are excluded. Flat-roof tanks require an interior point and are omitted on courtyards and pitched roofs.

## Budgets and sources

Regional detail uses nine instanced draw calls, nearest 24 buildings within 180 m, and at most 48,000 added triangles. Battery mode uses 12 buildings within 105 m and 24,000 triangles. Each part also has a fixed instance cap. Coverage does not mean all detailed buildings render simultaneously.

The reviewed Grand and Njësia 2 Blender source was recovered after the interrupted workspace upload and re-exported with Blender 4.5.3 LTS. Grand now has 65,576 triangles and uses standard `KHR_mesh_quantization` / `KHR_texture_transform`, with no extra decoder. Its GLB is 2,453,888 bytes, below its previous 2,488,252 bytes. The neighbourhood pack totals 5,046,256 bytes, below the unchanged 5.2 MB gate. Grand loads inside 350 m (200 m battery); its lightweight fallback returns beyond 420 m (240 m battery).

All mapped footprints, terrain positions and height provenance are retained. See [source references and attribution](../assets-source/tirana-regional-detail/REFERENCES.md). The current Flabina footprint remains unverified; the surrounding district is improved without assigning the school to an arbitrary building.

## Rebuild

Run from the repository root using Blender 4.5.3 LTS:

```sh
blender -b --python webapp/scripts/blender/build_tirana_regional_detail.py
blender -b --python webapp/scripts/blender/export_tirana_regional_heroes.py
python webapp/scripts/pack-tirana-regional-heroes.py
```

The region kit generator writes both the editable `.blend` source and runtime geometry. Hero exports reuse the packed reviewed `.blend` and existing local PBR texture files.

## Validation

Fresh results on this reconstructed branch:

- 40 unique targeted tests passed with zero failures or skips: `tiranaCinematic`, `tiranaGameplayPresentation`, `tiranaAirMobility`, `tiranaStreetCareer.integration`, `tiranaNeighbourhood`, `tiranaNeighbourhoodRuntime`, and `tiranaGameplayOverhaul`. The nine cinematic tests were rerun after the final lifecycle/streaming edits and passed again.
- Scoped TypeScript check passed, including the city game, career runtime and shared regional detail integration.
- Full Vite production compilation passed (public asset copying disabled for this local verification). The existing large-chunk warning remains.
- Updated GLBs pass manifest hashes, finite geometry, actual Three.js GLTFLoader decoding and the unchanged 5.2 MB asset-pack limit.

The previous workspace's test totals are not used to certify this reconstructed branch.

Live speaker checks, a complete browser playthrough and physical phone performance remain manual QA items. Source-level budgets and headless tests do not establish a phone FPS result.
