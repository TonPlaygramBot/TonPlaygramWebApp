using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [DisallowMultipleComponent]
    public class TennisPlayerCameraRig : MonoBehaviour
    {
        [Header("Targets")]
        [SerializeField] private Transform player;
        [SerializeField] private Rigidbody ballBody;
        [SerializeField] private Transform cameraTransform;

        [Header("Follow Framing")]
        [SerializeField] private Vector3 baseOffset = new Vector3(0f, 4.3f, -7.2f);
        [SerializeField] private Vector3 incomingExtraOffset = new Vector3(0f, 1.0f, -2.2f);
        [SerializeField, Range(0f, 1f)] private float ballLookWeight = 0.62f;
        [SerializeField, Min(0.01f)] private float positionSharpness = 8f;
        [SerializeField, Min(0.01f)] private float rotationSharpness = 10f;
        [SerializeField, Min(0.01f)] private float ballSpeedForFullPullback = 18f;
        [SerializeField] private Vector2 pitchLimits = new Vector2(8f, 58f);

        private void Reset()
        {
            cameraTransform = Camera.main != null ? Camera.main.transform : transform;
        }

        private void LateUpdate()
        {
            if (player == null) return;
            Transform cam = cameraTransform != null ? cameraTransform : transform;

            float incoming01 = GetIncomingPressure01();
            Vector3 playerForward = player.forward;
            playerForward.y = 0f;
            if (playerForward.sqrMagnitude < 0.001f) playerForward = Vector3.forward;
            playerForward.Normalize();

            Vector3 offset = baseOffset + (incomingExtraOffset * incoming01);
            Vector3 desiredPosition = player.position
                + (player.right * offset.x)
                + (Vector3.up * offset.y)
                - (playerForward * Mathf.Abs(offset.z));

            cam.position = Vector3.Lerp(cam.position, desiredPosition, 1f - Mathf.Exp(-positionSharpness * Time.deltaTime));

            Vector3 lookPoint = player.position + Vector3.up * 1.45f;
            if (ballBody != null)
            {
                Vector3 predictedBall = ballBody.position + (ballBody.velocity * 0.18f);
                lookPoint = Vector3.Lerp(lookPoint, predictedBall, ballLookWeight * incoming01);
            }

            Vector3 lookDirection = lookPoint - cam.position;
            if (lookDirection.sqrMagnitude < 0.001f) return;

            Quaternion desiredRotation = Quaternion.LookRotation(lookDirection.normalized, Vector3.up);
            Vector3 euler = desiredRotation.eulerAngles;
            euler.x = NormalizePitch(euler.x);
            euler.x = Mathf.Clamp(euler.x, pitchLimits.x, pitchLimits.y);
            desiredRotation = Quaternion.Euler(euler.x, euler.y, 0f);
            cam.rotation = Quaternion.Slerp(cam.rotation, desiredRotation, 1f - Mathf.Exp(-rotationSharpness * Time.deltaTime));
        }

        private float GetIncomingPressure01()
        {
            if (ballBody == null || player == null) return 0f;

            Vector3 toPlayer = player.position - ballBody.position;
            toPlayer.y = 0f;
            Vector3 ballVelocity = ballBody.velocity;
            ballVelocity.y = 0f;
            if (ballVelocity.sqrMagnitude < 0.01f || toPlayer.sqrMagnitude < 0.01f) return 0f;

            float headingToPlayer = Mathf.Clamp01(Vector3.Dot(ballVelocity.normalized, toPlayer.normalized));
            float speed01 = Mathf.Clamp01(ballBody.velocity.magnitude / ballSpeedForFullPullback);
            return headingToPlayer * speed01;
        }

        private static float NormalizePitch(float pitch)
        {
            return pitch > 180f ? pitch - 360f : pitch;
        }
    }
}
