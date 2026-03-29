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
        [Tooltip("Maximum cue-ball squirt angle (degrees) at full side spin and full power.")]
        [Range(0f, 8f)] public float maxPowerDeflectionDeg = 2.2f;
        [Tooltip("How strongly top spin converts to natural rolling follow after contact.")]
        [Range(0f, 0.5f)] public float topSpinFollowRollScale = 0.18f;

        public float ComputeDeflectionDegrees(float sideSpin, float normalizedPower)
        {
            float clampedSide = Mathf.Clamp(sideSpin, -1f, 1f);
            float powerFactor = Mathf.Clamp01(normalizedPower);
            return clampedSide * maxPowerDeflectionDeg * powerFactor;
        }

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

            float normalizedPower = Mathf.Clamp01((impulseMagnitude - 1.8f) / Mathf.Max(0.01f, 6.5f - 1.8f));
            float deflectionDeg = ComputeDeflectionDegrees(clampedSpin.x, normalizedPower);
            Vector3 compensatedDirection = Quaternion.AngleAxis(deflectionDeg, Vector3.up) * planarDirection;

            cueBallBody.AddForceAtPosition(compensatedDirection * impulseMagnitude, contactPoint, ForceMode.Impulse);

            if (Mathf.Abs(clampedSpin.x) > Mathf.Epsilon || Mathf.Abs(clampedSpin.y) > Mathf.Epsilon)
            {
                Vector3 torque = (Vector3.up * (-clampedSpin.x) * sideSpinTorqueScale +
                    right * clampedSpin.y * verticalSpinTorqueScale) * impulseMagnitude;
                cueBallBody.AddTorque(torque, ForceMode.Impulse);

                float topSpin = Mathf.Max(0f, clampedSpin.y);
                float follow = topSpin * topSpinForwardImpulseScale;
                float draw = Mathf.Max(0f, -clampedSpin.y) * backSpinReverseImpulseScale;
                float spinLinearImpulse = (follow - draw) * impulseMagnitude;
                if (Mathf.Abs(spinLinearImpulse) > Mathf.Epsilon)
                {
                    cueBallBody.AddForce(compensatedDirection * spinLinearImpulse, ForceMode.Impulse);
                }

                if (topSpin > 0f)
                {
                    float rollAssist = topSpin * normalizedPower * topSpinFollowRollScale * impulseMagnitude;
                    if (rollAssist > Mathf.Epsilon)
                    {
                        cueBallBody.AddForce(compensatedDirection * rollAssist, ForceMode.Impulse);
                    }
                }
            }
        }
    }
}
