using System.Collections;
using UnityEngine;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        enum ShotState
        {
            Idle,
            Dragging,
            Striking
        }

        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall, objectBall, pocket;
        public Rigidbody cueBallBody;
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;

        [Header("Cue placement")]
        public float idleTipGap = 0.010f;
        public float contactTipGap = 0.001f;
        public float baseCueOffset = 0.12f;
        public float pullRange = 0.34f;

        [Header("Aiming feel")]
        [Range(1f, 30f)] public float rotationDamping = 14f;
        public bool allowAimAdjustWhileCharging = false;

        [Header("Strike feel")]
        public float strikeDuration = 0.12f;
        public float strikeHoldDuration = 0.05f;
        public float baseStrikeImpulse = 1.8f;
        public float maxStrikeImpulse = 6.5f;
        [Tooltip("Normalized strike progress where the hit is fired once.")]
        [Range(0.75f, 0.99f)] public float hitProgress = 0.9f;

        [Header("Spin input")]
        [Tooltip("Receives normalized spin values from the existing on-screen spin controller.")]
        public Vector2 spinInput;
        public CueStrikePhysics strikePhysics = new CueStrikePhysics();

        Vector3 _aimDirection = Vector3.forward;
        Vector3 _targetDirection = Vector3.forward;
        Vector3 _cueAnchorPosition;
        float _currentCueDepth;
        float _power;
        float _latchedShotPower;
        float _latchedPullDepth;
        ShotState _shotState = ShotState.Idle;

        void Update()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null)
            {
                return;
            }

            if (_shotState == ShotState.Striking)
            {
                return;
            }

            bool ballsMoving = AreBallsMoving();
            if (ballsMoving && _shotState == ShotState.Idle)
            {
                gameObject.SetActive(false);
                return;
            }

            gameObject.SetActive(true);
            if (_shotState == ShotState.Idle)
            {
                _cueAnchorPosition = cueBall.position;
            }

            UpdateAimDirection();
            UpdateCueDepth();
            UpdateCuePose();
        }

        public void SetChargePower(float normalizedPower)
        {
            _power = Mathf.Clamp01(normalizedPower);

            if (_shotState == ShotState.Dragging)
            {
                float pull = pullRange * EaseOutCubic(_power);
                _currentCueDepth = idleTipGap + pull;
                UpdateCuePose();
            }
        }

        public void BeginCharge()
        {
            if (_shotState == ShotState.Striking)
            {
                return;
            }

            _cueAnchorPosition = cueBall.position;
            _shotState = ShotState.Dragging;
            _latchedShotPower = 0f;
            _latchedPullDepth = idleTipGap;
            _currentCueDepth = idleTipGap + (pullRange * EaseOutCubic(_power));
            gameObject.SetActive(true);
            UpdateCuePose();
        }

        public void SetSpinInput(Vector2 normalizedSpin)
        {
            spinInput = Vector2.ClampMagnitude(normalizedSpin, 1f);
        }

        public void CancelCharge()
        {
            if (_shotState == ShotState.Striking)
            {
                return;
            }

            _shotState = ShotState.Idle;
            _power = 0f;
            _latchedShotPower = 0f;
            _latchedPullDepth = idleTipGap;
            _currentCueDepth = idleTipGap;
            UpdateCuePose();
        }

        public void ReleaseAndStrike()
        {
            if (_shotState != ShotState.Dragging)
            {
                return;
            }

            _latchedShotPower = Mathf.Clamp01(_power);
            _latchedPullDepth = _currentCueDepth;
            if (_latchedShotPower <= 0.02f)
            {
                _shotState = ShotState.Idle;
                _currentCueDepth = idleTipGap;
                UpdateCuePose();
                return;
            }

            StartCoroutine(StrikeRoutine());
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
                    bool canAdjustAim = _shotState != ShotState.Dragging || allowAimAdjustWhileCharging;
                    if (canAdjustAim)
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

        void UpdateCueDepth()
        {
            if (_shotState == ShotState.Dragging)
            {
                float pull = pullRange * EaseOutCubic(_power);
                _currentCueDepth = idleTipGap + pull;
                return;
            }

            _currentCueDepth = idleTipGap;
        }

        void UpdateCuePose()
        {
            Vector3 anchor = _cueAnchorPosition;
            float cueDistance = baseCueOffset + _currentCueDepth;
            transform.position = anchor - _aimDirection * cueDistance;
            transform.rotation = Quaternion.LookRotation(_aimDirection, Vector3.up);

            if (cueTip != null)
            {
                cueTip.position = anchor - _aimDirection * _currentCueDepth;
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
                highSpin = spinInput.sqrMagnitude > 0.0001f,
                collisionMask = aiming.config ? aiming.config.collisionMask : default
            };
            return aiming.GetAimSolution(ctx);
        }

        bool AreBallsMoving()
        {
            return cueBallBody != null && cueBallBody.velocity.sqrMagnitude > 0.0004f;
        }

        IEnumerator StrikeRoutine()
        {
            _shotState = ShotState.Striking;

            Vector3 strikeDirection = _aimDirection;
            float startDepth = Mathf.Max(_latchedPullDepth, idleTipGap);
            float contactDepth = contactTipGap;
            float elapsed = 0f;
            bool didStrike = false;
            _currentCueDepth = startDepth;
            UpdateCuePose();

            while (elapsed < strikeDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / Mathf.Max(strikeDuration, 0.001f));
                float eased = EaseOutCubic(t);

                _currentCueDepth = Mathf.Lerp(startDepth, contactDepth, eased);
                UpdateCuePose();

                bool reachedStartPoint = _currentCueDepth <= idleTipGap;
                if (!didStrike && (t >= hitProgress || reachedStartPoint))
                {
                    didStrike = true;
                    ApplyStrikeImpulse(strikeDirection, _latchedShotPower);
                }

                yield return null;
            }

            if (!didStrike)
            {
                ApplyStrikeImpulse(strikeDirection, _latchedShotPower);
            }

            _currentCueDepth = contactDepth;
            UpdateCuePose();
            yield return new WaitForSeconds(strikeHoldDuration);

            _currentCueDepth = idleTipGap;
            _power = 0f;
            _latchedShotPower = 0f;
            _latchedPullDepth = idleTipGap;
            _shotState = ShotState.Idle;
            UpdateCuePose();
        }

        void ApplyStrikeImpulse(Vector3 strikeDirection, float shotPower)
        {
            if (cueBallBody == null)
            {
                return;
            }

            float impulseMagnitude = Mathf.Lerp(baseStrikeImpulse, maxStrikeImpulse, Mathf.Clamp01(shotPower));
            strikePhysics.Apply(cueBallBody, strikeDirection, impulseMagnitude, spinInput, ballRadius);
        }

        static float EaseOutCubic(float t)
        {
            t = Mathf.Clamp01(t);
            float inv = 1f - t;
            return 1f - (inv * inv * inv);
        }
    }
}
