using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [DisallowMultipleComponent]
    public class TennisShotTuning : MonoBehaviour
    {
        [Header("Power")]
        [Min(1f)] public float baseShotPower = 17.5f;
        [Range(0.1f, 1f)] public float maxMatchPower01 = 0.82f;
        [Range(0f, 2f)] public float topspin = 0.35f;
        [Range(0f, 2f)] public float sidespin = 0.2f;
        [Range(0f, 2f)] public float curvePower = 0.5f;

        public void ApplyShot(Rigidbody ballBody, Vector3 aimDirection, float normalizedPower, ShotVariant variant)
        {
            if (ballBody == null) return;

            var dir = aimDirection.sqrMagnitude > 0.0001f ? aimDirection.normalized : transform.forward;
            float matchPower = Mathf.Clamp(normalizedPower, 0f, maxMatchPower01);
            float power = baseShotPower * matchPower;

            float variantPowerMultiplier = variant == ShotVariant.Power ? 1.08f : 1f;
            float finalPower = power * variantPowerMultiplier;

            ballBody.AddForce(dir * finalPower, ForceMode.Impulse);

            Vector3 right = Vector3.Cross(Vector3.up, dir).normalized;
            float side = variant == ShotVariant.CurveLeft ? -1f : variant == ShotVariant.CurveRight ? 1f : 0f;
            float spinY = (variant == ShotVariant.Topspin ? topspin : 0.15f) * finalPower;

            ballBody.AddTorque((Vector3.right * spinY) + (right * side * sidespin * finalPower), ForceMode.Impulse);
            if (Mathf.Abs(side) > 0f)
            {
                ballBody.AddForce(right * side * curvePower * matchPower, ForceMode.Impulse);
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
