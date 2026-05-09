using System;
using System.Collections.Generic;
using UnityEngine;

namespace TonPlaygram.Gameplay.Weapons
{
    public enum PolyPizzaBattleRoyaleAssetKind
    {
        Tank,
        Bullet,
        Shell,
        Weapon,
        WeaponAnimation,
        VehicleStrike,
        HandPoseReference,
        TextureSource
    }

    [Serializable]
    public sealed class PolyPizzaBattleRoyaleAssetEntry
    {
        public string displayName;
        public PolyPizzaBattleRoyaleAssetKind kind;
        public LudoWeaponType weaponType;
        public ProjectileVisualRole projectileRole;
        public string storeId;
        public string creator;
        public string license = "Creative Commons Attribution or CC0 as listed on the source page";
        public string sourceUrl;
        public string expectedImportFolder = "Assets/Art/PolyPizza/BattleRoyale";
        public bool preserveOriginalTextures = true;
        public StoreWeaponHoldStyle holdStyle = StoreWeaponHoldStyle.TwoHandLongGun;
        public string materialUpgradeNotes;
        public GameObject importedPrefab;
        public AnimationClip aimAnimation;
        public AnimationClip fireAnimation;
    }

    [CreateAssetMenu(menuName = "TonPlaygram/Ludo Battle Royale/Poly Pizza Asset Catalog", fileName = "PolyPizzaBattleRoyaleAssetCatalog")]
    public sealed class PolyPizzaBattleRoyaleAssetCatalog : ScriptableObject
    {
        [SerializeField] private List<PolyPizzaBattleRoyaleAssetEntry> assets = new List<PolyPizzaBattleRoyaleAssetEntry>();

        public IReadOnlyList<PolyPizzaBattleRoyaleAssetEntry> Assets => assets;

        public bool TryFindImportedPrefab(LudoWeaponType weaponType, PolyPizzaBattleRoyaleAssetKind kind, out GameObject prefab)
        {
            for (int i = 0; i < assets.Count; i++)
            {
                PolyPizzaBattleRoyaleAssetEntry entry = assets[i];
                if (entry == null || entry.weaponType != weaponType || entry.kind != kind || entry.importedPrefab == null)
                    continue;

                prefab = entry.importedPrefab;
                return true;
            }

            prefab = null;
            return false;
        }

        public bool TryFindImportedPrefab(string storeId, out GameObject prefab)
        {
            if (string.IsNullOrWhiteSpace(storeId))
            {
                prefab = null;
                return false;
            }

            for (int i = 0; i < assets.Count; i++)
            {
                PolyPizzaBattleRoyaleAssetEntry entry = assets[i];
                if (entry == null || entry.importedPrefab == null || !string.Equals(entry.storeId, storeId, StringComparison.OrdinalIgnoreCase))
                    continue;

                prefab = entry.importedPrefab;
                return true;
            }

            prefab = null;
            return false;
        }

        public IEnumerable<PolyPizzaBattleRoyaleAssetEntry> GetOpenSourceCandidates(LudoWeaponType weaponType)
        {
            for (int i = 0; i < assets.Count; i++)
            {
                PolyPizzaBattleRoyaleAssetEntry entry = assets[i];
                if (entry != null && entry.weaponType == weaponType)
                {
                    yield return entry;
                }
            }
        }

