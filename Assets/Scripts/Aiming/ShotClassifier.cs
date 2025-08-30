using UnityEngine;

namespace Aiming
{
    public struct ShotInfo
    {
        public float angleDeg;
        public bool isStraight;
        public bool isRailShot;
        public bool losCueToObj, losObjToPocket;
        public ShotClassifier.DistBucket distBucket;
        public Vector3 vOP;
        public Vector3 vOC;
    }

    public class ShotClassifier
    {
        public enum DistBucket { Short, Medium, Long }

        public ShotInfo Classify(in ShotContext ctx, AimingConfig cfg)
        {
            var vOP = (ctx.pocketPos - ctx.objectBallPos).normalized;
            var vOC = (ctx.cueBallPos - ctx.objectBallPos).normalized;
            float dot = Mathf.Clamp(Vector3.Dot(vOP, vOC), -1f, 1f);
            float angle = Mathf.Acos(dot) * Mathf.Rad2Deg;
            bool isStraight = angle <= cfg.straightAngleDeg;

            float d = Vector3.Distance(ctx.cueBallPos, ctx.objectBallPos);
            DistBucket bucket =
                d <= cfg.shortDist ? DistBucket.Short :
                (d <= cfg.mediumDist ? DistBucket.Medium : DistBucket.Long);

            bool rail = MathUtil.ClosestRailDistance(ctx.tableBounds, ctx.objectBallPos) <= (ctx.ballRadius * 2f)
                || MathUtil.ClosestRailDistance(ctx.tableBounds, ctx.pocketPos) <= (ctx.ballRadius * 2f);

            bool losCO = PhysicsUtil.SphereLineClear(ctx.cueBallPos, ctx.objectBallPos, ctx.ballRadius * 0.98f, ctx.collisionMask);
            bool losOP = PhysicsUtil.SphereLineClear(ctx.objectBallPos, ctx.pocketPos, ctx.ballRadius * 0.98f, ctx.collisionMask);

            return new ShotInfo
            {
                angleDeg = angle,
                isStraight = isStraight,
                isRailShot = rail,
                losCueToObj = losCO,
                losObjToPocket = losOP,
                distBucket = bucket,
                vOP = vOP,
                vOC = vOC
            };
        }
    }
}
