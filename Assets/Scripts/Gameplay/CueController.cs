using System.Collections;
using UnityEngine;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall, objectBall, pocket;
        public Rigidbody cueBallBody;
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;

        [Header("Cue placement")]
        public float idleTipGap = 0.012f;
        public float baseCueOffset = 0.12f;
        public float maxPullbackDistance = 0.16f;

        [Header("Aiming feel")]
        [Range(1f, 30f)] public float rotationDamping = 14f;
        [Range(1f, 30f)] public float translationDamping = 18f;
        public bool allowAimAdjustWhileCharging = false;

        [Header("Strike feel")]
        public float strikeDuration = 0.055f;
        public float recoilDistance = 0.015f;
        public float recoilDuration = 0.04f;
        public float baseStrikeImpulse = 1.8f;
        public float maxStrikeImpulse = 6.5f;
        [Tooltip("How close to idle pullback the cue must be before applying the strike impulse.")]
        public float strikeContactPullbackThreshold = 0.001f;
        public AnimationCurve pullbackEasing = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);
        public AnimationCurve strikeEaseIn = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        Vector3 _aimDirection = Vector3.forward;
        Vector3 _targetDirection = Vector3.forward;
        float _currentPullback;
        float _targetPullback;
        float _pullbackVelocity;
        float _power;
        float _lastRequestedPower;
        bool _charging;
        bool _striking;

        void Update()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null)
            {
                return;
            }

            if (_striking)
            {
                return;
            }

            bool ballsMoving = AreBallsMoving();
            if (ballsMoving && !_charging)
            {
                gameObject.SetActive(false);
                return;
            }

            gameObject.SetActive(true);
            UpdateAimDirection();
            UpdatePullback();
            UpdateCuePose();
        }

        public void SetChargePower(float normalizedPower)
        {
            _power = Mathf.Clamp01(normalizedPower);
            _lastRequestedPower = _power;
            _targetPullback = pullbackEasing.Evaluate(_power) * maxPullbackDistance;
        }

        public void BeginCharge()
        {
            _charging = true;
        }

        public void CancelCharge()
        {
            _charging = false;
            SetChargePower(0f);
        }

        public void ReleaseAndStrike()
        {
            if (_striking) return;

            float shotPower = Mathf.Clamp01(Mathf.Max(_power, _lastRequestedPower));
            StartCoroutine(StrikeRoutine(shotPower));
        }

        void UpdateAimDirection()
        {
            var sol = BuildAimSolution();
            if (sol.isValid)
            {
                Vector3 desiredDirection = (sol.aimEnd - sol.aimStart);
                if (desiredDirection.sqrMagnitude > 1e-6f)
                {
                    desiredDirection.Normalize();
                    if (!_charging || allowAimAdjustWhileCharging)
                    {
                        _targetDirection = desiredDirection;
                    }
                }
            }

            float rotationLerp = 1f - Mathf.Exp(-rotationDamping * Time.deltaTime);
            _aimDirection = Vector3.Slerp(_aimDirection, _targetDirection, rotationLerp).normalized;
            if (_aimDirection.sqrMagnitude < 1e-6f)
            {
                _aimDirection = _targetDirection;
            }
        }

        void UpdatePullback()
        {
            if (!_charging)
            {
                _targetPullback = 0f;
            }

            _currentPullback = Mathf.SmoothDamp(
                _currentPullback,
                _targetPullback,
                ref _pullbackVelocity,
                1f / Mathf.Max(translationDamping, 0.01f));
        }

        void UpdateCuePose()
        {
            float cueDistance = baseCueOffset + idleTipGap + _currentPullback;
            transform.position = cueBall.position - _aimDirection * cueDistance;
            transform.rotation = Quaternion.LookRotation(_aimDirection, Vector3.up);

            if (cueTip != null)
            {
                cueTip.position = cueBall.position - _aimDirection * idleTipGap;
            }
        }

        ShotSolution BuildAimSolution()
        {
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
            return aiming.GetAimSolution(ctx);
        }

        bool AreBallsMoving()
        {
            return cueBallBody != null && cueBallBody.velocity.sqrMagnitude > 0.0004f;
        }

        IEnumerator StrikeRoutine(float shotPower)
        {
            _striking = true;
            _charging = false;

            Vector3 strikeDirection = _aimDirection;
            float startPullback = _currentPullback;
            float elapsed = 0f;
            bool didStrike = false;

            while (elapsed < strikeDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / Mathf.Max(strikeDuration, 0.001f));
                float eased = strikeEaseIn.Evaluate(t);

                _currentPullback = Mathf.Lerp(startPullback, 0f, eased);
                UpdateCuePose();

                if (!didStrike && _currentPullback <= strikeContactPullbackThreshold)
                {
                    didStrike = true;
                    ApplyStrikeImpulse(strikeDirection, shotPower);
                }

                yield return null;
            }

            if (!didStrike)
            {
                ApplyStrikeImpulse(strikeDirection, shotPower);
            }

            _currentPullback = recoilDistance;
            UpdateCuePose();
            yield return new WaitForSeconds(recoilDuration);

            _currentPullback = 0f;
            _targetPullback = 0f;
            _power = 0f;
            _lastRequestedPower = 0f;
            _striking = false;
            gameObject.SetActive(false);
        }

        void ApplyStrikeImpulse(Vector3 strikeDirection, float shotPower)
        {
            if (cueBallBody == null)
            {
                return;
            }

            float impulseMagnitude = Mathf.Lerp(baseStrikeImpulse, maxStrikeImpulse, Mathf.Clamp01(shotPower));
            cueBallBody.AddForce(strikeDirection * impulseMagnitude, ForceMode.Impulse);
        }
    }
}