        [ContextMenu("Seed Recommended Poly Pizza Battle Royale Entries")]
        public void SeedRecommendedEntries()
        {
            assets.Clear();
            AddAsset("Fps Rig", PolyPizzaBattleRoyaleAssetKind.HandPoseReference, LudoWeaponType.Pistol, ProjectileVisualRole.Bullet, "poly-pizza-fps-rig-j-toastie", "J-Toastie", "Creative Commons Attribution", "https://poly.pizza/m/uxko5LkGia", "Assets/Art/PolyPizza/BattleRoyale/Animations/FpsRig_JToastie", true, StoreWeaponHoldStyle.TwoHandPistol, "Hide all renderers from this imported reference; use only its Glock/arms grip bones and muzzle orientation to retarget human hands.");
            AddAsset("Assault Rifle", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Rifle, ProjectileVisualRole.Bullet, "poly-pizza-assault-rifle-quaternius", "Quaternius", "Public Domain (CC0)", "https://poly.pizza/m/Bgvuu4CUMV", "Assets/Art/PolyPizza/BattleRoyale/Weapons/AssaultRifle_Quaternius", true, StoreWeaponHoldStyle.TwoHandLongGun, "Keep original GLTF textures, then optionally apply black metal PBR to receiver/barrel slots.");
            AddAsset("Rigged Glock 19", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Pistol, ProjectileVisualRole.Bullet, "poly-pizza-rigged-glock-19", "PuKkBuMXDD", "Creative Commons Attribution", "https://poly.pizza/m/gDhOo5jkNX", "Assets/Art/PolyPizza/BattleRoyale/Weapons/RiggedGlock19_PuKkBuMXDD", true, StoreWeaponHoldStyle.TwoHandPistol, "Preserve imported rig and textures; bind to the hidden FPS handgun grip template for hand orientation.");
            AddAsset("Rigged Desert Eagle", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Pistol, ProjectileVisualRole.Bullet, "poly-pizza-rigged-desert-eagle", "PuKkBuMXDD", "Creative Commons Attribution", "https://poly.pizza/m/e9k4dwOzCX", "Assets/Art/PolyPizza/BattleRoyale/Weapons/RiggedDesertEagle_PuKkBuMXDD", true, StoreWeaponHoldStyle.TwoHandPistol, "Preserve imported rig and textures; bind to the hidden FPS handgun grip template for hand orientation.");
            AddAsset("Sniper Rifle", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Sniper, ProjectileVisualRole.Bullet, "poly-pizza-sniper-rifle-quaternius", "Quaternius", "Public Domain (CC0)", "https://poly.pizza/m/i65hEldsw6", "Assets/Art/PolyPizza/BattleRoyale/Weapons/SniperRifle_Quaternius", true, StoreWeaponHoldStyle.TwoHandLongGun, "Use black metal PBR on barrel/scope and wood PBR on stock if material slots are separated.");
            AddAsset("Rifle", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Rifle, ProjectileVisualRole.Bullet, "poly-pizza-rifle-creativetrio", "CreativeTrio", "Public Domain (CC0)", "https://poly.pizza/m/zBATGslN2h", "Assets/Art/PolyPizza/BattleRoyale/Weapons/Rifle_CreativeTrio", true, StoreWeaponHoldStyle.TwoHandLongGun, "Preserve original texture import; upgrade plain metal/wood slots through RealisticWeaponMaterialApplier.");
            AddAsset("Submachine Gun", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.SMG, ProjectileVisualRole.Bullet, "poly-pizza-submachine-gun-creativetrio", "CreativeTrio", "Public Domain (CC0)", "https://poly.pizza/m/fQmBw1vNsl", "Assets/Art/PolyPizza/BattleRoyale/Weapons/SubmachineGun_CreativeTrio", true, StoreWeaponHoldStyle.TwoHandLongGun, "Preserve original texture import; upgrade plain metal slots through RealisticWeaponMaterialApplier.");
            AddAsset("Hand Grenade", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.HandGrenade, ProjectileVisualRole.Grenade, "poly-pizza-hand-grenade-creativetrio", "CreativeTrio", "Public Domain (CC0)", "https://poly.pizza/m/YWhHlmKOtx", "Assets/Art/PolyPizza/BattleRoyale/Weapons/HandGrenade_CreativeTrio", true, StoreWeaponHoldStyle.Throwable, "Use original GLTF textures for store preview and pickup.");
            AddAsset("Shotgun", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Shotgun, ProjectileVisualRole.Shell, "poly-pizza-shotgun-creativetrio", "CreativeTrio", "Public Domain (CC0)", "https://poly.pizza/m/CkSFaW2d7m", "Assets/Art/PolyPizza/BattleRoyale/Weapons/Shotgun_CreativeTrio", true, StoreWeaponHoldStyle.TwoHandLongGun, "Upgrade barrel to black metal PBR and stock/foregrip to wood PBR while retaining UVs.");
            AddAsset("Shotgun Double Barrel", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Shotgun, ProjectileVisualRole.Shell, "poly-pizza-shotgun-double-barrel", "CreativeTrio", "Public Domain (CC0)", "https://poly.pizza/m/k0fA37Awl8", "Assets/Art/PolyPizza/BattleRoyale/Weapons/ShotgunDoubleBarrel_CreativeTrio", true, StoreWeaponHoldStyle.TwoHandLongGun, "Upgrade barrels to black metal PBR and wooden parts to wood PBR while retaining UVs.");
            AddAsset("Gasoline Bomb", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.GasolineBomb, ProjectileVisualRole.Grenade, "poly-pizza-gasoline-bomb-creativetrio", "CreativeTrio", "Public Domain (CC0)", "https://poly.pizza/m/ew5DpDJJja", "Assets/Art/PolyPizza/BattleRoyale/Weapons/GasolineBomb_CreativeTrio", true, StoreWeaponHoldStyle.Throwable, "Use original glass/cloth texture import for store preview and pickup.");
            AddAsset("Rifle", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Rifle, ProjectileVisualRole.Bullet, "poly-pizza-rifle-quaternius", "Quaternius", "Public Domain (CC0)", "https://poly.pizza/m/cCAgiMOQow", "Assets/Art/PolyPizza/BattleRoyale/Weapons/Rifle_Quaternius", true, StoreWeaponHoldStyle.TwoHandLongGun, "Quaternius model: apply black metal PBR on metal slots and wood PBR on stock using original UVs.");
            AddAsset("Rifle Assault East", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Rifle, ProjectileVisualRole.Bullet, "poly-pizza-rifle-assault-east", "Pichuliru", "Public Domain (CC0)", "https://poly.pizza/m/xrJfQgAuDL", "Assets/Art/PolyPizza/BattleRoyale/Weapons/RifleAssaultEast_Pichuliru", true, StoreWeaponHoldStyle.TwoHandLongGun, "Preserve original GLTF textures and material slots.");
            AddAsset("Smg West", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.SMG, ProjectileVisualRole.Bullet, "poly-pizza-smg-west", "Pichuliru", "Public Domain (CC0)", "https://poly.pizza/m/7Dh5JSbZcp", "Assets/Art/PolyPizza/BattleRoyale/Weapons/SmgWest_Pichuliru", true, StoreWeaponHoldStyle.TwoHandLongGun, "Preserve original GLTF textures and material slots.");
            AddAsset("Frag Grenade East", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.HandGrenade, ProjectileVisualRole.Grenade, "poly-pizza-frag-grenade-east", "Pichuliru", "Public Domain (CC0)", "https://poly.pizza/m/C4ZrgKsmLq", "Assets/Art/PolyPizza/BattleRoyale/Weapons/FragGrenadeEast_Pichuliru", true, StoreWeaponHoldStyle.Throwable, "Use original GLTF textures for store preview and pickup.");
            AddAsset("Scarh", PolyPizzaBattleRoyaleAssetKind.Weapon, LudoWeaponType.Rifle, ProjectileVisualRole.Bullet, "poly-pizza-scarh-adamkokrito", "AdamKokrito", "Public Domain (CC0)", "https://poly.pizza/m/aBnHdYKj5K", "Assets/Art/PolyPizza/BattleRoyale/Weapons/Scarh_AdamKokrito", true, StoreWeaponHoldStyle.TwoHandLongGun, "Preserve separate Mag/Stock/Iron sights/Safety/Bolt/Charging handle parts and map PBR materials per part.");
            AddAsset("Black painted metal PBR", PolyPizzaBattleRoyaleAssetKind.TextureSource, LudoWeaponType.Rifle, ProjectileVisualRole.Bullet, "polyhaven-black-metal-pbr", "Poly Haven", "CC0/open-source texture per selected Poly Haven page", "https://polyhaven.com/textures", "Assets/Art/PolyHaven/Weapons/BlackMetal", false, StoreWeaponHoldStyle.TwoHandLongGun, "Use for Quaternius receivers, barrels, magazines, scopes, and black-painted weapon metal.");
            AddAsset("Wood PBR", PolyPizzaBattleRoyaleAssetKind.TextureSource, LudoWeaponType.Shotgun, ProjectileVisualRole.Shell, "polyhaven-wood-pbr", "Poly Haven or CC0 fallback", "CC0/open-source texture per selected source page", "https://polyhaven.com/textures", "Assets/Art/PolyHaven/Weapons/Wood", false, StoreWeaponHoldStyle.TwoHandLongGun, "Use for stocks, grips, and foregrips while preserving imported GLTF UV mapping.");
        }

        private void AddAsset(string displayName, PolyPizzaBattleRoyaleAssetKind kind, LudoWeaponType weaponType, ProjectileVisualRole projectileRole, string storeId, string creator, string license, string sourceUrl, string expectedImportFolder, bool preserveOriginalTextures, StoreWeaponHoldStyle holdStyle, string materialUpgradeNotes)
        {
            assets.Add(new PolyPizzaBattleRoyaleAssetEntry
            {
                displayName = displayName,
                kind = kind,
                weaponType = weaponType,
                projectileRole = projectileRole,
                storeId = storeId,
                creator = creator,
                license = license,
                sourceUrl = sourceUrl,
                expectedImportFolder = expectedImportFolder,
                preserveOriginalTextures = preserveOriginalTextures,
                holdStyle = holdStyle,
                materialUpgradeNotes = materialUpgradeNotes
            });
        }
    }
}
