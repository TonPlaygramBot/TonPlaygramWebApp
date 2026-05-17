using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [DisallowMultipleComponent]
    public class TennisShotTuning : MonoBehaviour
    {
        [Header("Power")]
        [Min(1f)] public float baseShotPower = 14.25f;
        [Range(0.1f, 1f)] public float maxMatchPower01 = 0.68f;
        [Range(0f, 2f)] public float topspin = 0.35f;
        [Range(0f, 2f)] public float sidespin = 0.2f;
        [Range(0f, 2f)] public float curvePower = 0.5f;

        [Header("Dynamic contact")]
        [Range(0f, 1f)] public float incomingVelocityCarry = 0.22f;
        [Range(0f, 1f)] public float offCenterPowerLoss = 0.38f;
        [Range(0f, 1f)] public float racketVelocityInfluence = 0.3f;
        [Min(0f)] public float minimumLift = 0.18f;
        [Min(0f)] public float precisionSpinBonus = 0.45f;

        public void ApplyShot(Rigidbody ballBody, Vector3 aimDirection, float normalizedPower, ShotVariant variant)
        {
            ApplyContactShot(ballBody, aimDirection, normalizedPower, variant, 1f, Vector3.zero);
        }

        public void ApplyContactShot(Rigidbody ballBody, Vector3 aimDirection, float normalizedPower, ShotVariant variant, float sweetSpot01, Vector3 racketVelocity)
        {
            if (ballBody == null) return;

            var dir = aimDirection.sqrMagnitude > 0.0001f ? aimDirection.normalized : transform.forward;
            if (dir.y < minimumLift)
            {
                dir = new Vector3(dir.x, minimumLift, dir.z).normalized;
            }

            float contactQuality = Mathf.Clamp01(sweetSpot01);
            float matchPower = Mathf.Clamp(normalizedPower, 0f, maxMatchPower01);
            float centeredPower = Mathf.Lerp(matchPower * (1f - offCenterPowerLoss), matchPower, contactQuality);
            float power = baseShotPower * centeredPower;

            float variantPowerMultiplier = variant == ShotVariant.Power ? 1.08f : 1f;
            float racketBoost = racketVelocity.magnitude * racketVelocityInfluence * Mathf.Lerp(0.35f, 1f, contactQuality);
            float finalPower = (power * variantPowerMultiplier) + racketBoost;

            Vector3 retainedIncoming = Vector3.Project(ballBody.velocity, dir) * incomingVelocityCarry;
            ballBody.velocity = retainedIncoming;
            ballBody.AddForce(dir * finalPower, ForceMode.Impulse);

            Vector3 right = Vector3.Cross(Vector3.up, dir).normalized;
            if (right.sqrMagnitude < 0.001f) right = transform.right;

            float side = variant == ShotVariant.CurveLeft ? -1f : variant == ShotVariant.CurveRight ? 1f : 0f;
            float spinMultiplier = Mathf.Lerp(0.5f, 1f + precisionSpinBonus, contactQuality);
            float spinY = (variant == ShotVariant.Topspin ? topspin : 0.15f) * finalPower * spinMultiplier;

            ballBody.AddTorque((Vector3.right * spinY) + (right * side * sidespin * finalPower * spinMultiplier), ForceMode.Impulse);
            if (Mathf.Abs(side) > 0f)
            {
                ballBody.AddForce(right * side * curvePower * centeredPower * contactQuality, ForceMode.Impulse);
            }
        }
    }

    public enum ShotVariant
    {
        Flat,
        Power,
        Topspin,
        CurveLeft,
        CurveRight
    }
}
