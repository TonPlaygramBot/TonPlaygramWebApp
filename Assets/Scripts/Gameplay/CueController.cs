using System;
using System.Collections;
using UnityEngine;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        [Header("References")]
        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall;
        public Transform objectBall;
        public Transform pocket;
        public Rigidbody cueBallBody;

        [Header("Table")]
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;

        [Header("Cue Placement")]
        [Tooltip("Fixed idle gap between cue tip and cue ball while aiming.")]
        public float idleTipGap = 0.008f;
        [Tooltip("Maximum backward travel while charging power.")]
        public float maxPullbackDistance = 0.18f;

        [Header("Aim Feel")]
        [Tooltip("Higher value = more responsive, lower = heavier rotation.")]
        public float aimSmoothing = 12f;

        [Header("Strike")]
        public float strikeDuration = 0.075f;
        public float recoilDistance = 0.012f;
        public float recoilDuration = 0.05f;
        public float strikeImpulse = 3.5f;
        public ForceMode strikeForceMode = ForceMode.Impulse;

        [Header("Visibility")]
        [Tooltip("If true, cue aim direction is automatically derived from aiming engine solution.")]
        public bool autoAimFromSolution = true;

        public event Action<float> OnCueStrike;

        Vector3 _targetAimDirection = Vector3.forward;
        Vector3 _smoothedAimDirection = Vector3.forward;

        float _charge01;
        float _currentPullback;
        float _strikeOffset;

        bool _isAiming;
        bool _isStriking;

        Coroutine _strikeRoutine;

        void Awake()
        {
            SetCueVisible(false);
        }

        void Update()
        {
            if (cueBall == null) return;

            if (_isAiming && autoAimFromSolution)
            {
                UpdateTargetDirectionFromSolution();
            }

            if (_isAiming)
            {
                UpdateAimSmoothing();
                UpdatePullback();
                UpdateCueTransform();
            }
        }

        public void BeginAim()
        {
            _isAiming = true;
            _isStriking = false;
            _charge01 = 0f;
            _currentPullback = 0f;
            _strikeOffset = 0f;
            _smoothedAimDirection = _targetAimDirection.sqrMagnitude > 1e-6f ? _targetAimDirection.normalized : Vector3.forward;
            SetCueVisible(true);
            UpdateCueTransform();
        }

        public void EndAim()
        {
            _isAiming = false;
            _isStriking = false;
            _charge01 = 0f;
            _currentPullback = 0f;
            _strikeOffset = 0f;

            if (_strikeRoutine != null)
            {
                StopCoroutine(_strikeRoutine);
                _strikeRoutine = null;
            }

            SetCueVisible(false);
        }

        public void SetAimDirection(Vector3 direction)
        {
            if (direction.sqrMagnitude <= 1e-6f) return;
            _targetAimDirection = direction.normalized;
        }

        public void BeginCharge()
        {
            if (!_isAiming || _isStriking) return;
        }

        public void SetCharge01(float charge01)
        {
            if (!_isAiming || _isStriking) return;
            _charge01 = Mathf.Clamp01(charge01);
        }

        public void ReleaseShoot()
        {
            if (!_isAiming || _isStriking) return;

            if (_strikeRoutine != null)
            {
                StopCoroutine(_strikeRoutine);
            }

            _strikeRoutine = StartCoroutine(StrikeRoutine(_charge01));
        }

        void UpdateTargetDirectionFromSolution()
        {
            if (aiming == null || objectBall == null || pocket == null) return;

            ShotContext ctx = new ShotContext
            {
                cueBallPos = cueBall.position,
                objectBallPos = objectBall.position,
                pocketPos = pocket.position,
                ballRadius = ballRadius,
                tableBounds = tableBounds,
                requiresPower = false,
                highSpin = false,
                collisionMask = aiming.config ? aiming.config.collisionMask : default
            };

            var sol = aiming.GetAimSolution(ctx);
            if (!sol.isValid) return;

            Vector3 dir = sol.aimEnd - sol.aimStart;
            if (dir.sqrMagnitude <= 1e-6f) return;
            SetAimDirection(dir);
        }

        void UpdateAimSmoothing()
        {
            float t = 1f - Mathf.Exp(-Mathf.Max(0.01f, aimSmoothing) * Time.deltaTime);
            _smoothedAimDirection = Vector3.Slerp(_smoothedAimDirection, _targetAimDirection, t);
            if (_smoothedAimDirection.sqrMagnitude <= 1e-6f)
            {
                _smoothedAimDirection = _targetAimDirection;
            }
            _smoothedAimDirection.Normalize();
        }

        void UpdatePullback()
        {
            if (_isStriking) return;

            float targetPullback = EaseOutCubic(_charge01) * maxPullbackDistance;
            float pullbackFollow = 1f - Mathf.Exp(-18f * Time.deltaTime);
            _currentPullback = Mathf.Lerp(_currentPullback, targetPullback, pullbackFollow);
        }

        void UpdateCueTransform()
        {
            Vector3 dir = _smoothedAimDirection.sqrMagnitude > 1e-6f ? _smoothedAimDirection : Vector3.forward;

            // Tip gap + power pullback + strike animation offset along cue axis.
            float visualDistance = Mathf.Max(0f, idleTipGap + _currentPullback + _strikeOffset);
            Vector3 cueBallCenter = cueBall.position;
            transform.position = cueBallCenter - dir * visualDistance;
            transform.rotation = Quaternion.LookRotation(dir, Vector3.up);

            if (cueTip != null)
            {
                cueTip.position = cueBallCenter - dir * visualDistance;
            }
        }

        IEnumerator StrikeRoutine(float shotPower01)
        {
            _isStriking = true;

            float startPullback = _currentPullback;
            float elapsed = 0f;

            while (elapsed < strikeDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / Mathf.Max(0.01f, strikeDuration));
                float eased = EaseInQuad(t); // quick acceleration for snappy strike

                _currentPullback = Mathf.Lerp(startPullback, 0f, eased);
                _strikeOffset = Mathf.Lerp(0f, -idleTipGap, eased);
                UpdateCueTransform();
                yield return null;
            }

            _currentPullback = 0f;
            _strikeOffset = -idleTipGap;
            UpdateCueTransform();

            float impulse = Mathf.Clamp01(shotPower01) * strikeImpulse;
            if (cueBallBody != null)
            {
                cueBallBody.AddForce(_smoothedAimDirection * impulse, strikeForceMode);
            }

            OnCueStrike?.Invoke(impulse);

            // Tiny visual recoil for impact feel.
            elapsed = 0f;
            while (elapsed < recoilDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / Mathf.Max(0.01f, recoilDuration));
                _strikeOffset = Mathf.Lerp(-idleTipGap, recoilDistance, t);
                UpdateCueTransform();
                yield return null;
            }

            _strikeOffset = 0f;
            _charge01 = 0f;
            _currentPullback = 0f;
            _isStriking = false;

            // Hide cue while balls are moving.
            EndAim();
        }

        static float EaseOutCubic(float t)
        {
            t = Mathf.Clamp01(t);
            float inv = 1f - t;
            return 1f - inv * inv * inv;
        }

        static float EaseInQuad(float t)
        {
            t = Mathf.Clamp01(t);
            return t * t;
        }

        void SetCueVisible(bool visible)
        {
            gameObject.SetActive(visible);
        }
    }
}
