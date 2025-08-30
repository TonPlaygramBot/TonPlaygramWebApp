using UnityEngine;

namespace Aiming.Strategies
{
    public class CTEApproxStrategy : IAimingStrategy
    {
        public string Name => "CTEApprox";

        public AimSolution Solve(in ShotContext ctx, in ShotInfo info, AimingConfig cfg)
        {
            Vector3 perp = MathUtil.OrthoAround(info.vOP, Vector3.up);
            float side = Mathf.Sign(Vector3.Dot(perp, (ctx.cueBallPos - ctx.objectBallPos)));
            Vector3 edge = ctx.objectBallPos + perp * side * ctx.ballRadius;

            Quaternion pivot = Quaternion.AngleAxis(cfg.ctePivotDeg * side, Vector3.up);
            Vector3 pivoted = ctx.objectBallPos + pivot * (edge - ctx.objectBallPos);

            return new AimSolution
            {
                isValid = true,
                strategyUsed = Name,
                aimStart = ctx.cueBallPos,
                aimEnd = pivoted,
                recommendedPower01 = 0.7f,
                tipOffset = Vector2.zero,
                cueElevationDeg = 0f,
                debugNote = "CTE approx with small pivot."
            };
        }
    }
}
