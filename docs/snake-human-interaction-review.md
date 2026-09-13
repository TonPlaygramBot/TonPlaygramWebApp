# Snake and Ladder human interactions

The seated humans on main were static while dice and firearm effects animated independently. Starting a roll also moved the die to an invented airborne start position. Firearm imports replaced their normalization scale with model-specific multipliers, so their physical size varied substantially.

This change connects both actions to the actual seated skeleton. The die remains at its existing resting transform throughout reach and finger closure, follows the grasp point during lift, and begins the existing Royal dice flight at the exact release pose. The local and online presentation clocks include the pickup. The result event no longer schedules a second handoff that can compete with the active roll; the existing next-turn handoff remains.

Firearms have a normalized presentation wrapper with trigger, support, stock and muzzle contacts. Parked and held instances retain the same geometry and world scale. The hand reaches the parked grip before visibility transfers to the held instance; the animation returns the weapon to that exact position. Long guns use a palm-up supporting hand, pistols use a supporting cup, and the trigger finger closes separately from the other fingers. Ludo's ammunition, cadence, recoil, projectile, shell, reticle and impact effects remain shared. Autonomous vehicles and explosive props retain their existing presentation path.

The interaction solver uses the default avatar's actual finger names and palm basis, preserves limb lengths, shifts weight within the chair when required by the real board spacing, and keeps both feet planted. Cancellation restores the human pose and parked weapon visibility. The default avatar loads from the existing bundled model before remote fallbacks.

## Validation

- `npm run test:snake --prefix webapp`: 60 tests, including the actual board's resting-die layout, production parking slots, all four seat directions, stationary pickup, continuous release, planted feet, two-hand contact through recoil, muzzle alignment, 30/60/90 Hz presentation, skipped frames, cancellation, and local/online input locking.
- TypeScript check of all new interaction and preview modules.
- Complete webapp production build, including the repository's asset verification steps.
- Three.js geometry sampled with the actual avatar and the repository's imported rifle, pistol and shotgun. The preview uses the production board builder and interaction modules. Contact gaps must remain below 0.003 scene units.
- Portrait frame inspection found and corrected the initial finger-axis, resting-arm, far-die reach and long-gun support-hand issues.

## Reproduce the review

1. `node scripts/build-snake-interaction-preview.mjs /workspace/snake-human-grip.html`
2. `node scripts/check-snake-interaction-preview.mjs` (requires `@napi-rs/canvas`, available in the Work runtime).
3. `python scripts/snake-review/render.py scripts/snake-review/polyAssaultRifle01Attack-pickup.json scripts/snake-review/polyAssaultRifle01Attack-aim.json` (requires NumPy and Pillow).

Generated assets, sampled meshes and images are ignored by git. The small in-chat preview omits texture maps and facial morph targets while preserving the authored body mesh, skeleton and firearm geometry; gameplay keeps the original materials.

Live browser/Telegram verification was unavailable because the browser download timed out. The frame checks use CPU rasterization of Three.js's deformed meshes, not a WebGL screenshot. Every externally hosted store model has not been visually calibrated individually; models without authored sockets use the documented family contact profiles. A final phone review is still required before calling the result visually perfect.
