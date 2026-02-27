using UnityEngine;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        private enum CueStrokeState
        {
            Idle,
            Charging,
            Release,
            FollowThrough,
            Recover
        }

        [Header("Aiming")]
        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall, objectBall, pocket;
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;

        [Header("Stroke")]
        [Range(0f, 1f)] public float inputPowerNormalized = 0.55f;
        public float minPullDistance = 0.02f;
        public float maxPullDistance = 0.12f;
        [Range(1f, 3f)] public float pullCurveGamma = 1.8f;
        public float chargingSpeed = 1.8f;
        public float releaseSpeed = 4.8f;
        [Range(0.1f, 0.35f)] public float followThroughRatio = 0.2f;
        public float recoverSpeed = 2.4f;
        public float strikeDistanceThreshold = 0.0025f;

        [Header("Camera Lock")]
        public Camera lockedShotCamera;
        public Camera[] camerasToDisableDuringStroke;
        public float postStrikeCameraBuffer = 0.2f;

        public bool IsCameraLocked => cameraLockTimer > 0f;

        private CueStrokeState strokeState = CueStrokeState.Idle;
        private float pulledDistance;
        private float releaseStartPull;
        private float releasePower;
        private float followThroughDistance;
        private bool strikeApplied;
        private float cameraLockTimer;

        private Vector3 aimOrigin;
        private Vector3 aimDirection = Vector3.forward;
        private bool hasValidAim;

        void Update()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null || cueTip == null) return;

            UpdateAim();
            UpdateStroke(Time.deltaTime);
            UpdateCameraLock(Time.deltaTime);
            ApplyCuePose();

            if (Input.GetKeyDown(KeyCode.Space) && strokeState == CueStrokeState.Idle)
            {
                StartStroke(inputPowerNormalized);
            }
        }

        public void StartCharging(float normalizedPower)
        {
            if (!hasValidAim) return;
            strokeState = CueStrokeState.Charging;
            inputPowerNormalized = Mathf.Clamp01(normalizedPower);
        }

        public void StartStroke(float normalizedPower)
        {
            if (!hasValidAim) return;

            inputPowerNormalized = Mathf.Clamp01(normalizedPower);
            releasePower = inputPowerNormalized;
            releaseStartPull = MapPowerToPullDistance(releasePower);
            pulledDistance = releaseStartPull;
            followThroughDistance = releaseStartPull * followThroughRatio;
            strikeApplied = false;
            strokeState = CueStrokeState.Release;
            SetCameraLock(true);
        }

        private void UpdateAim()
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
                hasValidAim = false;
                return;
            }

            Vector3 dir = sol.aimEnd - sol.aimStart;
            if (dir.sqrMagnitude <= 1e-6f)
            {
                hasValidAim = false;
                return;
            }

            hasValidAim = true;
            aimOrigin = sol.aimStart;
            aimDirection = dir.normalized;
        }

        private void UpdateStroke(float deltaTime)
        {
            float targetPull = MapPowerToPullDistance(inputPowerNormalized);

            switch (strokeState)
            {
                case CueStrokeState.Idle:
                    pulledDistance = Mathf.MoveTowards(pulledDistance, 0f, recoverSpeed * deltaTime);
                    break;
                case CueStrokeState.Charging:
                    pulledDistance = Mathf.MoveTowards(pulledDistance, targetPull, chargingSpeed * deltaTime);
                    break;
                case CueStrokeState.Release:
                    pulledDistance = Mathf.MoveTowards(pulledDistance, -followThroughDistance, releaseSpeed * deltaTime);

                    if (!strikeApplied && IsTipAtStrikeDistance())
                    {
                        strikeApplied = true;
                        cameraLockTimer = Mathf.Max(cameraLockTimer, postStrikeCameraBuffer);
                    }

                    if (pulledDistance <= -followThroughDistance + 1e-4f)
                    {
                        strokeState = CueStrokeState.FollowThrough;
                    }
                    break;
                case CueStrokeState.FollowThrough:
                    strokeState = CueStrokeState.Recover;
                    break;
                case CueStrokeState.Recover:
                    pulledDistance = Mathf.MoveTowards(pulledDistance, 0f, recoverSpeed * deltaTime);
                    if (Mathf.Abs(pulledDistance) <= 1e-4f)
                    {
                        pulledDistance = 0f;
                        strokeState = CueStrokeState.Idle;
                    }
                    break;
            }
        }

        private bool IsTipAtStrikeDistance()
        {
            if (!hasValidAim || cueTip == null || cueBall == null) return false;
            return Vector3.Distance(cueTip.position, cueBall.position) <= strikeDistanceThreshold;
        }

        private void UpdateCameraLock(float deltaTime)
        {
            if (cameraLockTimer <= 0f) return;
            cameraLockTimer -= deltaTime;
            if (cameraLockTimer <= 0f)
            {
                cameraLockTimer = 0f;
                SetCameraLock(false);
            }
        }

        private void SetCameraLock(bool locked)
        {
            if (locked)
            {
                cameraLockTimer = Mathf.Max(cameraLockTimer, postStrikeCameraBuffer);
            }

            if (lockedShotCamera != null)
            {
                lockedShotCamera.enabled = true;
            }

            if (camerasToDisableDuringStroke == null) return;
            for (int i = 0; i < camerasToDisableDuringStroke.Length; i++)
            {
                var cam = camerasToDisableDuringStroke[i];
                if (cam == null) continue;
                cam.enabled = !locked;
            }
        }

        private void ApplyCuePose()
        {
            if (!hasValidAim) return;

            transform.position = aimOrigin - aimDirection * pulledDistance;
            transform.rotation = Quaternion.LookRotation(aimDirection, Vector3.up);
            cueTip.position = transform.position + aimDirection * 0.1f;
        }

        private float MapPowerToPullDistance(float power)
        {
            float curved = Mathf.Pow(Mathf.Clamp01(power), pullCurveGamma);
            return Mathf.Lerp(minPullDistance, maxPullDistance, curved);
        }
    }
}
