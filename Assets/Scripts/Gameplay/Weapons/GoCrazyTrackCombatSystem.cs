using System;
using System.Collections.Generic;
using UnityEngine;

namespace TonPlaygram.Gameplay.Weapons
{
    public enum DefenseType
    {
        MissileRadar,
        DroneRadar,
        AntiMissileBattery
    }

    public enum StoreWeaponHoldStyle
    {
        OneHandPistol,
        TwoHandPistol,
        TwoHandLongGun,
        Throwable
    }

    [Serializable]
    public sealed class StoreWeaponEntry
    {
        public LudoWeaponType weaponType;
        public string gltfStoreId;
        public string displayName;
        public string creator;
        public string sourceUrl;
        public string license = "Public Domain (CC0) unless the source page says otherwise";
        public string originalTextureFolder = "Assets/Art/PolyPizza/BattleRoyale/Weapons";
        public StoreWeaponHoldStyle holdStyle = StoreWeaponHoldStyle.TwoHandLongGun;
        public GameObject storePreviewPrefab;
        public int softCurrencyPrice = 100;
        public bool grantedByDefault;
    }

    public sealed class GoCrazyTrackCombatSystem : MonoBehaviour
    {
        [Header("Scene refs")]
        [SerializeField] private BattleRoyaleWeaponDirector weaponDirector;

        [Header("Track + progression")]
        [SerializeField] private float trackLengthMultiplier = 2f;
        [SerializeField] private float trackWidthMultiplier = 1.45f;

        [Header("Store Catalog")]
        [SerializeField] private List<StoreWeaponEntry> storeWeapons = new List<StoreWeaponEntry>();

        private readonly HashSet<LudoWeaponType> _ownedWeapons = new HashSet<LudoWeaponType>();
        private readonly HashSet<string> _ownedStoreWeaponIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<DefenseType> _ownedDefenses = new HashSet<DefenseType>();

        public float TrackLengthMultiplier => trackLengthMultiplier;
        public float TrackWidthMultiplier => trackWidthMultiplier;

        private void Awake()
        {
            BootstrapInventory();
        }

        public bool CollectWeaponPickup(string pickupWeaponId)
        {
            if (weaponDirector == null)
            {
                return false;
            }

            if (!weaponDirector.TryEquipByPickup(pickupWeaponId))
            {
                return false;
            }

            if (Enum.TryParse(pickupWeaponId, true, out LudoWeaponType weaponType))
            {
                _ownedWeapons.Add(weaponType);
                _ownedStoreWeaponIds.Add(pickupWeaponId);
            }

            return true;
        }

        public bool PurchaseWeapon(LudoWeaponType weaponType)
        {
            StoreWeaponEntry entry = FindStoreWeapon(weaponType);
            if (entry == null)
            {
                return false;
            }

            GrantStoreWeapon(entry);
            return true;
        }

        public bool PurchaseWeapon(string gltfStoreId)
        {
            StoreWeaponEntry entry = FindStoreWeapon(gltfStoreId);
            if (entry == null)
            {
                return false;
            }

            GrantStoreWeapon(entry);
            return true;
        }

        public bool OwnsWeapon(LudoWeaponType weaponType) => _ownedWeapons.Contains(weaponType);

        public bool OwnsStoreWeapon(string gltfStoreId)
        {
            StoreWeaponEntry entry = FindStoreWeapon(gltfStoreId);
            return entry != null && _ownedStoreWeaponIds.Contains(entry.gltfStoreId);
        }

        public IReadOnlyList<StoreWeaponEntry> StoreWeapons => storeWeapons;

        public void ActivateDefense(DefenseType defenseType)
        {
            _ownedDefenses.Add(defenseType);
        }

        public bool CanBlockAttack(LudoWeaponType incomingWeaponType)
        {
            switch (incomingWeaponType)
            {
                case LudoWeaponType.SideMissile:
                    return _ownedDefenses.Contains(DefenseType.MissileRadar) || _ownedDefenses.Contains(DefenseType.AntiMissileBattery);
                case LudoWeaponType.StrikeDrone:
                    return _ownedDefenses.Contains(DefenseType.DroneRadar) || _ownedDefenses.Contains(DefenseType.AntiMissileBattery);
                case LudoWeaponType.AttackHelicopter:
                case LudoWeaponType.StrikeJet:
                    return _ownedDefenses.Contains(DefenseType.AntiMissileBattery);
                default:
                    return false;
            }
        }

        private StoreWeaponEntry FindStoreWeapon(LudoWeaponType weaponType)
        {
            for (int i = 0; i < storeWeapons.Count; i++)
            {
                StoreWeaponEntry entry = storeWeapons[i];
                if (entry != null && entry.weaponType == weaponType)
                {
                    return entry;
                }
            }

            return null;
        }

        private StoreWeaponEntry FindStoreWeapon(string gltfStoreId)
        {
            if (string.IsNullOrWhiteSpace(gltfStoreId))
            {
                return null;
            }

            for (int i = 0; i < storeWeapons.Count; i++)
            {
                StoreWeaponEntry entry = storeWeapons[i];
                if (entry != null && string.Equals(entry.gltfStoreId, gltfStoreId, StringComparison.OrdinalIgnoreCase))
                {
                    return entry;
                }
            }

            return null;
        }

