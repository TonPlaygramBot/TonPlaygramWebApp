using UnityEngine;

namespace Aiming
{
    /// <summary>
    /// Keeps the active camera transform in the player's last position and only rotates it
    /// toward the currently suggested aim line.
    /// </summary>
    public class CameraAimAssistController : MonoBehaviour
    {
        public enum CameraViewMode
        {
            Cue,
            Standing
        }

        [Header("Aiming Inputs")]
        public AdaptiveAimingEngine aiming;
        public Transform cueBall;
        public Transform objectBall;
        public Transform pocket;
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;

        [Header("View Targets")]
        public Transform cueCameraTransform;
        public Transform standingCameraTransform;
        public CameraViewMode activeViewMode = CameraViewMode.Cue;

        [Header("Rotation")]
        [Tooltip("How quickly the camera rotates toward the suggested aim direction.")]
        public float turnSpeed = 8f;
        [Tooltip("Height offset used so the camera looks through the center of the balls on the table.")]
        public float tableLookHeight = 0.03f;

        Vector3 _lastValidDirection = Vector3.forward;

        void LateUpdate()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null) return;

            Transform activeCamera = GetActiveCameraTransform();
            if (activeCamera == null) return;

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
            Vector3 desiredDirection = _lastValidDirection;

            if (sol.isValid)
            {
                Vector3 aimDirection = sol.aimEnd - sol.aimStart;
                if (aimDirection.sqrMagnitude > 1e-6f)
                {
                    desiredDirection = aimDirection.normalized;
                    _lastValidDirection = desiredDirection;
                }
            }

            Vector3 targetPoint = sol.isValid ? sol.aimEnd : (cueBall.position + desiredDirection);
            targetPoint.y = cueBall.position.y + tableLookHeight;

            Vector3 lookDirection = targetPoint - activeCamera.position;
            if (lookDirection.sqrMagnitude <= 1e-6f) return;

            Quaternion targetRotation = Quaternion.LookRotation(lookDirection.normalized, Vector3.up);
            activeCamera.rotation = Quaternion.Slerp(
                activeCamera.rotation,
                targetRotation,
                1f - Mathf.Exp(-turnSpeed * Time.deltaTime)
            );
        }

        public void SetViewMode(CameraViewMode viewMode)
        {
            activeViewMode = viewMode;
        }

        Transform GetActiveCameraTransform()
        {
            if (activeViewMode == CameraViewMode.Standing && standingCameraTransform != null)
            {
                return standingCameraTransform;
            }

            if (activeViewMode == CameraViewMode.Cue && cueCameraTransform != null)
            {
                return cueCameraTransform;
            }

            return cueCameraTransform != null ? cueCameraTransform : standingCameraTransform;
        }
    }
}
