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

    [Serializable]
    public sealed class StoreWeaponEntry
    {
        public LudoWeaponType weaponType;
        public string gltfStoreId;
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
            }

            return true;
        }

        public bool PurchaseWeapon(LudoWeaponType weaponType)
        {
            bool existsInStore = storeWeapons.Exists(x => x.weaponType == weaponType);
            if (!existsInStore)
            {
                return false;
            }

            _ownedWeapons.Add(weaponType);
            return true;
        }

        public bool OwnsWeapon(LudoWeaponType weaponType) => _ownedWeapons.Contains(weaponType);

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

        private void BootstrapInventory()
        {
            for (int i = 0; i < storeWeapons.Count; i++)
            {
                StoreWeaponEntry entry = storeWeapons[i];
                if (entry != null && entry.grantedByDefault)
                {
                    _ownedWeapons.Add(entry.weaponType);
                }
            }
        }
    }
}
