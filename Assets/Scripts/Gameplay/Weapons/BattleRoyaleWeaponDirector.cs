using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TonPlaygram.Gameplay.Weapons
{
    public enum WeaponFireMode
    {
        Single,
        MagazineAuto
    }

    public enum LudoWeaponType
    {
        Rifle,
        SMG,
        Pistol,
        Shotgun,
        Sniper,
        GrenadeLauncher,
        SideMissile,
        StrikeDrone,
        AttackHelicopter,
        StrikeJet
    }

    public enum LudoAmmoVisualType
    {
        NineMillimeter,
        FiveFiveSixRifle,
        SevenSixTwoRifle,
        ShotgunShell,
        SniperRound,
        GrenadeRound,
        Rocket,
        Missile,
        EnergyCell
    }

    [Serializable]
    public sealed class LudoWeaponGripPose
    {
        [Tooltip("Right hand offset measured back from the muzzle along the aiming direction.")]
        public float rightHandBackFromMuzzle = 0.12f;

        [Tooltip("Left support hand offset measured back from the muzzle along the aiming direction.")]
        public float leftHandBackFromMuzzle = 0.06f;

        [Tooltip("Left support hand offset to the visible left side of the weapon.")]
        public float leftHandSideOffset = 0.06f;

        [Tooltip("Raises/lowers both grip sockets in world space for chunky launchers/tanks.")]
        public float handLift = 0f;

        [Tooltip("Extra local offset applied by the human retargeter when this weapon is equipped.")]
        public Vector3 retargetGripPositionOffset;

        [Tooltip("Extra local Euler offset applied by the human retargeter when this weapon is equipped.")]
        public Vector3 retargetGripEulerOffset;
    }

    [Serializable]
    public sealed class LudoWeaponAnimationProfile
    {
        [Tooltip("Animator on the visible weapon or imported open-source weapon rig.")]
        public Animator weaponAnimator;

        [Tooltip("Trigger fired when the player equips/swaps to this weapon.")]
        public string equipTrigger = "Equip";

        [Tooltip("Trigger fired for every shot so each weapon can use its own recoil/bolt/pump animation.")]
        public string fireTrigger = "Fire";

        [Tooltip("Trigger fired once after the final round when a reload/settle animation exists.")]
        public string reloadTrigger = "Reload";

        public AnimationClip equipClip;
        public AnimationClip fireClip;
        public AnimationClip reloadClip;

        public void PlayEquip() => PlayTrigger(equipTrigger, equipClip);

        public void PlayFire() => PlayTrigger(fireTrigger, fireClip);

        public void PlayReload() => PlayTrigger(reloadTrigger, reloadClip);

        private void PlayTrigger(string triggerName, AnimationClip fallbackClip)
        {
            if (weaponAnimator == null)
                return;

            if (!string.IsNullOrWhiteSpace(triggerName))
            {
                weaponAnimator.ResetTrigger(triggerName);
                weaponAnimator.SetTrigger(triggerName);
                return;
            }

            if (fallbackClip != null)
            {
                weaponAnimator.Play(fallbackClip.name, 0, 0f);
            }
        }
    }

    [Serializable]
    public sealed class WeaponBallisticsProfile
    {
        public LudoWeaponType weaponType = LudoWeaponType.Rifle;
        public WeaponFireMode fireMode = WeaponFireMode.MagazineAuto;
        public int magazineSize = 30;
        public float roundsPerSecond = 10f;
        public float muzzleVelocity = 220f;
        public float spread = 0.012f;
        public float bulletScale = 1f;
        public float shellScale = 1f;
        public bool usesPellets = false;
        public int pelletsPerShot = 1;
        public float pelletSpread = 0.012f;
        public float aimFov = 40f;
        public float aimTransitionSeconds = 0.08f;
        public float impactFollowSeconds = 1.15f;
        public LudoAmmoVisualType ammoVisualType = LudoAmmoVisualType.FiveFiveSixRifle;
        [Tooltip("Visible weapon GLB/GLTF prefab imported from the asset catalog (Poly Pizza, Gunify, etc.).")]
        public GameObject weaponPrefab;
        public GameObject bulletPrefab;
        public GameObject shellPrefab;
        [Tooltip("Optional separate casing prefab. Falls back to shellPrefab when empty.")]
        public GameObject casingPrefab;
        public AudioClip shotSfx;
        public bool requiresAerialStrike;
        public LudoWeaponGripPose gripPose = new LudoWeaponGripPose();
        public LudoWeaponAnimationProfile animationProfile = new LudoWeaponAnimationProfile();
        [Header("Shell ejection")]
        public float shellMass = 0.02f;
        public Vector2 shellEjectSpeedRange = new Vector2(1.8f, 3.1f);
        public Vector2 shellEjectLiftRange = new Vector2(0.8f, 1.3f);
        public float shellTumble = 13f;
        public float shellLifetime = 5f;
        [Header("Token fracture")]
        public float nonFinalBreakForce = 3.5f;
        public float finalBreakForce = 8f;
        public float breakRadius = 2f;
    }

    public interface ILudoWeaponEvents
    {
        void OnWeaponEquipped(LudoWeaponType weaponType);
        void OnWeaponShot(LudoWeaponType weaponType, int shotIndex, int totalShots);
        void OnFinalImpact(LudoWeaponType weaponType, Vector3 impactPoint);
    }

    public interface ILudoProjectileBroadcastEvents
    {
        void OnProjectileSpawned(LudoWeaponType weaponType, int shotIndex, int pelletIndex, Vector3 origin, Vector3 velocity);
        void OnProjectileUpdated(LudoWeaponType weaponType, int shotIndex, int pelletIndex, Vector3 position, Vector3 velocity);
        void OnProjectileImpact(LudoWeaponType weaponType, int shotIndex, int pelletIndex, Vector3 impactPoint);
    }

    public sealed class BattleRoyaleWeaponDirector : MonoBehaviour
    {
        [Header("Scene refs")]
        [SerializeField] private Camera playerCamera;
        [SerializeField] private Transform muzzle;
        [SerializeField] private Transform shellEject;
        [SerializeField] private Transform targetTokenRoot;
        [SerializeField] private AudioSource sfxSource;
        [SerializeField] private Transform attackerCameraAnchor;
        [SerializeField] private Transform liveTargetTransform;
        [SerializeField] private Transform weaponRoot;
        [SerializeField] private Transform tableWeaponAnchor;
        [SerializeField] private Transform weaponSwapIcon;
        [SerializeField] private Transform rightHandGrip;
        [SerializeField] private Transform leftHandGrip;
        [SerializeField] private FpsGunHumanHandRetargeter humanHandRetargeter;

        [Header("Weapon presets")]
        [SerializeField] private List<WeaponBallisticsProfile> weaponProfiles = new List<WeaponBallisticsProfile>();
        [SerializeField] private LudoWeaponType startingWeapon = LudoWeaponType.Rifle;

        [Header("Damage progression")]
        [SerializeField] private int minorPiecesPerNonFinalShot = 3;

        [Header("Camera anchors")]
        [SerializeField] private Vector3 firstPersonAimOffset = new Vector3(0.08f, -0.04f, 0.18f);
        [SerializeField] private float aimPositionLerp = 20f;
        [SerializeField] private bool followAllBullets = true;
        [SerializeField] private bool forceAttackerAimAnchor = true;
        [SerializeField] private float bulletFollowDistance = 0.4f;
        [SerializeField] private float bulletFollowHeight = 0.14f;
        [SerializeField] private float cameraLookLerp = 18f;
        [SerializeField] private float cameraTrackLerp = 15f;
        [SerializeField] private Vector3 swapIconWorldOffset = new Vector3(0f, 0.11f, 0f);
        [SerializeField] private bool allowDynamicCameraOnlyDuringAnimation = true;
        [SerializeField] private float turnFocusDuration = 0.22f;


        private readonly Dictionary<LudoWeaponType, WeaponBallisticsProfile> _profiles = new Dictionary<LudoWeaponType, WeaponBallisticsProfile>();
        private readonly List<TokenPieceHealth> _tokenPieces = new List<TokenPieceHealth>();

        private WeaponBallisticsProfile _activeWeapon;
        private Coroutine _fireRoutine;
        private Coroutine _cameraRoutine;
        private ILudoWeaponEvents[] _eventListeners = Array.Empty<ILudoWeaponEvents>();
        private ILudoProjectileBroadcastEvents[] _projectileListeners = Array.Empty<ILudoProjectileBroadcastEvents>();
        private float _baseFov = 60f;
        private Vector3 _baseCameraLocalPos;
        private Transform _baseCameraParent;
        private Quaternion _baseCameraLocalRot;
        private Vector3 _weaponRootLocalPos;
        private Quaternion _weaponRootLocalRot;
        private Vector3 _swapIconWorldPos;
        private Quaternion _swapIconWorldRot;
        private bool _isAnimationCameraActive;
        private GameObject _equippedWeaponInstance;

        private void Awake()
        {
            if (playerCamera == null)
            {
                playerCamera = Camera.main;
            }

            if (sfxSource == null)
            {
                sfxSource = GetComponent<AudioSource>();
            }

            if (humanHandRetargeter == null)
            {
                humanHandRetargeter = GetComponentInChildren<FpsGunHumanHandRetargeter>(true);
            }

            if (playerCamera != null)
            {
                _baseFov = playerCamera.fieldOfView;
                _baseCameraLocalPos = playerCamera.transform.localPosition;
                _baseCameraParent = playerCamera.transform.parent;
                _baseCameraLocalRot = playerCamera.transform.localRotation;
            }

            BuildProfileMap();
            CacheTokenPieces();
            CacheStaticAnchors();
            _eventListeners = GetComponentsInParent<ILudoWeaponEvents>(true);
            _projectileListeners = GetComponentsInParent<ILudoProjectileBroadcastEvents>(true);
            Equip(startingWeapon);
        }

        public void Equip(LudoWeaponType weaponType)
        {
            if (!_profiles.TryGetValue(weaponType, out var profile))
            {
                Debug.LogWarning($"Missing profile for weapon {weaponType}");
                return;
            }

            _activeWeapon = profile;
            EquipWeaponVisual(profile);
            ApplyRetargetGrip(profile);
            profile.animationProfile?.PlayEquip();
            for (int i = 0; i < _eventListeners.Length; i++)
            {
                _eventListeners[i].OnWeaponEquipped(weaponType);
            }
        }

        public void FireAtToken()
        {
            if (_activeWeapon == null || muzzle == null || targetTokenRoot == null)
                return;

            if (_fireRoutine != null)
            {
                StopCoroutine(_fireRoutine);
            }

            _fireRoutine = StartCoroutine(FireRoutine(_activeWeapon));
        }

        public bool TryEquipByPickup(string pickupWeaponId)
        {
            if (string.IsNullOrWhiteSpace(pickupWeaponId))
            {
                return false;
            }

            if (!System.Enum.TryParse(pickupWeaponId, true, out LudoWeaponType weaponType))
            {
                return false;
            }

            Equip(weaponType);
            return true;
        }

        private IEnumerator FireRoutine(WeaponBallisticsProfile weapon)
        {
            int shots = weapon.fireMode == WeaponFireMode.Single ? 1 : Mathf.Max(1, weapon.magazineSize);
            float shotDelay = weapon.roundsPerSecond <= 0.001f ? 0f : 1f / weapon.roundsPerSecond;

            _isAnimationCameraActive = true;
            BeginAimCamera(weapon);

            for (int i = 0; i < shots; i++)
            {
                bool isLastBullet = i == shots - 1;
                FireSingleRound(weapon, i, shots, isLastBullet);
                if (shotDelay > 0f)
                {
                    yield return new WaitForSeconds(shotDelay);
                }
            }

            if (_cameraRoutine == null)
            {
                yield return StartCoroutine(ReturnCameraToDefault());
            }
        }

        private void FireSingleRound(WeaponBallisticsProfile weapon, int shotIndex, int totalShots, bool isLastBullet)
        {
            Vector3 directionToTarget = (targetTokenRoot.position - muzzle.position).normalized;
            Vector3 spreadVec = UnityEngine.Random.insideUnitSphere * weapon.spread;
            Vector3 shotDirection = (directionToTarget + spreadVec).normalized;
            RefreshWeaponPose(shotDirection);

            weapon.animationProfile?.PlayFire();
            SpawnProjectiles(weapon, shotDirection, isLastBullet, shotIndex, totalShots);
            SpawnShell(weapon);
            PlayShotSfx(weapon);

            if (isLastBullet)
            {
                weapon.animationProfile?.PlayReload();
            }

            for (int i = 0; i < _eventListeners.Length; i++)
            {
                _eventListeners[i].OnWeaponShot(weapon.weaponType, shotIndex, totalShots);
            }
        }

        private void SpawnProjectiles(WeaponBallisticsProfile weapon, Vector3 direction, bool isLastBullet, int shotIndex, int totalShots)
        {
            if (weapon.bulletPrefab == null)
                return;

            int pelletCount = weapon.usesPellets ? Mathf.Max(1, weapon.pelletsPerShot) : 1;
            float pelletScale = ResolveProjectileScale(weapon);
            float spreadAmount = weapon.usesPellets ? weapon.pelletSpread : weapon.spread;

            for (int pelletIndex = 0; pelletIndex < pelletCount; pelletIndex++)
            {
                Vector3 randomSpread = UnityEngine.Random.insideUnitSphere * spreadAmount;
                Vector3 pelletDirection = (direction + randomSpread).normalized;
                GameObject bulletObj = Instantiate(weapon.bulletPrefab, muzzle.position, Quaternion.LookRotation(pelletDirection));
                bulletObj.transform.localScale *= pelletScale;

                BattleRoyaleBullet bullet = bulletObj.GetComponent<BattleRoyaleBullet>();
                if (bullet == null)
                {
                    bullet = bulletObj.AddComponent<BattleRoyaleBullet>();
                }

                bool isLeadPellet = pelletIndex == 0;
                bool shouldFollowBullet = isLeadPellet && (followAllBullets || isLastBullet || weapon.usesPellets);
                bullet.Initialize(pelletDirection * weapon.muzzleVelocity, this, weapon.weaponType, shotIndex, pelletIndex, isLastBullet, shouldFollowBullet, weapon.impactFollowSeconds);
                BroadcastProjectileSpawned(weapon.weaponType, shotIndex, pelletIndex, muzzle.position, pelletDirection * weapon.muzzleVelocity);
                if (shouldFollowBullet)
                {
                    StartBulletFollowCamera(bullet.transform, shotIndex == totalShots - 1 ? weapon.impactFollowSeconds : Mathf.Min(weapon.impactFollowSeconds, 0.35f));
                }
            }
        }

        private float ResolveProjectileScale(WeaponBallisticsProfile weapon)
        {
            if (!weapon.usesPellets)
            {
                return weapon.bulletScale;
            }

            if (_profiles.TryGetValue(LudoWeaponType.Shotgun, out var shotgunProfile) && shotgunProfile != null)
            {
                return shotgunProfile.bulletScale;
            }

            return weapon.bulletScale;
        }

        private void SpawnShell(WeaponBallisticsProfile weapon)
        {
            if (weapon.shellPrefab == null || shellEject == null)
                return;

            GameObject shellSource = weapon.casingPrefab != null ? weapon.casingPrefab : weapon.shellPrefab;
            GameObject shellObj = Instantiate(shellSource, shellEject.position, shellEject.rotation);
            shellObj.transform.localScale *= weapon.shellScale;

            Rigidbody rb = shellObj.GetComponent<Rigidbody>();
            if (rb == null)
            {
                rb = shellObj.AddComponent<Rigidbody>();
            }

            rb.mass = Mathf.Max(0.001f, weapon.shellMass);
            rb.velocity = (shellEject.right * UnityEngine.Random.Range(weapon.shellEjectSpeedRange.x, weapon.shellEjectSpeedRange.y))
                + (Vector3.up * UnityEngine.Random.Range(weapon.shellEjectLiftRange.x, weapon.shellEjectLiftRange.y));
            rb.angularVelocity = UnityEngine.Random.insideUnitSphere * weapon.shellTumble;
            Destroy(shellObj, Mathf.Max(0.25f, weapon.shellLifetime));
        }

        private void PlayShotSfx(WeaponBallisticsProfile weapon)
        {
            if (sfxSource != null && weapon.shotSfx != null)
            {
                sfxSource.PlayOneShot(weapon.shotSfx);
            }
        }

        public void OnBulletImpact(Vector3 point, bool isLastBullet)
        {
            ApplyProgressiveDamage(point, isLastBullet, _activeWeapon);
            if (isLastBullet)
            {
                StartFinalImpactCamera(point);
                for (int i = 0; i < _eventListeners.Length; i++)
                {
                    _eventListeners[i].OnFinalImpact(_activeWeapon.weaponType, point);
                }
            }
        }

        public void BroadcastProjectileUpdated(LudoWeaponType weaponType, int shotIndex, int pelletIndex, Vector3 position, Vector3 velocity)
        {
            for (int i = 0; i < _projectileListeners.Length; i++)
            {
                _projectileListeners[i].OnProjectileUpdated(weaponType, shotIndex, pelletIndex, position, velocity);
            }
        }

        public void BroadcastProjectileImpact(LudoWeaponType weaponType, int shotIndex, int pelletIndex, Vector3 impactPoint)
        {
            for (int i = 0; i < _projectileListeners.Length; i++)
            {
                _projectileListeners[i].OnProjectileImpact(weaponType, shotIndex, pelletIndex, impactPoint);
            }
        }

        private void BroadcastProjectileSpawned(LudoWeaponType weaponType, int shotIndex, int pelletIndex, Vector3 origin, Vector3 velocity)
        {
            for (int i = 0; i < _projectileListeners.Length; i++)
            {
                _projectileListeners[i].OnProjectileSpawned(weaponType, shotIndex, pelletIndex, origin, velocity);
            }
        }

        private void ApplyProgressiveDamage(Vector3 impactPoint, bool isLastBullet, WeaponBallisticsProfile weapon)
        {
            if (_tokenPieces.Count == 0)
                return;

            float breakForce = weapon != null ? weapon.finalBreakForce : 8f;
            float breakRadius = weapon != null ? weapon.breakRadius : 2f;
            if (isLastBullet)
            {
                for (int i = 0; i < _tokenPieces.Count; i++)
                {
                    _tokenPieces[i].BreakCompletely(impactPoint, breakForce, breakRadius);
                }
                return;
            }

            _tokenPieces.Sort((a, b) =>
            {
                float da = a == null ? float.MaxValue : (a.transform.position - impactPoint).sqrMagnitude;
                float db = b == null ? float.MaxValue : (b.transform.position - impactPoint).sqrMagnitude;
                return da.CompareTo(db);
            });

            int maxPieces = Mathf.Clamp(minorPiecesPerNonFinalShot, 1, _tokenPieces.Count);
            float nonFinalForce = weapon != null ? weapon.nonFinalBreakForce : 3.5f;
            int damaged = 0;
            for (int i = 0; i < _tokenPieces.Count && damaged < maxPieces; i++)
            {
                TokenPieceHealth piece = _tokenPieces[i];
                if (piece == null || piece.IsDetached)
                    continue;

                piece.DamageMinor(impactPoint, nonFinalForce, breakRadius);
                damaged++;
            }
        }

        private void BeginAimCamera(WeaponBallisticsProfile weapon)
        {
            if (playerCamera == null)
                return;

            if (_cameraRoutine != null)
            {
                StopCoroutine(_cameraRoutine);
            }

            _cameraRoutine = StartCoroutine(AimViewRoutine(weapon));
        }

        private void RefreshWeaponPose(Vector3 shotDirection)
        {
            if (weaponRoot != null)
            {
                weaponRoot.localPosition = _weaponRootLocalPos;
                weaponRoot.localRotation = _weaponRootLocalRot;
            }

            LudoWeaponGripPose gripPose = _activeWeapon?.gripPose ?? new LudoWeaponGripPose();
            Vector3 lift = Vector3.up * gripPose.handLift;

            if (rightHandGrip != null)
            {
                rightHandGrip.position = muzzle.position - (shotDirection * gripPose.rightHandBackFromMuzzle) + lift;
                rightHandGrip.rotation = Quaternion.LookRotation(shotDirection, Vector3.up);
            }

            if (leftHandGrip != null)
            {
                Vector3 side = Vector3.Cross(Vector3.up, shotDirection).normalized * gripPose.leftHandSideOffset;
                leftHandGrip.position = muzzle.position - (shotDirection * gripPose.leftHandBackFromMuzzle) - side + lift;
                leftHandGrip.rotation = Quaternion.LookRotation(shotDirection, Vector3.up);
            }

            if (humanHandRetargeter != null)
            {
                humanHandRetargeter.SnapToMappedPose();
            }
        }

        private IEnumerator AimViewRoutine(WeaponBallisticsProfile weapon)
        {
            if (forceAttackerAimAnchor && attackerCameraAnchor != null && playerCamera.transform.parent != attackerCameraAnchor)
            {
                playerCamera.transform.SetParent(attackerCameraAnchor, true);
            }

            float elapsed = 0f;
            float duration = Mathf.Max(0.01f, weapon.aimTransitionSeconds);
            float startFov = playerCamera.fieldOfView;
            Vector3 startPos = playerCamera.transform.localPosition;
            Vector3 targetLocalPos = _baseCameraLocalPos + firstPersonAimOffset;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                Vector3 targetWorld = ResolveLiveTargetPosition();
                Vector3 aimForward = (targetWorld - muzzle.position).normalized;
                if (aimForward.sqrMagnitude > 0.00001f)
                {
                    RefreshWeaponPose(aimForward);
                }

                playerCamera.fieldOfView = Mathf.Lerp(startFov, weapon.aimFov, t);
                playerCamera.transform.localPosition = Vector3.Lerp(startPos, targetLocalPos, Mathf.Clamp01(Time.deltaTime * aimPositionLerp));
                Quaternion toTarget = Quaternion.LookRotation((targetWorld - playerCamera.transform.position).normalized, Vector3.up);
                playerCamera.transform.rotation = Quaternion.Slerp(playerCamera.transform.rotation, toTarget, Mathf.Clamp01(Time.deltaTime * cameraLookLerp));
                yield return null;
            }
        }

        private void StartBulletFollowCamera(Transform bulletTransform, float seconds)
        {
            if (playerCamera == null || bulletTransform == null)
                return;

            if (_cameraRoutine != null)
            {
                StopCoroutine(_cameraRoutine);
            }

            if (allowDynamicCameraOnlyDuringAnimation && !_isAnimationCameraActive)
            {
                return;
            }

            _cameraRoutine = StartCoroutine(BulletFollowRoutine(bulletTransform, seconds));
        }

        private IEnumerator BulletFollowRoutine(Transform bulletTransform, float seconds)
        {
            float t = 0f;
            while (t < seconds && bulletTransform != null)
            {
                t += Time.deltaTime;
                Vector3 targetPos = bulletTransform.position - (bulletTransform.forward * bulletFollowDistance) + (Vector3.up * bulletFollowHeight);
                playerCamera.transform.position = Vector3.Lerp(playerCamera.transform.position, targetPos, Mathf.Clamp01(Time.deltaTime * cameraTrackLerp));
                Quaternion toBullet = Quaternion.LookRotation((bulletTransform.position - playerCamera.transform.position).normalized, Vector3.up);
                playerCamera.transform.rotation = Quaternion.Slerp(playerCamera.transform.rotation, toBullet, Mathf.Clamp01(Time.deltaTime * cameraLookLerp));
                yield return null;
            }
        }

        private void StartFinalImpactCamera(Vector3 point)
        {
            if (playerCamera == null)
                return;

            if (_cameraRoutine != null)
            {
                StopCoroutine(_cameraRoutine);
            }

            float seconds = _activeWeapon != null ? _activeWeapon.impactFollowSeconds : 1f;
            _cameraRoutine = StartCoroutine(FinalImpactRoutine(point, seconds));
        }

        private IEnumerator FinalImpactRoutine(Vector3 impactPoint, float seconds)
        {
            float t = 0f;
            Quaternion startRot = playerCamera.transform.rotation;

            while (t < seconds)
            {
                t += Time.deltaTime;
                Vector3 towardImpact = (impactPoint - playerCamera.transform.position).normalized;
                Quaternion impactRot = Quaternion.LookRotation(towardImpact, Vector3.up);
                playerCamera.transform.rotation = Quaternion.Slerp(startRot, impactRot, Mathf.Clamp01(t / seconds));
                yield return null;
            }

            yield return StartCoroutine(ReturnCameraToDefault());
        }

        private IEnumerator ReturnCameraToDefault()
        {
            if (forceAttackerAimAnchor && attackerCameraAnchor != null && playerCamera.transform.parent != attackerCameraAnchor)
            {
                playerCamera.transform.SetParent(attackerCameraAnchor, true);
            }

            float elapsed = 0f;
            const float duration = 0.2f;
            float fromFov = playerCamera.fieldOfView;
            Vector3 fromPos = playerCamera.transform.localPosition;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                playerCamera.fieldOfView = Mathf.Lerp(fromFov, _baseFov, t);
                if (_baseCameraParent != null && playerCamera.transform.parent != _baseCameraParent)
                {
                    playerCamera.transform.SetParent(_baseCameraParent, true);
                }

                playerCamera.transform.localPosition = Vector3.Lerp(fromPos, _baseCameraLocalPos, t);
                playerCamera.transform.localRotation = Quaternion.Slerp(playerCamera.transform.localRotation, _baseCameraLocalRot, t);
                yield return null;
            }

            _isAnimationCameraActive = false;
            _cameraRoutine = null;
        }

        public void FocusCameraOnTurn(Transform turnAnchor)
        {
            if (playerCamera == null || turnAnchor == null || _isAnimationCameraActive)
                return;

            StartCoroutine(FocusTurnRoutine(turnAnchor));
        }

        private IEnumerator FocusTurnRoutine(Transform turnAnchor)
        {
            Vector3 fromForward = playerCamera.transform.forward;
            float elapsed = 0f;
            float duration = Mathf.Max(0.01f, turnFocusDuration);
            while (elapsed < duration && turnAnchor != null && !_isAnimationCameraActive)
            {
                elapsed += Time.deltaTime;
                Vector3 toTarget = (turnAnchor.position - playerCamera.transform.position).normalized;
                Vector3 lerped = Vector3.Slerp(fromForward, toTarget, Mathf.Clamp01(elapsed / duration));
                playerCamera.transform.rotation = Quaternion.LookRotation(lerped, Vector3.up);
                yield return null;
            }
        }

        private Vector3 ResolveLiveTargetPosition()
        {
            if (liveTargetTransform != null)
            {
                return liveTargetTransform.position;
            }

            return targetTokenRoot != null ? targetTokenRoot.position : muzzle.position + muzzle.forward;
        }


        private void EquipWeaponVisual(WeaponBallisticsProfile profile)
        {
            if (weaponRoot == null)
                return;

            if (_equippedWeaponInstance != null)
            {
                Destroy(_equippedWeaponInstance);
                _equippedWeaponInstance = null;
            }

            if (profile == null || profile.weaponPrefab == null)
                return;

            _equippedWeaponInstance = Instantiate(profile.weaponPrefab, weaponRoot);
            _equippedWeaponInstance.transform.localPosition = Vector3.zero;
            _equippedWeaponInstance.transform.localRotation = Quaternion.identity;
            _equippedWeaponInstance.transform.localScale = Vector3.one;

            Animator importedAnimator = _equippedWeaponInstance.GetComponentInChildren<Animator>(true);
            if (profile.animationProfile != null && profile.animationProfile.weaponAnimator == null)
            {
                profile.animationProfile.weaponAnimator = importedAnimator;
            }
        }

        private void ApplyRetargetGrip(WeaponBallisticsProfile profile)
        {
            if (humanHandRetargeter == null || profile?.gripPose == null)
                return;

            humanHandRetargeter.SetWeaponGripOffsets(
                profile.gripPose.retargetGripPositionOffset,
                profile.gripPose.retargetGripEulerOffset);
        }

        private void BuildProfileMap()
        {
            _profiles.Clear();
            for (int i = 0; i < weaponProfiles.Count; i++)
            {
                WeaponBallisticsProfile profile = weaponProfiles[i];
                if (profile == null)
                    continue;

                _profiles[profile.weaponType] = profile;
            }
        }

        private void LateUpdate()
        {
            MaintainStaticPresentationAnchors();
            if (humanHandRetargeter != null)
            {
                humanHandRetargeter.SnapToMappedPose();
            }
        }

        private void CacheStaticAnchors()
        {
            if (weaponRoot != null)
            {
                _weaponRootLocalPos = weaponRoot.localPosition;
                _weaponRootLocalRot = weaponRoot.localRotation;
            }

            if (weaponSwapIcon != null)
            {
                Transform iconAnchor = tableWeaponAnchor != null ? tableWeaponAnchor : weaponRoot;
                if (iconAnchor != null)
                {
                    _swapIconWorldPos = iconAnchor.position + swapIconWorldOffset;
                    _swapIconWorldRot = weaponSwapIcon.rotation;
                    weaponSwapIcon.position = _swapIconWorldPos;
                }
                else
                {
                    _swapIconWorldPos = weaponSwapIcon.position;
                    _swapIconWorldRot = weaponSwapIcon.rotation;
                }
            }
        }

        private void MaintainStaticPresentationAnchors()
        {
            if (weaponRoot != null)
            {
                weaponRoot.localPosition = _weaponRootLocalPos;
                weaponRoot.localRotation = _weaponRootLocalRot;
            }

            if (weaponSwapIcon != null)
            {
                weaponSwapIcon.position = _swapIconWorldPos;
                weaponSwapIcon.rotation = _swapIconWorldRot;
            }
        }

        private void CacheTokenPieces()
        {
            _tokenPieces.Clear();
            if (targetTokenRoot == null)
                return;

            TokenPieceHealth[] pieces = targetTokenRoot.GetComponentsInChildren<TokenPieceHealth>(true);
            _tokenPieces.AddRange(pieces);
        }
    }

    public sealed class BattleRoyaleBullet : MonoBehaviour
    {
        private Vector3 _velocity;
        private float _life;
        private bool _isLastBullet;
        private LudoWeaponType _weaponType;
        private int _shotIndex;
        private int _pelletIndex;
        private bool _impactSent;
        private BattleRoyaleWeaponDirector _director;
        private float _broadcastTick;

        public void Initialize(Vector3 velocity, BattleRoyaleWeaponDirector director, LudoWeaponType weaponType, int shotIndex, int pelletIndex, bool isLastBullet, bool _followByCamera, float followSeconds)
        {
            _velocity = velocity;
            _director = director;
            _weaponType = weaponType;
            _shotIndex = shotIndex;
            _pelletIndex = pelletIndex;
            _isLastBullet = isLastBullet;
            _life = Mathf.Max(1.2f, followSeconds + 0.55f);
            _broadcastTick = 0f;
        }

        private void Update()
        {
            transform.position += _velocity * Time.deltaTime;
            _broadcastTick += Time.deltaTime;
            if (_broadcastTick >= 0.033f)
            {
                _broadcastTick = 0f;
                _director?.BroadcastProjectileUpdated(_weaponType, _shotIndex, _pelletIndex, transform.position, _velocity);
            }
            _life -= Time.deltaTime;
            if (_life <= 0f)
            {
                Destroy(gameObject);
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (_impactSent)
                return;

            _impactSent = true;
            _director?.BroadcastProjectileImpact(_weaponType, _shotIndex, _pelletIndex, transform.position);
            _director?.OnBulletImpact(transform.position, _isLastBullet);
            Destroy(gameObject);
        }
    }

    public sealed class TokenPieceHealth : MonoBehaviour
    {
        [SerializeField] private int minorHitsToDetach = 2;
        [SerializeField] private Rigidbody rb;

        private int _minorHits;

        private void Awake()
        {
            if (rb == null)
            {
                rb = GetComponent<Rigidbody>();
            }
        }

        public bool IsDetached { get; private set; }

        public void DamageMinor(Vector3 impactPoint, float force, float radius)
        {
            _minorHits++;
            if (_minorHits >= minorHitsToDetach)
            {
                BreakCompletely(impactPoint, force, radius);
            }
        }

        public void BreakCompletely(Vector3 impactPoint, float force, float radius)
        {
            if (rb == null || IsDetached)
                return;

            IsDetached = true;
            transform.SetParent(null, true);
            rb.isKinematic = false;
            rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            rb.AddExplosionForce(force, impactPoint, Mathf.Max(0.05f, radius), 0.3f, ForceMode.Impulse);
            rb.AddTorque(UnityEngine.Random.insideUnitSphere * force * 0.7f, ForceMode.Impulse);
        }
    }
}
