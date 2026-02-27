using System;
using UnityEngine;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        public enum CueStrokeState
        {
            Idle,
            Charging,
            Release,
            FollowThrough,
            Recover
        }

        [Serializable]
        public struct ShotPlaybackRecord
        {
            public float timeStamp;
            public Vector3 aimDirection;
            [Range(0f, 1f)] public float powerNormalized;
            public float pullDistance;
            public float releaseSpeed;
            public float followThroughRatio;
            public float recoverSpeed;
        }

        [Header("References")]
        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall;
        public Transform objectBall;
        public Transform pocket;

        [Header("Table")]
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;

        [Header("Cue stroke tuning")]
        [Range(0f, 1f)] public float livePowerNormalized;
        public float minPullDistance = 0.045f;
        public float maxPullDistance = 0.18f;
        [Range(1.2f, 2.4f)] public float powerGamma = 1.8f;
        public float releaseSpeed = 2.2f;
        [Range(0.1f, 0.35f)] public float followThroughRatio = 0.2f;
        public float recoverSpeed = 0.9f;
        public float cueTipRestDistance = 0.065f;

        public CueStrokeState StrokeState => strokeState;
        public ShotPlaybackRecord LastShotRecord => lastShotRecord;

        public event Action<ShotPlaybackRecord> OnCueStrike;

        private CueStrokeState strokeState = CueStrokeState.Idle;
        private ShotPlaybackRecord lastShotRecord;

        private float currentPullOffset;
        private float frozenPullDistance;
        private float followThroughDistance;
        private bool strikeSent;

        private Vector3 currentAimDirection = Vector3.forward;
        private Vector3 cueTipLocalOffset = Vector3.zero;

        private void Awake()
        {
            if (cueTip != null)
            {
                cueTipLocalOffset = transform.InverseTransformPoint(cueTip.position);
            }
        }

        private void Update()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null)
            {
                return;
            }

            ResolveAimDirection();
            UpdateStrokeState(Time.deltaTime);
            UpdateCueTransform();
        }

        public void BeginCharging(float powerNormalized)
        {
            livePowerNormalized = Mathf.Clamp01(powerNormalized);
            strokeState = CueStrokeState.Charging;
            strikeSent = false;
        }

        public void UpdateChargePower(float powerNormalized)
        {
            livePowerNormalized = Mathf.Clamp01(powerNormalized);
            if (strokeState == CueStrokeState.Idle)
            {
                strokeState = CueStrokeState.Charging;
            }
        }

        public void CommitShot()
        {
            if (strokeState != CueStrokeState.Charging)
            {
                return;
            }

            frozenPullDistance = EvaluatePullDistance(livePowerNormalized);
            followThroughDistance = Mathf.Max(0.001f, frozenPullDistance * followThroughRatio);
            strokeState = CueStrokeState.Release;
            strikeSent = false;
        }

        public void TriggerAiShot(float powerNormalized)
        {
            BeginCharging(powerNormalized);
            currentPullOffset = EvaluatePullDistance(livePowerNormalized);
            CommitShot();
        }

        public void PlayReplayShot(ShotPlaybackRecord record)
        {
            currentAimDirection = record.aimDirection.sqrMagnitude > 1e-6f ? record.aimDirection.normalized : currentAimDirection;
            livePowerNormalized = Mathf.Clamp01(record.powerNormalized);

            releaseSpeed = Mathf.Max(0.05f, record.releaseSpeed);
            followThroughRatio = Mathf.Clamp(record.followThroughRatio, 0.1f, 0.35f);
            recoverSpeed = Mathf.Max(0.05f, record.recoverSpeed);

            frozenPullDistance = Mathf.Max(minPullDistance, record.pullDistance);
            followThroughDistance = Mathf.Max(0.001f, frozenPullDistance * followThroughRatio);
            currentPullOffset = frozenPullDistance;
            strokeState = CueStrokeState.Release;
            strikeSent = false;
        }

        private void ResolveAimDirection()
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

            var sol = aiming.GetAimSolution(ctx);
            if (!sol.isValid)
            {
                return;
            }

            Vector3 dir = sol.aimEnd - sol.aimStart;
            if (dir.sqrMagnitude <= 1e-6f)
            {
                return;
            }

            currentAimDirection = dir.normalized;
        }

        private void UpdateStrokeState(float deltaTime)
        {
            switch (strokeState)
            {
                case CueStrokeState.Idle:
                    currentPullOffset = Mathf.MoveTowards(currentPullOffset, 0f, deltaTime * recoverSpeed);
                    break;

                case CueStrokeState.Charging:
                    {
                        float targetPull = EvaluatePullDistance(livePowerNormalized);
                        currentPullOffset = Mathf.MoveTowards(currentPullOffset, targetPull, deltaTime * (recoverSpeed + 0.35f));
                        break;
                    }

                case CueStrokeState.Release:
                    {
                        currentPullOffset = Mathf.MoveTowards(currentPullOffset, -followThroughDistance, deltaTime * releaseSpeed);

                        if (!strikeSent && currentPullOffset <= 0f)
                        {
                            strikeSent = true;
                            lastShotRecord = new ShotPlaybackRecord
                            {
                                timeStamp = Time.time,
                                aimDirection = currentAimDirection,
                                powerNormalized = livePowerNormalized,
                                pullDistance = frozenPullDistance,
                                releaseSpeed = releaseSpeed,
                                followThroughRatio = followThroughRatio,
                                recoverSpeed = recoverSpeed
                            };
                            OnCueStrike?.Invoke(lastShotRecord);
                        }

                        if (Mathf.Approximately(currentPullOffset, -followThroughDistance))
                        {
                            strokeState = CueStrokeState.FollowThrough;
                        }
                        break;
                    }

                case CueStrokeState.FollowThrough:
                    strokeState = CueStrokeState.Recover;
                    break;

                case CueStrokeState.Recover:
                    currentPullOffset = Mathf.MoveTowards(currentPullOffset, 0f, deltaTime * recoverSpeed);
                    if (Mathf.Approximately(currentPullOffset, 0f))
                    {
                        strokeState = CueStrokeState.Idle;
                    }
                    break;
            }
        }

        private void UpdateCueTransform()
        {
            Vector3 aimDirection = currentAimDirection.sqrMagnitude > 1e-6f ? currentAimDirection.normalized : transform.forward;
            transform.rotation = Quaternion.LookRotation(aimDirection, Vector3.up);

            Vector3 tipPosition = cueBall.position - aimDirection * (cueTipRestDistance + currentPullOffset);
            Vector3 rootPosition = tipPosition - transform.TransformVector(cueTipLocalOffset);
            transform.position = rootPosition;

            if (cueTip != null && cueTip.parent != transform)
            {
                cueTip.position = tipPosition;
                cueTip.rotation = transform.rotation;
            }
        }

        private float EvaluatePullDistance(float normalizedPower)
        {
            float curvedPower = Mathf.Pow(Mathf.Clamp01(normalizedPower), powerGamma);
            return Mathf.Lerp(minPullDistance, maxPullDistance, curvedPower);
        }
    }
}
