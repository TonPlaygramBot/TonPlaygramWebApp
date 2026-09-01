using UnityEngine;

namespace Aiming.Strategies
{
    public class GhostBallStrategy : IAimingStrategy
    {
        public string Name => "GhostBall";

        public AimSolution Solve(in ShotContext ctx, in ShotInfo info, AimingConfig cfg)
        {
            // The cue-ball centre must occupy this point at impact.  The old
            // calculation placed the target one radius beyond the object ball,
            // which made even a visually straight AI shot strike the wrong side.
            Vector3 ghost = ctx.objectBallPos - info.vOP * (ctx.ballRadius * 2f);
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
