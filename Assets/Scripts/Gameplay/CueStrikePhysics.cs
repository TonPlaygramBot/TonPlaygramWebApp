using UnityEngine;

namespace Aiming
{
    // Adapted to this project from the open-source pool-sharky cue strike pattern
    // (AddForceAtPosition-based cue hit), then extended for full spin and torque control.
    [System.Serializable]
    public class CueStrikePhysics
    {
        [Header("Spin translation from tip offset")]
        [Tooltip("Max normalized UI spin radius that maps to the cue-ball contact point.")]
        [Range(0.1f, 1f)] public float maxSpinInput = 0.85f;
        [Tooltip("How far from center the cue can hit (as a fraction of ball radius).")]
        [Range(0.1f, 1f)] public float contactRadiusFactor = 0.82f;

        [Header("Open-source style impulse model")]
        [Tooltip("Extra forward impulse for top spin (follow).")]
        public float topSpinForwardImpulseScale = 0.12f;
        [Tooltip("Reverse impulse for back spin (draw).")]
        public float backSpinReverseImpulseScale = 0.10f;
        [Tooltip("Torque multiplier for side spin (left/right english).")]
        public float sideSpinTorqueScale = 0.05f;
        [Tooltip("Torque multiplier for top/back spin.")]
        public float verticalSpinTorqueScale = 0.06f;

        public void Apply(Rigidbody cueBallBody, Vector3 strikeDirection, float impulseMagnitude, Vector2 spinInput, float ballRadius)
        {
            if (cueBallBody == null)
            {
                return;
            }

            Vector3 planarDirection = Vector3.ProjectOnPlane(strikeDirection, Vector3.up);
            if (planarDirection.sqrMagnitude < 1e-6f)
            {
                planarDirection = strikeDirection.sqrMagnitude > 1e-6f ? strikeDirection.normalized : Vector3.forward;
            }
            else
            {
                planarDirection.Normalize();
            }

            Vector2 clampedSpin = Vector2.ClampMagnitude(spinInput, maxSpinInput);
            Vector3 right = Vector3.Cross(Vector3.up, planarDirection).normalized;
            Vector3 contactOffset = ((right * clampedSpin.x) + (Vector3.up * clampedSpin.y)) * (ballRadius * contactRadiusFactor);
            Vector3 contactPoint = cueBallBody.worldCenterOfMass + contactOffset;

            cueBallBody.AddForceAtPosition(planarDirection * impulseMagnitude, contactPoint, ForceMode.Impulse);

            if (Mathf.Abs(clampedSpin.x) > Mathf.Epsilon || Mathf.Abs(clampedSpin.y) > Mathf.Epsilon)
            {
                Vector3 torque = (Vector3.up * (-clampedSpin.x) * sideSpinTorqueScale +
                    right * clampedSpin.y * verticalSpinTorqueScale) * impulseMagnitude;
                cueBallBody.AddTorque(torque, ForceMode.Impulse);

                float follow = Mathf.Max(0f, clampedSpin.y) * topSpinForwardImpulseScale;
                float draw = Mathf.Max(0f, -clampedSpin.y) * backSpinReverseImpulseScale;
                float spinLinearImpulse = (follow - draw) * impulseMagnitude;
                if (Mathf.Abs(spinLinearImpulse) > Mathf.Epsilon)
                {
                    cueBallBody.AddForce(planarDirection * spinLinearImpulse, ForceMode.Impulse);
                }
            }
        }
    }
}
