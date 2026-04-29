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
        [SerializeField] private Transform rightHandGrip;
        [SerializeField] private Transform leftHandGrip;

        [Header("Weapon presets")]
        [SerializeField] private List<WeaponBallisticsProfile> weaponProfiles = new List<WeaponBallisticsProfile>();
        [SerializeField] private LudoWeaponType startingWeapon = LudoWeaponType.Rifle;

        [Header("Damage progression")]
        [SerializeField] private int minorPiecesPerNonFinalShot = 3;

        [Header("Camera anchors")]
        [SerializeField] private Vector3 firstPersonAimOffset = new Vector3(0.08f, -0.04f, 0.18f);
        [SerializeField] private float aimPositionLerp = 20f;
        [SerializeField] private bool followAllBullets = true;
        [SerializeField] private float bulletFollowDistance = 0.4f;
        [SerializeField] private float bulletFollowHeight = 0.14f;
        [SerializeField] private float cameraLookLerp = 18f;
        [SerializeField] private float cameraTrackLerp = 15f;

        private readonly Dictionary<LudoWeaponType, WeaponBallisticsProfile> _profiles = new Dictionary<LudoWeaponType, WeaponBallisticsProfile>();
        private readonly List<TokenPieceHealth> _tokenPieces = new List<TokenPieceHealth>();

        private WeaponBallisticsProfile _activeWeapon;
        private Coroutine _fireRoutine;
        private Coroutine _cameraRoutine;
        private ILudoWeaponEvents[] _eventListeners = Array.Empty<ILudoWeaponEvents>();
        private float _baseFov = 60f;
        private Vector3 _baseCameraLocalPos;
        private Transform _baseCameraParent;
        private Quaternion _baseCameraLocalRot;

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
            _eventListeners = GetComponentsInParent<ILudoWeaponEvents>(true);
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
        }

        private void FireSingleRound(WeaponBallisticsProfile weapon, int shotIndex, int totalShots, bool isLastBullet)
        {
            Vector3 directionToTarget = (targetTokenRoot.position - muzzle.position).normalized;
            Vector3 spreadVec = UnityEngine.Random.insideUnitSphere * weapon.spread;
            Vector3 shotDirection = (directionToTarget + spreadVec).normalized;
            RefreshWeaponPose(shotDirection);

            SpawnBullet(weapon, shotDirection, isLastBullet, shotIndex, totalShots);
            SpawnShell(weapon);
            PlayShotSfx(weapon);

            for (int i = 0; i < _eventListeners.Length; i++)
            {
                _eventListeners[i].OnWeaponShot(weapon.weaponType, shotIndex, totalShots);
            }
        }

        private void SpawnBullet(WeaponBallisticsProfile weapon, Vector3 direction, bool isLastBullet, int shotIndex, int totalShots)
        {
            if (weapon.bulletPrefab == null)
                return;

            GameObject bulletObj = Instantiate(weapon.bulletPrefab, muzzle.position, Quaternion.LookRotation(direction));
            bulletObj.transform.localScale *= weapon.bulletScale;

            BattleRoyaleBullet bullet = bulletObj.GetComponent<BattleRoyaleBullet>();
            if (bullet == null)
            {
                bullet = bulletObj.AddComponent<BattleRoyaleBullet>();
            }

            bool shouldFollowBullet = followAllBullets || isLastBullet;
            bullet.Initialize(direction * weapon.muzzleVelocity, this, isLastBullet, shouldFollowBullet, weapon.impactFollowSeconds);
            if (shouldFollowBullet)
            {
                StartBulletFollowCamera(bullet.transform, shotIndex == totalShots - 1 ? weapon.impactFollowSeconds : Mathf.Min(weapon.impactFollowSeconds, 0.35f));
            }
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
                weaponRoot.position = muzzle.position;
                weaponRoot.rotation = Quaternion.LookRotation(shotDirection, Vector3.up);
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
                if (attackerCameraAnchor != null && playerCamera.transform.parent != attackerCameraAnchor)
                {
                    playerCamera.transform.SetParent(attackerCameraAnchor, true);
                }

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
        private bool _impactSent;
        private BattleRoyaleWeaponDirector _director;

        public void Initialize(Vector3 velocity, BattleRoyaleWeaponDirector director, bool isLastBullet, bool _followByCamera, float followSeconds)
        {
            _velocity = velocity;
            _director = director;
            _isLastBullet = isLastBullet;
            _life = Mathf.Max(1.2f, followSeconds + 0.55f);
        }

        private void Update()
        {
            transform.position += _velocity * Time.deltaTime;
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
