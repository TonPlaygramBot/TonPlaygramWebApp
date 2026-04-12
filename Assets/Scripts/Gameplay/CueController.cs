using System.Collections;
using UnityEngine;
using Aiming.Gameplay.Broadcast;

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
        public float strikeDuration = 0.12f;
        public float strikeHoldDuration = 0.05f;
        public float baseStrikeImpulse = 1.8f;
        public float maxStrikeImpulse = 6.5f;
        [Tooltip("Normalized strike progress where the hit is fired once after the cue has actually pushed forward into cue-ball contact.")]
        [Range(0.75f, 0.99f)] public float hitProgress = 0.9f;
        [Tooltip("How much of the strike stays for the final idle->contact micro drive.")]
        [Range(0.02f, 0.25f)] public float contactDrivePortion = 0.1f;
        [Tooltip("Minimum pull used for strike animation so the cue visibly drives forward every shot.")]
        [Min(0f)] public float minimumVisualPull = 0.025f;
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
        float _maxPowerDuringCharge;
        float _latchedShotPower;
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
                _maxPowerDuringCharge = Mathf.Max(_maxPowerDuringCharge, _power);
                float effectivePower = Mathf.Max(_power, _maxPowerDuringCharge);
                float pull = pullRange * EaseOutCubic(effectivePower);
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
            _shotState = ShotState.Dragging;
            _power = Mathf.Max(_power, RecoverPowerFromCueDepth(_currentCueDepth));
            _maxPowerDuringCharge = _power;
            _latchedShotPower = 0f;
            _chargedCueDepth = idleTipGap + (pullRange * EaseOutCubic(_power));
            _currentCueDepth = _chargedCueDepth;
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
            _maxPowerDuringCharge = 0f;
            _latchedShotPower = 0f;
            _chargedCueDepth = idleTipGap;
            _currentCueDepth = idleTipGap;
            UpdateCuePose();
        }

        public void ReleaseAndStrike()
        {
            if (_shotState != ShotState.Dragging)
            {
                return;
            }

            float recoveredPower = RecoverPowerFromCueDepth(_chargedCueDepth);
            _latchedShotPower = Mathf.Clamp01(Mathf.Max(Mathf.Max(_power, recoveredPower), _maxPowerDuringCharge));
            if (_latchedShotPower <= 0.02f)
            {
                _shotState = ShotState.Idle;
                _maxPowerDuringCharge = 0f;
                _chargedCueDepth = idleTipGap;
                _currentCueDepth = idleTipGap;
                UpdateCuePose();
                return;
            }

            TriggerShotBroadcastCamera();
            StartCoroutine(StrikeRoutine(_latchedShotPower));
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
            if (_shotState == ShotState.Dragging)
            {
                float effectivePower = Mathf.Max(_power, _maxPowerDuringCharge);
                float pull = pullRange * EaseOutCubic(effectivePower);
                _chargedCueDepth = idleTipGap + pull;
                _currentCueDepth = _chargedCueDepth;
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

        IEnumerator StrikeRoutine(float shotPower)
        {
            _shotState = ShotState.Striking;

            Vector3 strikeDirection = _aimDirection;
            float pull = Mathf.Max(0f, _chargedCueDepth - idleTipGap);
            float visualPull = Mathf.Max(pull, minimumVisualPull);
            float startDepth = idleTipGap + visualPull;
            float hitDepth = idleTipGap;
            float contactDepth = contactTipGap;
            float elapsed = 0f;
            bool didStrike = false;
            float contactStartT = Mathf.Clamp01(1f - contactDrivePortion);
            float hitT = Mathf.Clamp01(hitProgress);
            _currentCueDepth = startDepth;
            UpdateCuePose();

            while (elapsed < strikeDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / Mathf.Max(strikeDuration, 0.001f));
                float cueDepth;
                if (t < contactStartT)
                {
                    float phaseT = contactStartT > 0f ? t / contactStartT : 1f;
                    cueDepth = Mathf.Lerp(startDepth, hitDepth, EaseOutCubic(phaseT));
                }
                else
                {
                    float phaseT = contactStartT < 1f ? (t - contactStartT) / (1f - contactStartT) : 1f;
                    cueDepth = Mathf.Lerp(hitDepth, contactDepth, EaseOutCubic(phaseT));
                }

                _currentCueDepth = cueDepth;
                UpdateCuePose();

                bool reachedCueBallContact = cueDepth <= hitDepth + 0.0001f;
                bool reachedHitMoment = t >= hitT;
                if (!didStrike && reachedCueBallContact && reachedHitMoment)
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

            _currentCueDepth = contactDepth;
            UpdateCuePose();
            yield return new WaitForSeconds(strikeHoldDuration);

            _currentCueDepth = idleTipGap;
            _power = 0f;
            _maxPowerDuringCharge = 0f;
            _latchedShotPower = 0f;
            _chargedCueDepth = idleTipGap;
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
