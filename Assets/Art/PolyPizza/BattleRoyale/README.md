# Ludo Battle Royale Poly Pizza asset intake

Use this folder for the open-source Poly Pizza GLB/GLTF/FBX files that back the Ludo Battle Royale weapons, tank pickups, bullets, and shells.

## Source candidates checked on 2026-05-09

- Poly Pizza advertises free, game-ready low-poly models and GLTF/FBX availability on model/search pages.
- Tanks: `https://poly.pizza/search/tank` and the Zsky tank page `https://poly.pizza/m/7GG1xDtc8l`.
- Bullets and shells: `https://poly.pizza/search/bullet` includes Bullet, 7.62x39mm, 9x19mm, Shotgun rounds, Missile, Bullet Cartridge, Pistol Ammo, and ammo-box candidates.
- Weapon/hand animation sources: `https://poly.pizza/search/gun%20animation` includes Animated Pistol, Fps Rig AKM, Fps Rig, Rigged FPS Arms, Rigged Glock, and similar open-source candidates.

## Import rules

1. Download only models whose source page permits the target use. Prefer CC0; keep attribution for Creative Commons Attribution assets.
2. Store raw downloads in subfolders by role: `Tanks/`, `Bullets/`, `Shells/`, `Weapons/`, and `Animations/`.
3. Create prefabs with stable names such as `BR_Rifle_Bullet.prefab`, `BR_Shotgun_Shell.prefab`, and `BR_Tank_Zsky.prefab`.
4. Assign each bullet/shell prefab to the matching `WeaponBallisticsProfile` so every inventory weapon has its own projectile visuals and casing ejection.
5. Assign imported aim/fire clips to the weapon animator configured in `WeaponGripPoseProfile` so each weapon can have its own grip, aim, fire, pump, bolt, reload, or launch animation.
6. Add every downloaded asset to the `PolyPizzaBattleRoyaleAssetCatalog` ScriptableObject and preserve creator/license/source URL before shipping.

## Token break setup

The realistic break system expects the target token to already be split into actual mesh fragments. Add `TokenPieceHealth`, a collider, and a Rigidbody to each real fragment. Keep the fragments parented under the token root and kinematic at rest; the final bullet detaches all actual pieces with impact-driven force instead of spawning fake made-up debris.

## Weapon ammo and impact profile

`BattleRoyaleWeaponDirector` now normalizes every `WeaponBallisticsProfile` at startup so firearms no longer all render as pellets. Keep the imported prefab assignments aligned with this table:

| Weapon | Projectile / payload | Ejected casing or shell | Impact behavior |
| --- | --- | --- | --- |
| Pistol | 9x19mm pistol round | 9x19mm brass casing | Compact bullet hit |
| SMG | 9x19mm SMG round | 9x19mm brass casing | Fast bullet hit |
| Rifle | 7.62x39mm rifle round | 7.62 rifle brass casing | Rifle bullet hit |
| Sniper | .308 sniper round | .308 long brass casing | Heavy bullet hit |
| Shotgun | 12 gauge buckshot | 12 gauge red hull | Only this weapon emits multiple pellets |
| Grenade launcher | 40mm HE grenade | 40mm launcher shell | Grenade explosion |
| Side missile | Guided side missile | Missile launch tube | Missile explosion |
| Strike drone | Drone micro missile | Drone launch pod | Drone missile blast |
| Attack helicopter | 70mm helicopter rocket | Rocket pod exhaust | Rocket blast |
| Strike jet | Air-to-ground missile | Jet hardpoint release | Jet strike explosion |

For the finishing shot, assign `finalShotAirRingPrefab` if you have an authored shock-ring mesh. If it is empty, the director spawns lightweight procedural rings around the final projectile, slows only that lead projectile, spins it, and then shatters every real `TokenPieceHealth` fragment on impact.
