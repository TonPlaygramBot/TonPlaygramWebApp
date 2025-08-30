using UnityEngine;

namespace Aiming.Strategies
{
    public class ContactPointStrategy : IAimingStrategy
    {
        public string Name => "ContactPoint";

        public AimSolution Solve(in ShotContext ctx, in ShotInfo info, AimingConfig cfg)
        {
            Vector3 cpObj = ctx.objectBallPos - info.vOP * ctx.ballRadius;
            return new AimSolution
            {
                isValid = true,
                strategyUsed = Name,
                aimStart = ctx.cueBallPos,
                aimEnd = cpObj,
                recommendedPower01 = 0.5f,
                tipOffset = Vector2.zero,
                cueElevationDeg = 0f,
                debugNote = "Aim through object-ball contact point."
            };
        }
    }
}
