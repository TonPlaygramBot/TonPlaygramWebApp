using UnityEngine;
using Aiming.Gameplay.Broadcast;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        public enum ShotState
        {
            Idle,
            Dragging,
            Striking
        }

        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall, objectBall, pocket;
        public Rigidbody cueBallBody;
        [Tooltip("All table ball rigidbodies to monitor. AI/cue waits until every listed ball is fully settled before re-aiming.")]
        public Rigidbody[] monitoredBallBodies;
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
        public float strikeDuration = 0.11f;
        public float strikeHoldDuration = 0.045f;
        [Tooltip("Minimum impulse used whenever a valid shot is released.")]
        [Min(0f)] public float minStrikeImpulse = 0.25f;
        [Tooltip("Smallest normalized power that still produces cue-ball movement when charge/release was valid.")]
        [Range(0f, 0.5f)] public float minimumShotPowerNormalized = 0.06f;
        public float maxStrikeImpulse = 6.5f;
        [Tooltip("Normalized strike progress where the hit is fired once.")]
        [Range(0.75f, 0.99f)] public float hitProgress = 0.88f;

        [Header("Motion settle")]
        [Tooltip("Linear velocity threshold used to decide whether a ball is still moving.")]
        [Min(0f)] public float settleLinearVelocitySqr = 0.0004f;
        [Tooltip("Angular velocity threshold used to decide whether a ball is still spinning/moving.")]
        [Min(0f)] public float settleAngularVelocitySqr = 0.0009f;

        [Header("Spin input")]
        [Tooltip("Receives normalized spin values from the existing on-screen spin controller.")]
        public Vector2 spinInput;

        [Header("Camera sync")]
        [Tooltip("Optional cue camera that should mirror pull/push stroke motion for player, AI, and replay capture.")]
        public CueCamera cueCamera;
        [Tooltip("Broadcast camera director used to force immediate rail-overhead switching at shot trigger.")]
        public ShotBroadcastCameraDirector broadcastCameraDirector;
        public CueStrikePhysics strikePhysics = new CueStrikePhysics();

        Vector3 _aimDirection = Vector3.forward;
        Vector3 _targetDirection = Vector3.forward;
        Vector3 _cueAnchorPosition;
        float _currentCueDepth;
        float _chargedCueDepth;
        float _power;
        float _latchedShotPower;
        Vector2 _liveSpinInput;
        Vector2 _latchedShotSpin;
        ShotState _shotState = ShotState.Idle;

        float _strikeElapsed;
        bool _didStrike;
        float _dynamicLift;
        float _dynamicWobble;
        Vector3 _strikeDirection;
        Vector3 _tipBaseScale = Vector3.one;

        public ShotState CurrentShotState => _shotState;
        public Vector3 CurrentAimDirection => _aimDirection;

        void Awake()
        {
            if (cueTip != null)
            {
                _tipBaseScale = cueTip.localScale;
            }
        }

        void Update()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null)
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
                _chargedCueDepth = idleTipGap + pull;
                _currentCueDepth = _chargedCueDepth;
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
            _latchedShotSpin = _liveSpinInput;
            _shotState = ShotState.Dragging;
            _power = Mathf.Max(_power, RecoverPowerFromCueDepth(_currentCueDepth));
            _latchedShotPower = 0f;
            _chargedCueDepth = idleTipGap + (pullRange * EaseOutCubic(_power));
            _currentCueDepth = _chargedCueDepth;
            _dynamicLift = 0f;
            _dynamicWobble = 0f;
            gameObject.SetActive(true);
            UpdateCuePose();
        }

        public void SetSpinInput(Vector2 normalizedSpin)
        {
            _liveSpinInput = Vector2.ClampMagnitude(normalizedSpin, 1f);
            spinInput = _liveSpinInput;
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
            _latchedShotSpin = _liveSpinInput;
            _chargedCueDepth = idleTipGap;
            _currentCueDepth = idleTipGap;
            _dynamicLift = 0f;
            _dynamicWobble = 0f;
            ResetTipScale();
            UpdateCuePose();
        }

        public void ReleaseAndStrike()
        {
            if (_shotState != ShotState.Dragging)
            {
                return;
            }

            float recoveredPower = RecoverPowerFromCueDepth(_chargedCueDepth);
            _latchedShotPower = ResolveReleasedShotPower(_power, recoveredPower);

            _latchedShotSpin = _liveSpinInput;
            _strikeDirection = _aimDirection;
            _strikeElapsed = 0f;
            _didStrike = false;
            _shotState = ShotState.Striking;
            TriggerShotBroadcastCamera();
        }

        void TriggerShotBroadcastCamera()
        {
            if (cueCamera != null)
            {
                cueCamera.SendMessage("SwitchToRailOverheadAfterPullback", SendMessageOptions.DontRequireReceiver);
            }
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
            float hitT = Mathf.Clamp01(hitProgress);
            float activePower = _shotState == ShotState.Dragging ? _power : _latchedShotPower;
            float pull = pullRange * EaseOutCubic(activePower);

            if (_shotState == ShotState.Idle)
            {
                _strikeElapsed = 0f;
                _didStrike = false;
                ResetTipScale();
                _dynamicLift = 0f;
                _dynamicWobble = 0f;
                _currentCueDepth = idleTipGap + (Mathf.Sin(Time.time * 1.5f) * 0.001f);
                return;
            }

            if (_shotState == ShotState.Dragging)
            {
                _strikeElapsed = 0f;
                _didStrike = false;
                ResetTipScale();
                _dynamicLift = -0.0025f * EaseInOutQuad(activePower);
                _dynamicWobble = 0f;
                _chargedCueDepth = idleTipGap + pull;
                _currentCueDepth = _chargedCueDepth;
                return;
            }

            _strikeElapsed += Time.deltaTime;
            float strikeTime = Mathf.Max(0.001f, strikeDuration);
            float t = Mathf.Clamp01(_strikeElapsed / strikeTime);
            float strikeEase = EaseOutCubic(t);
            float topspin = Mathf.Max(0f, _latchedShotSpin.y * activePower);
            float follow = Mathf.Min(0.018f, topspin * 0.018f);
            float dynamicFollow = follow * (0.55f + (0.45f * Mathf.Sin(t * Mathf.PI)));

            float pulledDepth = Mathf.Max(idleTipGap, _chargedCueDepth);
            float releaseTargetDepth = idleTipGap;
            float contactDepth = Mathf.Min(contactTipGap - dynamicFollow, releaseTargetDepth);

            _dynamicLift = -0.0035f * strikeEase;
            _dynamicWobble = Mathf.Sin(t * Mathf.PI) * 0.0014f;
            _currentCueDepth = Mathf.Lerp(pulledDepth, releaseTargetDepth, strikeEase);

            if (!_didStrike && _currentCueDepth <= contactDepth)
            {
                _didStrike = true;
                SquashTip();
                ApplyStrikeImpulse(_strikeDirection, _latchedShotPower);
            }

            if (!_didStrike && t >= hitT)
            {
                _didStrike = true;
                SquashTip();
                ApplyStrikeImpulse(_strikeDirection, _latchedShotPower);
            }

            if (_strikeElapsed >= strikeTime + Mathf.Max(0f, strikeHoldDuration))
            {
                FinishStrike();
            }
        }

        void UpdateCuePose()
        {
            Vector2 activeSpin = _shotState == ShotState.Striking ? _latchedShotSpin : _liveSpinInput;
            Vector3 right = Vector3.Cross(Vector3.up, _aimDirection).normalized;
            if (right.sqrMagnitude < 1e-6f)
            {
                right = transform.right;
            }

            Vector3 spinOffset =
                (right * (activeSpin.x * ballRadius * 0.65f)) +
                (Vector3.up * ((activeSpin.y * ballRadius * 0.65f) + _dynamicLift));

            Vector3 anchor = _cueAnchorPosition + spinOffset;
            float cueDistance = baseCueOffset + _currentCueDepth;
            transform.position = anchor - (_aimDirection * cueDistance);

            Quaternion baseRotation = Quaternion.LookRotation(_aimDirection, Vector3.up);
            Quaternion wobbleRotation = Quaternion.AngleAxis(_dynamicWobble * Mathf.Rad2Deg, Vector3.up);
            transform.rotation = wobbleRotation * baseRotation;

            if (cueTip != null)
            {
                cueTip.position = anchor - (_aimDirection * _currentCueDepth);
            }

            SyncCueCameraStroke();
        }

        void SyncCueCameraStroke()
        {
            if (cueCamera == null)
            {
                return;
            }

            float delta = _currentCueDepth - idleTipGap;
            float stroke;
            if (delta >= 0f)
            {
                stroke = pullRange > 0.0001f ? delta / pullRange : 0f;
            }
            else
            {
                float pushRange = Mathf.Max(0.0001f, idleTipGap - contactTipGap);
                stroke = delta / pushRange;
            }

            cueCamera.SetCueStickStroke(Mathf.Clamp(stroke, -1f, 1f));
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
            if (IsBodyMoving(cueBallBody))
            {
                return true;
            }

            if (monitoredBallBodies == null || monitoredBallBodies.Length == 0)
            {
                return false;
            }

            for (int i = 0; i < monitoredBallBodies.Length; i++)
            {
                if (IsBodyMoving(monitoredBallBodies[i]))
                {
                    return true;
                }
            }

            return false;
        }

        bool IsBodyMoving(Rigidbody body)
        {
            if (body == null)
            {
                return false;
            }

            if (body.velocity.sqrMagnitude > settleLinearVelocitySqr)
            {
                return true;
            }

            return body.angularVelocity.sqrMagnitude > settleAngularVelocitySqr;
        }

        void FinishStrike()
        {
            _strikeElapsed = 0f;
            _didStrike = false;
            _shotState = ShotState.Idle;
            _power = 0f;
            _latchedShotPower = 0f;
            _latchedShotSpin = _liveSpinInput;
            _chargedCueDepth = idleTipGap;
            _currentCueDepth = idleTipGap;
            _dynamicLift = 0f;
            _dynamicWobble = 0f;
            ResetTipScale();
        }

        float ResolveReleasedShotPower(float sliderPower, float recoveredPower)
        {
            float raw = Mathf.Clamp01(Mathf.Max(sliderPower, recoveredPower));
            return raw <= 0f ? minimumShotPowerNormalized : Mathf.Max(minimumShotPowerNormalized, raw);
        }

        void ApplyStrikeImpulse(Vector3 strikeDirection, float shotPower)
        {
            if (cueBallBody == null)
            {
                return;
            }

            float normalizedPower = Mathf.Clamp01(shotPower);
            if (normalizedPower > 0f)
            {
                normalizedPower = Mathf.Max(minimumShotPowerNormalized, normalizedPower);
            }

            if (normalizedPower <= 0f)
            {
                return;
            }

            if (cueBallBody.isKinematic)
            {
                cueBallBody.isKinematic = false;
            }

            cueBallBody.WakeUp();

            float impulseMagnitude = Mathf.Lerp(minStrikeImpulse, maxStrikeImpulse, normalizedPower);
            Vector2 appliedSpin = _shotState == ShotState.Striking ? _latchedShotSpin : _liveSpinInput;
            strikePhysics.Apply(cueBallBody, strikeDirection, impulseMagnitude, appliedSpin, ballRadius);
        }

        void SquashTip()
        {
            if (cueTip == null)
            {
                return;
            }

            Vector3 s = _tipBaseScale;
            s.z *= 0.88f;
            cueTip.localScale = s;
        }

        void ResetTipScale()
        {
            if (cueTip == null)
            {
                return;
            }

            cueTip.localScale = _tipBaseScale;
        }

        static float EaseOutCubic(float t)
        {
            t = Mathf.Clamp01(t);
            float inv = 1f - t;
            return 1f - (inv * inv * inv);
        }

        static float EaseInOutQuad(float t)
        {
            t = Mathf.Clamp01(t);
            return t < 0.5f ? 2f * t * t : 1f - (Mathf.Pow(-2f * t + 2f, 2f) * 0.5f);
        }

        float RecoverPowerFromCueDepth(float cueDepth)
        {
            float pulledDistance = Mathf.Max(0f, cueDepth - idleTipGap);
            if (pullRange <= 0.0001f)
            {
                return 0f;
            }

            float easedPull = Mathf.Clamp01(pulledDistance / pullRange);
            return InverseEaseOutCubic(easedPull);
        }

        static float InverseEaseOutCubic(float easedValue)
        {
            easedValue = Mathf.Clamp01(easedValue);
            float inv = 1f - easedValue;
            return 1f - Mathf.Pow(inv, 1f / 3f);
        }
    }
}
