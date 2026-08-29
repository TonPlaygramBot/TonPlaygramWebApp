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
        [Tooltip("Additional straight top-spin follow-through when side spin is near zero.")]
        public float straightTopSpinFollowBoost = 0.06f;
        [Tooltip("Side spin threshold for straight top-spin follow-through boost.")]
        [Range(0f, 1f)] public float straightTopSpinSideThreshold = 0.08f;
        [Tooltip("Reverse impulse for back spin (draw).")]
        public float backSpinReverseImpulseScale = 0.10f;
        [Tooltip("Torque multiplier for side spin (left/right english).")]
        public float sideSpinTorqueScale = 0.02f;
        [Tooltip("Torque multiplier for top/back spin.")]
        public float verticalSpinTorqueScale = 0.025f;
        [Tooltip("Legacy setting retained for existing scenes. Linear strike direction is always exact; spin is applied as torque only.")]
        [Range(0f, 1f)] public float spinDeflectionReduction = 1f;

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

            // Apply all linear energy through the centre of mass. An off-centre
            // AddForceAtPosition can make the simulated path disagree with the
            // guide at high power or spin. Spin remains visual and physical, but
            // is isolated to angular velocity so it cannot rotate the initial path.
            cueBallBody.AddForce(planarDirection * impulseMagnitude, ForceMode.Impulse);

            if (Mathf.Abs(clampedSpin.x) > Mathf.Epsilon || Mathf.Abs(clampedSpin.y) > Mathf.Epsilon)
            {
                Vector3 torque = (Vector3.up * (-clampedSpin.x) * sideSpinTorqueScale +
                    right * clampedSpin.y * verticalSpinTorqueScale) * impulseMagnitude;
                cueBallBody.AddTorque(torque, ForceMode.Impulse);

            }
        }
    }
}
