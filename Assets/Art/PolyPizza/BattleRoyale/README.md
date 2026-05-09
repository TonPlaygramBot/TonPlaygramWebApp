# Ludo Battle Royale Poly Pizza asset intake

Use this folder for the open-source Poly Pizza GLB/GLTF/FBX files that back the Ludo Battle Royale weapons, tank pickups, bullets, shells, and hidden hand-pose references.

## Source candidates checked on 2026-05-09

- Poly Pizza model pages list FBX/GLTF availability and per-asset licensing.
- Hidden handgun/hand-pose logic: `https://poly.pizza/m/uxko5LkGia` (`Fps Rig` by J-Toastie, Creative Commons Attribution). Import it only as a non-visible reference rig; assign it to `FpsGunHumanHandRetargeter`, hide every renderer from the imported reference, and use its Glock/arms sockets to orient the visible human hands and handguns.
- Store weapon sources:
  - `https://poly.pizza/m/Bgvuu4CUMV` Assault Rifle, Quaternius, CC0.
  - `https://poly.pizza/m/gDhOo5jkNX` Rigged Glock 19, PuKkBuMXDD, Creative Commons Attribution.
  - `https://poly.pizza/m/e9k4dwOzCX` Rigged Desert Eagle, PuKkBuMXDD, Creative Commons Attribution.
  - `https://poly.pizza/m/i65hEldsw6` Sniper Rifle, Quaternius, CC0.
  - `https://poly.pizza/m/zBATGslN2h` Rifle, CreativeTrio, CC0.
  - `https://poly.pizza/m/fQmBw1vNsl` Submachine Gun, CreativeTrio, CC0.
  - `https://poly.pizza/m/YWhHlmKOtx` Hand Grenade, CreativeTrio, CC0.
  - `https://poly.pizza/m/CkSFaW2d7m` Shotgun, CreativeTrio, CC0.
  - `https://poly.pizza/m/k0fA37Awl8` Shotgun Double Barrel, CreativeTrio, CC0.
  - `https://poly.pizza/m/ew5DpDJJja` Gasoline Bomb, CreativeTrio, CC0.
  - `https://poly.pizza/m/cCAgiMOQow` Rifle, Quaternius, CC0.
  - `https://poly.pizza/m/xrJfQgAuDL` Rifle Assault East, Pichuliru, CC0.
  - `https://poly.pizza/m/7Dh5JSbZcp` Smg West, Pichuliru, CC0.
  - `https://poly.pizza/m/C4ZrgKsmLq` Frag Grenade East, Pichuliru, CC0.
  - `https://poly.pizza/m/aBnHdYKj5K` Scarh, AdamKokrito, CC0.
- Tanks: `https://poly.pizza/search/tank` and the Zsky tank page `https://poly.pizza/m/7GG1xDtc8l`.
- Bullets and shells: `https://poly.pizza/search/bullet` includes Bullet, 7.62x39mm, 9x19mm, Shotgun rounds, Missile, Bullet Cartridge, Pistol Ammo, and ammo-box candidates.
- Weapon/hand animation sources: `https://poly.pizza/search/gun%20animation` includes Animated Pistol, Fps Rig AKM, Fps Rig, Rigged FPS Arms, Rigged Glock, and similar open-source candidates.

## Import rules

1. Download only models whose source page permits the target use. Prefer CC0; keep attribution for Creative Commons Attribution assets.
2. Store raw downloads in subfolders by role: `Tanks/`, `Bullets/`, `Shells/`, `Weapons/`, and `Animations/`.
3. Preserve original Poly Pizza GLTF textures for every imported store weapon before any material upgrade.
4. Create prefabs with stable names such as `BR_Rifle_Bullet.prefab`, `BR_Shotgun_Shell.prefab`, and `BR_Tank_Zsky.prefab`.
5. Assign each bullet/shell prefab to the matching `WeaponBallisticsProfile` so every inventory weapon has its own projectile visuals and casing ejection.
6. Assign imported aim/fire clips to the weapon animator configured in `WeaponGripPoseProfile` so each weapon can have its own grip, aim, fire, pump, bolt, reload, or launch animation.
7. Add every downloaded asset to the `PolyPizzaBattleRoyaleAssetCatalog` ScriptableObject and preserve creator/license/source URL before shipping.
8. For the hidden `Fps Rig` handgun reference, assign its hand mesh roots and weapon mesh roots to the retargeter hide lists. The reference asset must not be visible in gameplay or the store.

## Quaternius material upgrade rules

- Keep the original GLTF mesh, UV mapping, renderer hierarchy, and material slot count.
- Use `RealisticWeaponMaterialApplier` on Quaternius weapon prefabs to swap plain material slots to high-quality PBR materials without changing geometry.
- Use open-source/CC0 black painted metal PBR textures from Poly Haven for barrels, receivers, magazines, scopes, and other metal parts.
- Use open-source/CC0 wood PBR textures from Poly Haven, or another free source only if Poly Haven lacks the needed wood style, for stocks, grips, and foregrips.
- Keep texture citations in the material asset names or prefab notes so credits can be audited.

## Token break setup

The realistic break system expects the target token to already be split into actual mesh fragments. Add `TokenPieceHealth`, a collider, and a Rigidbody to each real fragment. Keep the fragments parented under the token root and kinematic at rest; the final bullet detaches all actual pieces with impact-driven force instead of spawning fake made-up debris.
