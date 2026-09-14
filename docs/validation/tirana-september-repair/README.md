# Tirana Streets repair validation

Base: `69bc6dd2334476eb1feb5abcf40be925916c621a`. The subsequently fetched
`a97ead0` main tree is identical. This work changes Tirana Streets and its shared
visuals; it does not deploy the application or replace the original character
and vehicle GLBs.

## Repairs verified

- Original RENEA, FNSH and Shqiponja skeletons and uniform textures load with
  prioritized requests and recovery from transient failures. Rest-pose-aware
  limb solving preserves body proportions and upright torsos. Existing authored
  animation clips remain available; a small licensed CC0 motion dataset adds
  locomotion and reactions without another character-model download.
- Original road wheels roll around measured axle pivots in forward and reverse.
  Bus wheel bolts move with their wheels; spare tires, brake calipers and cockpit
  steering wheels do not accidentally join the road-wheel animation.
- Collision damage follows closing speed and mass. Small-arms fire can disable
  a car without igniting or exploding it. Explosives remain distinct. Bullet
  marks follow actual vehicle surfaces and moving vehicles, expire, and use a
  bounded instance pool. Mechanical damage no longer applies burnt paint.
- The square jet and helicopter have clear parking positions and usable
  boarding, takeoff, climb, hover, landing and exit paths. Wing/rotor sweeps
  prevent the old centre-ray collision gaps. Touch controls retain independent
  ownership through release, pause and blur.
- Facade selection reaches 1.1 km in normal mode and 640 m in battery mode,
  while retaining the existing 100/35 building caps. A spatial index, frustum
  filtering, bounded clone work and unchanged-view upload avoidance limit work.
- The Blender face building replaces both existing mapped parts. Collision
  contours come from its exported floors, slabs and glass guards. Thirty-six
  rays across nine heights match the visible GLB within 9 cm. The adjacent
  InterContinental tower retains its mapped footprint with corrected height
  and a material-batched facade.

## Test and repair loop

Results: production build passed; the ten repair regression files passed
**78/78**. The existing career gate files account for **158 passing checks**
after the two stale fixture files were corrected and rerun. The final production
browser run entered the career, opened settings and resumed, with no uncaught
page errors or failed asset requests; deliberately blocked optional scenery did
not gate entry. The selected-player preview's blocked-chunk recovery also passed.

The first passes exposed a selected-weapon loading race, a rig layer overwriting
the final arm pose, splayed rifle-grip fingers, mismatched tower collision,
stale vehicle-mark transforms and an unmapped preview JSX import. Each received
a focused regression or an actual-model browser recheck after correction.

The existing career gates also contained stale fixtures on main: a former
35-weapon catalog, an unowned starter AK assumption, omitted traffic state,
old population totals and a GLB requirement for procedural pocket items. Their
assertions now exercise the current catalog, actual procedural builders and
standing police fleet; damage, cadence, ownership and asset budgets remain
checked.

Reproducible commands (from the repository root after installing webapp dependencies):

```sh
npm run build --prefix webapp
node --test --test-concurrency=2 test/tiranaCareerLoadingFlightInput.test.cjs test/tiranaHeldWeaponLoading.test.mjs test/tiranaHumanAnimation.test.mjs test/tiranaImpactPresentation.test.mjs test/tiranaPedestrianDefense.test.mjs test/tiranaPedestrianDefenseGameplay.test.mjs test/tiranaRollingWheels.test.mjs test/tiranaSkanderbegBuilding.test.mjs test/tiranaVehicleDamageFlight.test.mjs test/tiranaVisibilityBudget.test.cjs
node --test --test-concurrency=2 test/tiranaFullBodyCareer.test.mjs test/tiranaStreetCareer.test.mjs test/tiranaStreetCareer.integration.test.mjs test/tiranaCityLife.test.mjs test/tiranaCareerExpansion.test.mjs test/tiranaGameplayOverhaul.test.mjs test/tiranaFullBodyPresentation.test.mjs test/tiranaGameplayPresentation.test.mjs test/tiranaPlayerExperience.test.mjs test/tiranaDriverBattlefield.test.mjs
```

Browser checks use the repository's Playwright harnesses. Set `PLAYWRIGHT_MODULE`
and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if Chromium is not installed in their
default locations. Run `test/tiranaRealismAssets.browser.mjs` for real production
visual layers and GLBs, and `test/tiranaProductionLoading.browser.mjs` for the
actual Vite-split game route. Generate the separate conversation preview with
`node webapp/scripts/build-tirana-repairs-preview.mjs`, then check it with
`test/tiranaRepairsPreview.browser.mjs`.

The actual-model browser check covers 24 originals: three force uniforms, four
other humans, five bikes, an articulated bus and eleven collection cars at
390 × 844. Its JSON records source hashes, bounds, wheel motion and request
errors. The 320/390-pixel building preview is separate evidence and does not
stand in for running the game. Representative screenshots accompany this file.

## Limits and provenance

Full-app TypeScript errors already exist on main. The baseline comparison uses
the same dependencies and all tracked source/configuration files; its normalized
result is recorded alongside the browser evidence. The TypeScript gate is not
suppressed or weakened. Both trees produce the same **412 diagnostics** with
**zero introduced diagnostics**.

Software WebGL validates rendering and interactions here. It does not establish
a physical-phone FPS result; the continuous full-city scene remains expensive
in this environment. Wider detail is implemented with explicit budgets, not an
unlimited draw distance. Check a physical phone before a production rollout.

The new tower is an original interpretation of the published architect's design,
with close facade details, not a surveyed microscopic replica. See
[landmark sources and model budgets](../../tirana-skanderbeg-building.md) and
[asset provenance](../../tirana-free-asset-sources.md) for CC0 licensing, downloaded
versus shipped assets, original hashes and current-building research. No
Sketchfab model or reference photograph is redistributed by this patch.