        private void BootstrapInventory()
        {
            for (int i = 0; i < storeWeapons.Count; i++)
            {
                StoreWeaponEntry entry = storeWeapons[i];
                if (entry != null && entry.grantedByDefault)
                {
                    GrantStoreWeapon(entry);
                }
            }
        }

        private void GrantStoreWeapon(StoreWeaponEntry entry)
        {
            if (entry == null)
            {
                return;
            }

            _ownedWeapons.Add(entry.weaponType);
            if (!string.IsNullOrWhiteSpace(entry.gltfStoreId))
            {
                _ownedStoreWeaponIds.Add(entry.gltfStoreId);
            }
        }

        [ContextMenu("Seed Poly Pizza Weapon Store Entries")]
        public void SeedPolyPizzaWeaponStoreEntries()
        {
            storeWeapons.Clear();
            AddStoreWeapon(LudoWeaponType.Rifle, "poly-pizza-assault-rifle-quaternius", "Assault Rifle", "Quaternius", "https://poly.pizza/m/Bgvuu4CUMV", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, true, 100);
            AddStoreWeapon(LudoWeaponType.Pistol, "poly-pizza-rigged-glock-19", "Rigged Glock 19", "PuKkBuMXDD", "https://poly.pizza/m/gDhOo5jkNX", "Creative Commons Attribution", StoreWeaponHoldStyle.TwoHandPistol, false, 125);
            AddStoreWeapon(LudoWeaponType.Pistol, "poly-pizza-rigged-desert-eagle", "Rigged Desert Eagle", "PuKkBuMXDD", "https://poly.pizza/m/e9k4dwOzCX", "Creative Commons Attribution", StoreWeaponHoldStyle.TwoHandPistol, false, 150);
            AddStoreWeapon(LudoWeaponType.Sniper, "poly-pizza-sniper-rifle-quaternius", "Sniper Rifle", "Quaternius", "https://poly.pizza/m/i65hEldsw6", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 180);
            AddStoreWeapon(LudoWeaponType.Rifle, "poly-pizza-rifle-creativetrio", "Rifle", "CreativeTrio", "https://poly.pizza/m/zBATGslN2h", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 130);
            AddStoreWeapon(LudoWeaponType.SMG, "poly-pizza-submachine-gun-creativetrio", "Submachine Gun", "CreativeTrio", "https://poly.pizza/m/fQmBw1vNsl", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 140);
            AddStoreWeapon(LudoWeaponType.HandGrenade, "poly-pizza-hand-grenade-creativetrio", "Hand Grenade", "CreativeTrio", "https://poly.pizza/m/YWhHlmKOtx", "Public Domain (CC0)", StoreWeaponHoldStyle.Throwable, false, 90);
            AddStoreWeapon(LudoWeaponType.Shotgun, "poly-pizza-shotgun-creativetrio", "Shotgun", "CreativeTrio", "https://poly.pizza/m/CkSFaW2d7m", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 155);
            AddStoreWeapon(LudoWeaponType.Shotgun, "poly-pizza-shotgun-double-barrel", "Shotgun Double Barrel", "CreativeTrio", "https://poly.pizza/m/k0fA37Awl8", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 165);
            AddStoreWeapon(LudoWeaponType.GasolineBomb, "poly-pizza-gasoline-bomb-creativetrio", "Gasoline Bomb", "CreativeTrio", "https://poly.pizza/m/ew5DpDJJja", "Public Domain (CC0)", StoreWeaponHoldStyle.Throwable, false, 100);
            AddStoreWeapon(LudoWeaponType.Rifle, "poly-pizza-rifle-quaternius", "Rifle", "Quaternius", "https://poly.pizza/m/cCAgiMOQow", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 135);
            AddStoreWeapon(LudoWeaponType.Rifle, "poly-pizza-rifle-assault-east", "Rifle Assault East", "Pichuliru", "https://poly.pizza/m/xrJfQgAuDL", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 145);
            AddStoreWeapon(LudoWeaponType.SMG, "poly-pizza-smg-west", "Smg West", "Pichuliru", "https://poly.pizza/m/7Dh5JSbZcp", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 145);
            AddStoreWeapon(LudoWeaponType.HandGrenade, "poly-pizza-frag-grenade-east", "Frag Grenade East", "Pichuliru", "https://poly.pizza/m/C4ZrgKsmLq", "Public Domain (CC0)", StoreWeaponHoldStyle.Throwable, false, 95);
            AddStoreWeapon(LudoWeaponType.Rifle, "poly-pizza-scarh-adamkokrito", "Scarh", "AdamKokrito", "https://poly.pizza/m/aBnHdYKj5K", "Public Domain (CC0)", StoreWeaponHoldStyle.TwoHandLongGun, false, 175);
        }

        private void AddStoreWeapon(LudoWeaponType weaponType, string gltfStoreId, string displayName, string creator, string sourceUrl, string license, StoreWeaponHoldStyle holdStyle, bool grantedByDefault, int softCurrencyPrice)
        {
            storeWeapons.Add(new StoreWeaponEntry
            {
                weaponType = weaponType,
                gltfStoreId = gltfStoreId,
                displayName = displayName,
                creator = creator,
                sourceUrl = sourceUrl,
                license = license,
                holdStyle = holdStyle,
                grantedByDefault = grantedByDefault,
                softCurrencyPrice = softCurrencyPrice
            });
        }
    }
}
