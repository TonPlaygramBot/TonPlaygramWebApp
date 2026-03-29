using System.Collections;
using UnityEngine;
using Aiming.Pockets;

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
        [Header("AI pocket mapping")]
        public PocketMouth[] pocketMouths;
        public Transform[] pocketFallbacks;
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
        [Tooltip("How much of the strike stays for the final idle->contact micro drive.")]
        [Range(0.02f, 0.25f)] public float contactDrivePortion = 0.1f;

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
        ShotState _shotState = ShotState.Idle;
        Renderer[] _cueRenderers;
        bool _cueHiddenUntilBallsStop;

        void Update()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null)
            {
                return;
            }

            if (_cueHiddenUntilBallsStop)
            {
                if (!AreBallsMoving())
                {
                    SetCueVisualVisible(true);
                    _cueHiddenUntilBallsStop = false;
                }
                else
                {
                    return;
                }
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
            if (_latchedShotPower <= 0.02f)
            {
                _shotState = ShotState.Idle;
                _currentCueDepth = idleTipGap;
                UpdateCuePose();
                return;
            }

            StartCoroutine(StrikeRoutine(_latchedShotPower));
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
                        float aimPower = Mathf.Max(_power, sol.recommendedPower01);
                        float deflectionComp = aiming != null && aiming.config != null ? aiming.config.powerDeflectionCompensation : 1f;
                        float deflection = strikePhysics.ComputeDeflectionDegrees(spinInput.x, aimPower) * deflectionComp;
                        desiredDirection = Quaternion.AngleAxis(-deflection, Vector3.up) * desiredDirection;
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
            Vector3 pocketTarget = ResolveBestPocketTarget();
            ShotContext ctx = new ShotContext
            {
                cueBallPos = cueBall.position,
                objectBallPos = objectBall.position,
                pocketPos = pocketTarget,
                ballRadius = ballRadius,
                tableBounds = tableBounds,
                requiresPower = false,
                highSpin = spinInput.sqrMagnitude > 0.0001f,
                collisionMask = aiming.config ? aiming.config.collisionMask : default
            };
            return aiming.GetAimSolution(ctx);
        }

        Vector3 ResolveBestPocketTarget()
        {
            if (objectBall == null)
            {
                return pocket != null ? pocket.position : Vector3.zero;
            }

            float bestScore = float.NegativeInfinity;
            Vector3 bestTarget = pocket != null ? pocket.position : objectBall.position;
            bool hasCandidate = false;

            if (pocketMouths != null)
            {
                for (int i = 0; i < pocketMouths.Length; i++)
                {
                    PocketMouth mouth = pocketMouths[i];
                    if (mouth == null || !mouth.IsConfigured)
                    {
                        continue;
                    }

                    Vector3 mouthCenter = mouth.MouthCenterWorld;
                    Vector3 pocketCenter = mouth.PocketCenterWorld;
                    float bias = aiming != null && aiming.config != null ? aiming.config.pocketEntranceBias : 1f;
                    Vector3 target = Vector3.Lerp(pocketCenter, mouthCenter, Mathf.Clamp01(bias));
                    float score = ScorePocketTarget(target);
                    if (score > bestScore)
                    {
                        hasCandidate = true;
                        bestScore = score;
                        bestTarget = target;
                    }
                }
            }

            if (!hasCandidate && pocketFallbacks != null)
            {
                for (int i = 0; i < pocketFallbacks.Length; i++)
                {
                    Transform candidate = pocketFallbacks[i];
                    if (candidate == null)
                    {
                        continue;
                    }

                    float score = ScorePocketTarget(candidate.position);
                    if (score > bestScore)
                    {
                        hasCandidate = true;
                        bestScore = score;
                        bestTarget = candidate.position;
                    }
                }
            }

            return bestTarget;
        }

        float ScorePocketTarget(Vector3 target)
        {
            Vector3 objToPocket = target - objectBall.position;
            if (objToPocket.sqrMagnitude < 1e-6f)
            {
                return float.NegativeInfinity;
            }

            Vector3 objToCue = cueBall.position - objectBall.position;
            Vector3 toPocketDir = objToPocket.normalized;
            Vector3 toCueDir = objToCue.sqrMagnitude > 1e-6f ? objToCue.normalized : -toPocketDir;

            float approach = Mathf.Clamp01((-Vector3.Dot(toPocketDir, toCueDir) + 1f) * 0.5f);
            float openness = PhysicsUtil.SphereLineClear(objectBall.position, target, ballRadius * 0.98f,
                aiming != null && aiming.config != null ? aiming.config.collisionMask : default) ? 1f : 0f;

            float straightWeight = aiming != null && aiming.config != null ? aiming.config.straightShotPriority : 1.15f;
            float clearWeight = aiming != null && aiming.config != null ? aiming.config.clearEntrancePriority : 1.25f;
            float distancePenalty = objToPocket.magnitude * 0.15f;
            return (approach * straightWeight) + (openness * clearWeight) - distancePenalty;
        }

        bool AreBallsMoving()
        {
            return cueBallBody != null && cueBallBody.velocity.sqrMagnitude > 0.0004f;
        }

        IEnumerator StrikeRoutine(float shotPower)
        {
            _shotState = ShotState.Striking;
            SetCueVisualVisible(true);

            Vector3 strikeDirection = _aimDirection;
            float pull = pullRange * EaseOutCubic(shotPower);
            float startDepth = idleTipGap + pull;
            float hitDepth = idleTipGap;
            float contactDepth = contactTipGap;
            float elapsed = 0f;
            bool didStrike = false;
            float contactStartT = Mathf.Clamp01(1f - contactDrivePortion);
            float hitT = Mathf.Clamp01(Mathf.Max(hitProgress, contactStartT));
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

                if (!didStrike && t >= hitT)
                {
                    didStrike = true;
                    ApplyStrikeImpulse(strikeDirection, shotPower);
                    SetCueVisualVisible(false);
                    _cueHiddenUntilBallsStop = true;
                }

                yield return null;
            }

            if (!didStrike)
            {
                ApplyStrikeImpulse(strikeDirection, shotPower);
                SetCueVisualVisible(false);
                _cueHiddenUntilBallsStop = true;
            }

            _currentCueDepth = contactDepth;
            UpdateCuePose();
            yield return new WaitForSeconds(strikeHoldDuration);

            _currentCueDepth = idleTipGap;
            _power = 0f;
            _latchedShotPower = 0f;
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

        void Awake()
        {
            _cueRenderers = GetComponentsInChildren<Renderer>(true);
            SetCueVisualVisible(true);
        }

        void SetCueVisualVisible(bool visible)
        {
            if (_cueRenderers == null)
            {
                return;
            }

            for (int i = 0; i < _cueRenderers.Length; i++)
            {
                if (_cueRenderers[i] != null)
                {
                    _cueRenderers[i].enabled = visible;
                }
            }
        }
    }
}
