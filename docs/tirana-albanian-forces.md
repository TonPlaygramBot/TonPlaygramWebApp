# Albanian Forces integration

Tirana Streets now uses the supplied Albanian Forces v2 models for nearby law
enforcement units in the normal game and Street Career. The shared simulation
assigns `forceVehicle` and `forceCharacter` IDs and carries them in public
snapshots. Existing unit kinds, wanted mechanics, collision and driving remain
the source of gameplay behavior.

| Response | Vehicle selection | Uniform |
| --- | --- | --- |
| Routine city patrol | Patrol Impreza | Patrol |
| One star | Patrol Focus, traffic motorcycle, Patrol Impreza, police Sprinter | Patrol / traffic |
| Two stars | Shqiponja compact / motorcycle | Shqiponja |
| Three stars | FNSH Sprinter | FNSH |
| Four stars | RENEA armored vehicle | RENEA |
| Five stars | RENEA armored vehicle | Army |

One-star/two-star selections rotate by dispatch slot and elapsed half-minute;
all choices are deterministic. Five-star vehicles use the armored model because
the pack has an army soldier but no dedicated army vehicle. Legacy saves and
older server snapshots resolve police to the Focus and military to the armored
vehicle, with corresponding default uniforms.

`AlbanianForcesVisuals.ts` owns demand loading, near-distance selection, private
character skeletons, Idle/Walk blending, vehicle wheel/steering pivots and private
flashing-lens materials. It shares the existing weapon-holder system. Up to two
downloads run at once; at most eight source templates are cached. Distance and
count limits fall back to the existing low-detail actors, including on failure.
City startup does not wait for the new pack. Street Career routes enforcement
NPCs through this same renderer, leaving the civilian cast intact.

The pack contains Idle and Walk, not shooting/entry/riding animation libraries.
Running reuses Walk at a faster rate. This change adds no new drivable-vehicle
ownership or character-selection flow. Vehicles retain their physical metre
scale; no browser or phone frame-rate claim is made.

## Original-quality asset restoration

The repository previously tracked the loader, credits and reduced manifest but
not the GLB or thumbnail files. All 14 original GLBs and 14 thumbnails are now
committed from the supplied ZIP. Each GLB matches its source SHA-256 and byte
count. The importer now copies originals without mesh simplification or texture
resizing; the manifest retains the original triangle counts. Cache-versioned
model URLs prevent reuse of an older reduced model.

The full pack is 73,560,264 bytes and 1,524,661 triangles, with embedded PBR
textures, skeletons, pivots and clips unchanged. Existing distance/count limits,
loading fallbacks, wanted-level dispatch and Street Career integration remain.
Full-detail assets have higher bandwidth and GPU-memory costs; physical-phone
performance has not been measured. Blender authoring scenes and rebuild sources
remain in the supplied ZIP, outside the browser runtime.

## Verification

- Full webapp production build passed.
- All 14 GLBs and thumbnails in both source and production output match the
  uploaded ZIP byte-for-byte.
- Seven integration tests pass, covering pack hashes/rigs/pivots, all dispatch
  roles, simulation snapshots, legacy roles, real vehicle loading/orientation/
  wheels, independent animated officer skeletons, and failed/late-load cleanup.
- Headless runtime tests stub image decoding; they do not establish browser
  pixel output or phone frame rate.

```sh
node --test test/tiranaAlbanianForces.test.mjs test/tiranaAlbanianForcesRuntime.test.mjs
cd webapp
npm run build
```
