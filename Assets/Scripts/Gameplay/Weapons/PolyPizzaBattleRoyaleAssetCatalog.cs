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
        VehicleStrike
    }

    [Serializable]
    public sealed class PolyPizzaBattleRoyaleAssetEntry
    {
        public string displayName;
        public PolyPizzaBattleRoyaleAssetKind kind;
        public LudoWeaponType weaponType;
        public ProjectileVisualRole projectileRole;
        public string creator;
        public string license = "Creative Commons Attribution or CC0 as listed on the source page";
        public string sourceUrl;
        public string expectedImportFolder = "Assets/Art/PolyPizza/BattleRoyale";
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
            assets.Add(new PolyPizzaBattleRoyaleAssetEntry
            {
                displayName = "Tank",
                kind = PolyPizzaBattleRoyaleAssetKind.Tank,
                weaponType = LudoWeaponType.SideMissile,
                projectileRole = ProjectileVisualRole.Missile,
                creator = "Zsky",
                sourceUrl = "https://poly.pizza/m/7GG1xDtc8l",
                license = "Creative Commons Attribution"
            });
            assets.Add(new PolyPizzaBattleRoyaleAssetEntry
            {
                displayName = "Bullet",
                kind = PolyPizzaBattleRoyaleAssetKind.Bullet,
                weaponType = LudoWeaponType.Rifle,
                projectileRole = ProjectileVisualRole.Bullet,
                creator = "Poly by Google",
                sourceUrl = "https://poly.pizza/search/bullet"
            });
            assets.Add(new PolyPizzaBattleRoyaleAssetEntry
            {
                displayName = "9x19mm",
                kind = PolyPizzaBattleRoyaleAssetKind.Bullet,
                weaponType = LudoWeaponType.Pistol,
                projectileRole = ProjectileVisualRole.Bullet,
                creator = "J-Toastie",
                sourceUrl = "https://poly.pizza/search/bullet"
            });
            assets.Add(new PolyPizzaBattleRoyaleAssetEntry
            {
                displayName = "Shotgun rounds",
                kind = PolyPizzaBattleRoyaleAssetKind.Shell,
                weaponType = LudoWeaponType.Shotgun,
                projectileRole = ProjectileVisualRole.Shell,
                creator = "Poly by Google",
                sourceUrl = "https://poly.pizza/search/bullet"
            });
            assets.Add(new PolyPizzaBattleRoyaleAssetEntry
            {
                displayName = "Missile",
                kind = PolyPizzaBattleRoyaleAssetKind.Bullet,
                weaponType = LudoWeaponType.SideMissile,
                projectileRole = ProjectileVisualRole.Missile,
                creator = "Poly by Google",
                sourceUrl = "https://poly.pizza/search/bullet"
            });
            assets.Add(new PolyPizzaBattleRoyaleAssetEntry
            {
                displayName = "Fps Rig AKM",
                kind = PolyPizzaBattleRoyaleAssetKind.WeaponAnimation,
                weaponType = LudoWeaponType.Rifle,
                projectileRole = ProjectileVisualRole.Bullet,
                creator = "J-Toastie",
                sourceUrl = "https://poly.pizza/search/gun%20animation"
            });
            assets.Add(new PolyPizzaBattleRoyaleAssetEntry
            {
                displayName = "Animated Pistol",
                kind = PolyPizzaBattleRoyaleAssetKind.WeaponAnimation,
                weaponType = LudoWeaponType.Pistol,
                projectileRole = ProjectileVisualRole.Bullet,
                creator = "Quaternius",
                sourceUrl = "https://poly.pizza/search/gun%20animation"
            });
        }
    }
}
