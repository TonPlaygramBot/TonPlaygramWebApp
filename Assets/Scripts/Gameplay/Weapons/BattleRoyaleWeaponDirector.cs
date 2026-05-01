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
        GrenadeLauncher
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
        public GameObject bulletPrefab;
        public GameObject shellPrefab;
        public AudioClip shotSfx;
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

        [Header("Weapon presets")]
        [SerializeField] private List<WeaponBallisticsProfile> weaponProfiles = new List<WeaponBallisticsProfile>();
        [SerializeField] private LudoWeaponType startingWeapon = LudoWeaponType.Rifle;

        [Header("Damage progression")]
        [SerializeField] private int minorPiecesPerNonFinalShot = 3;

        [Header("Camera anchors")]
        [SerializeField] private Vector3 firstPersonAimOffset = new Vector3(0.06f, -0.075f, 0.14f);
        [SerializeField] private bool lockCameraPositionDuringAim = true;
        [SerializeField] private float aimPositionLerp = 20f;
        [SerializeField] private bool followAllBullets = true;
        [SerializeField] private bool forceAttackerAimAnchor = true;
        [SerializeField] private float bulletFollowDistance = 0.4f;
        [SerializeField] private float bulletFollowHeight = 0.14f;
        [SerializeField] private float cameraLookLerp = 18f;
        [SerializeField] private float cameraTrackLerp = 15f;
        [SerializeField] private bool translateCameraOnFinalBulletOnly = true;
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

            SpawnProjectiles(weapon, shotDirection, isLastBullet, shotIndex, totalShots);
            SpawnShell(weapon);
            PlayShotSfx(weapon);

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
                    StartBulletFollowCamera(bullet.transform, shotIndex == totalShots - 1 ? weapon.impactFollowSeconds : Mathf.Min(weapon.impactFollowSeconds, 0.35f), shotIndex == totalShots - 1);
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

            GameObject shellObj = Instantiate(weapon.shellPrefab, shellEject.position, shellEject.rotation);
            shellObj.transform.localScale *= weapon.shellScale;

            Rigidbody rb = shellObj.GetComponent<Rigidbody>();
            if (rb == null)
            {
                rb = shellObj.AddComponent<Rigidbody>();
            }

            rb.mass = 0.02f;
            rb.velocity = (shellEject.right * UnityEngine.Random.Range(1.8f, 3.1f)) + (Vector3.up * UnityEngine.Random.Range(0.8f, 1.3f));
            rb.angularVelocity = UnityEngine.Random.insideUnitSphere * 13f;
            Destroy(shellObj, 5f);
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
            ApplyProgressiveDamage(isLastBullet);
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

        private void ApplyProgressiveDamage(bool isLastBullet)
        {
            if (_tokenPieces.Count == 0)
                return;

            if (isLastBullet)
            {
                for (int i = 0; i < _tokenPieces.Count; i++)
                {
                    _tokenPieces[i].BreakCompletely();
                }
                return;
            }

            int maxPieces = Mathf.Clamp(minorPiecesPerNonFinalShot, 1, _tokenPieces.Count);
            for (int i = 0; i < maxPieces; i++)
            {
                _tokenPieces[i].DamageMinor();
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

            if (rightHandGrip != null)
            {
                rightHandGrip.position = muzzle.position - (shotDirection * 0.12f);
                rightHandGrip.rotation = Quaternion.LookRotation(shotDirection, Vector3.up);
            }

            if (leftHandGrip != null)
            {
                Vector3 leftOffset = Vector3.Cross(Vector3.up, shotDirection).normalized * 0.06f;
                leftHandGrip.position = muzzle.position - (shotDirection * 0.06f) - leftOffset;
                leftHandGrip.rotation = Quaternion.LookRotation(shotDirection, Vector3.up);
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
                if (lockCameraPositionDuringAim)
                {
                    playerCamera.transform.localPosition = targetLocalPos;
                }
                else
                {
                    playerCamera.transform.localPosition = Vector3.Lerp(startPos, targetLocalPos, Mathf.Clamp01(Time.deltaTime * aimPositionLerp));
                }
                Quaternion toTarget = Quaternion.LookRotation((targetWorld - playerCamera.transform.position).normalized, Vector3.up);
                playerCamera.transform.rotation = Quaternion.Slerp(playerCamera.transform.rotation, toTarget, Mathf.Clamp01(Time.deltaTime * cameraLookLerp));
                yield return null;
            }
        }

        private void StartBulletFollowCamera(Transform bulletTransform, float seconds, bool isFinalShot)
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

            _cameraRoutine = StartCoroutine(BulletFollowRoutine(bulletTransform, seconds, isFinalShot));
        }

        private IEnumerator BulletFollowRoutine(Transform bulletTransform, float seconds, bool isFinalShot)
        {
            float t = 0f;
            while (t < seconds && bulletTransform != null)
            {
                t += Time.deltaTime;
                bool translateCamera = !translateCameraOnFinalBulletOnly || isFinalShot;
                if (translateCamera)
                {
                    Vector3 targetPos = bulletTransform.position - (bulletTransform.forward * bulletFollowDistance) + (Vector3.up * bulletFollowHeight);
                    playerCamera.transform.position = Vector3.Lerp(playerCamera.transform.position, targetPos, Mathf.Clamp01(Time.deltaTime * cameraTrackLerp));
                }
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

        public void DamageMinor()
        {
            _minorHits++;
            if (_minorHits >= minorHitsToDetach)
            {
                BreakCompletely();
            }
        }

        public void BreakCompletely()
        {
            if (rb == null)
                return;

            rb.isKinematic = false;
            rb.AddExplosionForce(8f, transform.position + Vector3.back, 2f, 0.3f, ForceMode.Impulse);
            rb.AddTorque(UnityEngine.Random.insideUnitSphere * 5.5f, ForceMode.Impulse);
        }
    }
}
