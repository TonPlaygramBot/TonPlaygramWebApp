using UnityEngine;

namespace Aiming.Strategies
{
    public class GhostBallStrategy : IAimingStrategy
    {
        public string Name => "GhostBall";

        public AimSolution Solve(in ShotContext ctx, in ShotInfo info, AimingConfig cfg)
        {
            Vector3 cpObj = ctx.objectBallPos - info.vOP * ctx.ballRadius;
            Vector3 toObj = (cpObj - ctx.objectBallPos).normalized;
            Vector3 ghost = cpObj - toObj * (ctx.ballRadius * 2f);
            return new AimSolution
            {
                isValid = true,
                strategyUsed = Name,
                aimStart = ctx.cueBallPos,
                aimEnd = ghost,
                recommendedPower01 = 0.5f,
                tipOffset = Vector2.zero,
                cueElevationDeg = 0f,
                debugNote = "Ghost point computed."
            };
        }
    }
}
