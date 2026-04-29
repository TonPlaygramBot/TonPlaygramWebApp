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

    [Serializable]
    public sealed class WeaponBallisticsProfile
    {
        public string weaponId = "rifle";
        public WeaponFireMode fireMode = WeaponFireMode.MagazineAuto;
        public int magazineSize = 30;
        public float roundsPerSecond = 12f;
        public float muzzleVelocity = 240f;
        public float bulletScale = 1f;
        public float shellScale = 1f;
        public float spread = 0.01f;
        public float aimFov = 43f;
        public float aimTransitionSeconds = 0.1f;
        public float impactFollowSeconds = 1.15f;
        public GameObject bulletPrefab;
        public GameObject shellPrefab;
    }

    public sealed class BattleRoyaleWeaponDirector : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Camera playerCamera;
        [SerializeField] private Transform muzzle;
        [SerializeField] private Transform shellEject;
        [SerializeField] private Transform targetTokenRoot;

        [Header("Weapons")]
        [SerializeField] private List<WeaponBallisticsProfile> weaponProfiles = new List<WeaponBallisticsProfile>();
        [SerializeField] private string startingWeaponId = "rifle";

        [Header("Damage progression")]
        [SerializeField] private int smallPieceHitsBeforeDestroy = 6;

        private readonly Dictionary<string, WeaponBallisticsProfile> _profiles = new Dictionary<string, WeaponBallisticsProfile>(StringComparer.OrdinalIgnoreCase);
        private WeaponBallisticsProfile _activeWeapon;
        private Coroutine _fireRoutine;
        private Coroutine _cameraRoutine;
        private float _defaultFov;
        private readonly List<TokenPieceHealth> _tokenPieces = new List<TokenPieceHealth>();

        private void Awake()
        {
            if (playerCamera == null)
            {
                playerCamera = Camera.main;
            }

            _defaultFov = playerCamera != null ? playerCamera.fieldOfView : 60f;
            BuildProfileMap();
            CacheTokenPieces();
            Equip(startingWeaponId);
        }

        public void Equip(string weaponId)
        {
            if (!_profiles.TryGetValue(weaponId, out var profile))
            {
                Debug.LogWarning($"Unknown weapon profile: {weaponId}");
                return;
            }

            _activeWeapon = profile;
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
            float shotDelay = weapon.roundsPerSecond <= 0.001f ? 0f : (1f / weapon.roundsPerSecond);

            for (int i = 0; i < shots; i++)
            {
                bool isLastBullet = i == shots - 1;
                FireSingleRound(weapon, isLastBullet);
                if (shotDelay > 0f)
                {
                    yield return new WaitForSeconds(shotDelay);
                }
            }
        }

        private void FireSingleRound(WeaponBallisticsProfile weapon, bool isLastBullet)
        {
            Vector3 toTarget = (targetTokenRoot.position - muzzle.position).normalized;
            Vector3 spread = UnityEngine.Random.insideUnitSphere * weapon.spread;
            Vector3 shotDirection = (toTarget + spread).normalized;

            SpawnBullet(weapon, shotDirection, isLastBullet);
            SpawnShell(weapon);
            EnterAimingCamera(weapon);
        }

        private void SpawnBullet(WeaponBallisticsProfile weapon, Vector3 direction, bool isLastBullet)
        {
            if (weapon.bulletPrefab == null)
                return;

            GameObject bulletGo = Instantiate(weapon.bulletPrefab, muzzle.position, Quaternion.LookRotation(direction));
            bulletGo.transform.localScale *= weapon.bulletScale;

            var bullet = bulletGo.GetComponent<BattleRoyaleBullet>();
            if (bullet == null)
            {
                bullet = bulletGo.AddComponent<BattleRoyaleBullet>();
            }

            bullet.Initialize(direction * weapon.muzzleVelocity, this, isLastBullet, weapon.impactFollowSeconds);
        }

        private void SpawnShell(WeaponBallisticsProfile weapon)
        {
            if (weapon.shellPrefab == null || shellEject == null)
                return;

            GameObject shellGo = Instantiate(weapon.shellPrefab, shellEject.position, shellEject.rotation);
            shellGo.transform.localScale *= weapon.shellScale;

            var rb = shellGo.GetComponent<Rigidbody>();
            if (rb == null)
            {
                rb = shellGo.AddComponent<Rigidbody>();
            }

            rb.mass = 0.02f;
            rb.velocity = shellEject.right * UnityEngine.Random.Range(1.8f, 3.2f) + Vector3.up * UnityEngine.Random.Range(0.8f, 1.4f);
            rb.angularVelocity = UnityEngine.Random.insideUnitSphere * 12f;
            Destroy(shellGo, 5f);
        }

        public void OnBulletImpact(Vector3 point, bool lastBullet)
        {
            ApplyProgressiveTokenDamage(lastBullet);
            FollowImpact(point, lastBullet);
        }

        private void ApplyProgressiveTokenDamage(bool lastBullet)
        {
            if (_tokenPieces.Count == 0)
                return;

            if (lastBullet)
            {
                for (int i = 0; i < _tokenPieces.Count; i++)
                {
                    _tokenPieces[i].BreakCompletely();
                }
                return;
            }

            int chunks = Mathf.Clamp(smallPieceHitsBeforeDestroy, 1, _tokenPieces.Count);
            for (int i = 0; i < chunks; i++)
            {
                _tokenPieces[i].DamageMinor();
            }
        }

        private void EnterAimingCamera(WeaponBallisticsProfile weapon)
        {
            if (playerCamera == null)
                return;

            if (_cameraRoutine != null)
            {
                StopCoroutine(_cameraRoutine);
            }

            _cameraRoutine = StartCoroutine(LerpFov(weapon.aimFov, weapon.aimTransitionSeconds));
        }

        private void FollowImpact(Vector3 point, bool lastBullet)
        {
            if (!lastBullet || playerCamera == null)
                return;

            if (_cameraRoutine != null)
            {
                StopCoroutine(_cameraRoutine);
            }

            _cameraRoutine = StartCoroutine(FollowImpactRoutine(point, _activeWeapon != null ? _activeWeapon.impactFollowSeconds : 1f));
        }

        private IEnumerator FollowImpactRoutine(Vector3 point, float seconds)
        {
            float elapsed = 0f;
            Quaternion from = playerCamera.transform.rotation;
            Vector3 focus = point;

            while (elapsed < seconds)
            {
                elapsed += Time.deltaTime;
                Vector3 dir = (focus - playerCamera.transform.position).normalized;
                Quaternion to = Quaternion.LookRotation(dir, Vector3.up);
                playerCamera.transform.rotation = Quaternion.Slerp(from, to, elapsed / seconds);
                yield return null;
            }

            yield return LerpFov(_defaultFov, 0.2f);
        }

        private IEnumerator LerpFov(float target, float seconds)
        {
            if (playerCamera == null)
                yield break;

            float start = playerCamera.fieldOfView;
            float t = 0f;
            while (t < seconds)
            {
                t += Time.deltaTime;
                float k = seconds <= 0f ? 1f : Mathf.Clamp01(t / seconds);
                playerCamera.fieldOfView = Mathf.Lerp(start, target, k);
                yield return null;
            }
        }

        private void BuildProfileMap()
        {
            _profiles.Clear();
            for (int i = 0; i < weaponProfiles.Count; i++)
            {
                WeaponBallisticsProfile profile = weaponProfiles[i];
                if (profile == null || string.IsNullOrWhiteSpace(profile.weaponId))
                    continue;

                _profiles[profile.weaponId] = profile;
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
        private BattleRoyaleWeaponDirector _director;
        private bool _isLastBullet;
        private float _life = 5f;
        private bool _impactSent;

        public void Initialize(Vector3 velocity, BattleRoyaleWeaponDirector director, bool isLastBullet, float followSeconds)
        {
            _velocity = velocity;
            _director = director;
            _isLastBullet = isLastBullet;
            _life = Mathf.Max(1.2f, followSeconds + 0.5f);
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
        [SerializeField] private int minorHitsToDetach = 3;
        [SerializeField] private Rigidbody rb;

        private int _hits;

        private void Awake()
        {
            if (rb == null)
                rb = GetComponent<Rigidbody>();
        }

        public void DamageMinor()
        {
            _hits++;
            if (_hits >= minorHitsToDetach)
            {
                BreakCompletely();
            }
        }

        public void BreakCompletely()
        {
            if (rb == null)
                return;

            rb.isKinematic = false;
            rb.AddExplosionForce(8f, transform.position + Vector3.back, 2f, 0.35f, ForceMode.Impulse);
            rb.AddTorque(UnityEngine.Random.insideUnitSphere * 5f, ForceMode.Impulse);
        }
    }
}
