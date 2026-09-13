# Tirana Streets gameplay update

Based on `main` at `105f65e`, then merged cleanly with `38b15d4`.

## Player-facing changes

- Battlefield presents three operations: Clear the square, Bazaar intelligence and Dajti final stand. Wins unlock the next operation; existing valid completion history is retained.
- New battlefield runs and fresh careers start with a loaded AK-47. Existing career saves keep their selected equipment. The retired FPS gun migrates into AK ammunition once.
- Ground pickups explicitly equip the chosen weapon, even at maximum reserve ammunition, cancel an unfinished reload and cannot be claimed twice or while driving. Battlefield uses **E** or the contextual pickup button; healing moves to **H**. Ground models use the same assets as held weapons.
- Decorative gun props have been removed from the static world. Collectible weapons remain in career's 300 pickup locations and battlefield's equipment cache/enemy drops. This also removes the obsolete FPS prop and avoids downloading large decorative firearm sources.
- Career shows up to three available jobs first and keeps replays in a collapsed list. An active job must be finished or ended before another can replace its checkpoint.
- On foot, career uses the player's eye position, including crouching and aiming. Vehicle chase placement follows the collision ray; driver hand and eye positions share the vehicle's terrain support plane. Battlefield cars cannot be entered before their model loads.

## Character and loading

`living/operator.glb` is a CC0 Quaternius character built from the audited source already in this repository. The navy costume retains the original hair and seven movement/weapon animation clips. The shared Three.js/TypeScript controller supplies weapon grip IK, aiming, recoil, reload, crouch and vehicle interactions. The character model does not itself provide gameplay AI. Attribution, source and checksum are in `webapp/public/assets/tirana-streets/living/ATTRIBUTION.md`.

The generic camera gun is removed. Battlefield and career use the physical character and held weapon. The first-person head mask is reversible for vehicle chase view and keeps the complete body shadow.

The starting AK switches from the 64,286,635-byte embedded original to the existing 762,736-byte derivative of the same credited model. Other large held firearms also use their attributed, bounded GLBs. All playable weapon URLs are checked for valid local models under 5 MiB. Asset byte reduction is measured; phone loading time and FPS have not been measured.

Game modes load separately. Core city and player assets load together; optional vehicles and street furniture stream afterward. The selected weapon must finish loading before play starts. Career no longer primes every NPC appearance or creates a duplicate city-detail layer, and the battlefield navigation graph is built only when navigation is requested.

## Verification

The focused eight-file gameplay regression run passed **108 tests**, including real GLTF parsing, weapon loading, save migration, ammo and pickup behavior, progression, first-person camera geometry, driving, character masking and pointer controls. The final pickup/driver/original-asset run after removing decorative firearm props passed **35 tests**. The existing crowd-cap assertion was brought into agreement with the unchanged 72/28 limits already on `main`.

```sh
node --test --test-concurrency=2 test/tiranaFullBodyCareer.test.mjs test/tiranaFullBodyPresentation.test.mjs test/tiranaStreetCareer.test.mjs test/tiranaStreetCareer.integration.test.mjs test/tiranaGameplayOverhaul.test.mjs test/tiranaGameplayPresentation.test.mjs test/tiranaDriverBattlefield.test.mjs test/tiranaPlayerExperience.test.mjs
node --test --test-concurrency=2 test/tiranaPlayerExperience.test.mjs test/tiranaForceSquads.test.mjs test/tiranaDriverBattlefield.test.mjs
node webapp/node_modules/typescript/bin/tsc -p webapp/tsconfig.tirana-gameplay.json --noEmit
npm run build --prefix webapp
```

The production build, including original-asset integrity verification, and the dependency-aware Tirana typecheck passed again after merging `38b15d4`. Vite still warns about large existing city/world chunks.

The repository-wide TypeScript check has **236 diagnostics** after syncing `38b15d4`. A TypeScript compiler-host comparison produced the same 236 diagnostics on that `main` source and this branch, with **zero new diagnostics**. The earlier comparison against `105f65e` likewise had 234 diagnostics on both versions. This update does not suppress or remove that gate.

Browser verification remains incomplete: the controlled browser rejected the local game URL with `ERR_BLOCKED_BY_CLIENT`; the existing Playwright test could not launch because Chromium was unavailable, and its normal installer timed out. No successful browser screenshots, physical-device performance result or end-to-end visual approval is claimed. Check weapon alignment, phone touch layout and hill/collision camera transitions in the actual game before release.
