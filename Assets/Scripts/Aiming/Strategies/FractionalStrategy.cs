using UnityEngine;

namespace Aiming.Strategies
{
    public class FractionalStrategy : IAimingStrategy
    {
        public string Name => "Fractional";

        float MapAngleToFraction(float angle)
        {
            if (angle <= 30f) return 0.5f;
            if (angle >= 60f) return 0.125f;
            if (angle <= 48f)
            {
                float t = (angle - 30f) / 18f;
                return Mathf.Lerp(0.5f, 0.25f, t);
            }
            else
            {
                float t = (angle - 48f) / 12f;
                return Mathf.Lerp(0.25f, 0.125f, t);
            }
        }

        public AimSolution Solve(in ShotContext ctx, in ShotInfo info, AimingConfig cfg)
        {
            float f = MapAngleToFraction(info.angleDeg);
            Vector3 perp = MathUtil.OrthoAround(info.vOP, Vector3.up);
            float sign = Mathf.Sign(Vector3.Dot(perp, (ctx.cueBallPos - ctx.objectBallPos)));
            Vector3 cpRing = ctx.objectBallPos - info.vOP * ctx.ballRadius + (perp * sign * f * ctx.ballRadius);
            return new AimSolution
            {
                isValid = true,
                strategyUsed = Name,
                aimStart = ctx.cueBallPos,
                aimEnd = cpRing,
                recommendedPower01 = 0.6f,
                tipOffset = Vector2.zero,
                cueElevationDeg = 0f,
                debugNote = $"Fraction={f:0.###}"
            };
        }
    }
}
