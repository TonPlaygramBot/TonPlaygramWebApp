# Racing Royal: city career and driver update

This update gives Career its own city job board and improves the existing kart
simulation, cockpit, rivals, and models. It uses the mapped Tirana driving world.
City jobs are driving activities; this does not add on-foot combat or a complete
GTA-style pedestrian simulation.

## Player changes

The garage's **Career** button opens the new board. Championships and the existing
race challenges remain available in its second tab.

| Job | Activity | Unlock | First completion |
| --- | --- | ---: | ---: |
| Market courier | Stop for three parcel handovers in Qendër | 0 XP | 120 XP |
| River watch | Follow the Lana inspection route with 85% condition | 0 XP | 140 XP |
| Medical express | Timed, fragile supply deliveries in Blloku | 120 XP | 180 XP |
| Pyramid film crew | Follow filming markers and bank 160 drift points | 120 XP | 180 XP |
| Precision survey | Hold 36–72 km/h cleanly for 15 seconds along the route | 300 XP | 220 XP |
| Farkë supply trail | Deliver supplies along the lake route | 300 XP | 250 XP |

Jobs have time and condition requirements, road-following guidance, bronze/silver/
gold medals, best times, pause, restart, recovery, camera, and sound controls.
Delivery handovers require 1.5 seconds stationary inside a marker with both pedals
released; continuing to hold the brake would engage reverse. Drift chains
bank when released; an impact discards the unbanked chain. Recovery cannot award
a checkpoint or movement score during the relocation step. Replays can improve
medals and times, but never duplicate first-completion XP.

City progress uses `tonplaygram.racing.city-career.v1` in device storage. Existing
cup and race-task saves retain their separate keys. No TPG rewards are introduced.

The eight kart families now have animated throttle/brake pedals, grip pads,
linkages, clearer footwells, and model-specific fairing, wing, duct, and mudguard
details. Hands follow the steering rim; elbows and knees solve to their control
positions. The driver leans under load and recoils after impacts. The first-person
camera uses the kart's authored seat socket. Reduced-motion settings suppress
cosmetic body motion. These are improved original procedural karts and the
existing Blender driver, not scanned photorealistic assets.

Rivals evaluate both passing sides, consider fast traffic behind them, commit
briefly to a lane, brake for closing gaps, and recover when stuck. Difficulty uses
the shared simulation without player-distance speed cheats. Existing lap gates
and browser/server simulation remain in place. Impact particles originate at the
bumper contact, fairing damage leaves the driver's body scale intact, skid marks
match the kart footprint, and closed circuits gain instanced edge reflectors and
drainage.

## Verification

Base comparison: `main` commit `edbd167e3`.

| Check | Result |
| --- | --- |
| City rules, rewards, driver IK, racecraft and controls | 10 new tests pass |
| Portrait cockpit projection and unobstructed pedal rays | 8 new tests pass, all kart models |
| Career board, launch, pause, reward isolation and cleanup | 3 React tests pass; WebGL/audio are mocked |
| Full `test/racing*.test.mjs` suite | 150/156 pass; all 6 failures also fail on the base |
| Base racing suite | 131/138 pass; a stale modern-fleet length expectation is corrected in this update |
| Kart TypeScript check | Same 20 TS7016 declaration errors as the base, in shared Tirana/social imports; no new diagnostics |
| Racing standalone production bundle | Pass |
| Full app direct Vite production bundle | Pass, including Social App packaging; existing large-chunk warnings remain |
| AI completion benchmark | All 54 rivals finish across Qendër, Blloku and Farkë, at rookie/street/pro difficulty |
| City stop clearance | All 21 destinations have zero displacement/water recovery in the production collision world |
| Kart asset limits | All 16 full/LOD exports fit the existing 40-draw budget; full meshes below 25k triangles, LOD below 10k |

The six pre-existing failures are in:

- `test/racingCityUpgrade.test.mjs`: source seat migration, compact kart footprint,
  and five legacy Blender cockpit exports.
- `test/racingEnvironmentCollision.test.mjs`: mitered edges inside source road widths.
- `test/racingMilitaryVehicles.test.mjs`: common body/floor/seat fitting scale.
- `test/racingRoyalTirana.test.mjs`: legacy 2.1 m contact-separation expectation.

Useful commands from the repository root:

```sh
node --test test/racing*.test.mjs
node --test test/racingCityCareerUpgrade.test.mjs test/racingCockpitVisibility.test.mjs test/racingModernFleet.test.mjs
webapp/node_modules/.bin/tsc -p webapp/tsconfig.kart.json --pretty false
node tools/build-modern-racing-karts.mjs
node tools/previews/build-racing-city-preview.mjs /tmp/racing-city-preview.html
```

The direct Vite check compiles and packages the application; it does not run the
external asset downloads in the deployment prebuild lifecycle.

From `webapp/`:

```sh
node_modules/.bin/vitest run --config vitest.navigation.config.mjs src/games/kartroyale/RacingCareerGame.navigation.test.jsx
node_modules/.bin/vite build --config vite.kart.config.ts
node --max-old-space-size=3072 node_modules/vite/bin/vite.js build
```

The portable portrait preview includes two routes, all eight karts, city jobs,
free driving and AI racing. It shares production physics, controls, model
generation and driver articulation, with reduced surrounding-city rendering.
Preview progress is temporary. The full production board provides all six jobs
and device persistence.

**Outstanding visual check:** the available browser rejected local preview URLs,
so no rendered-browser or physical-phone validation, screenshots, or FPS claims
are made. Before release, check 390×844 portrait steering/pedal visibility, touch
controls, driver/chase transitions, mission markers, collision recoil, and a full
job completion/save/reload on a phone. Geometry raycasts and mocked UI tests do
not replace that visual check.

## Design references

The original jobs borrow the variety of optional city work in
[Vice City](https://support.rockstargames.com/articles/3HYqnUoR8fjHGGg9NdTbzm/gta-vice-city-ps2-100-completion)
and the mix of driving stories and skill activities in
[Forza Horizon](https://forza.net/news/forza-horizon-5-first-drive).
No characters, branding, map assets, or missions from those games are copied.
