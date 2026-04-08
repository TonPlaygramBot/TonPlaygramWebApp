using UnityEngine;

namespace Aiming
{
    /// <summary>
    /// Chooses the most pot-able target by evaluating all object-ball / pocket pairs.
    /// </summary>
    [DisallowMultipleComponent]
    public class AutoTargetSelector : MonoBehaviour
    {
        [SerializeField] private AdaptiveAimingEngine aiming;
        [SerializeField] private Transform cueBall;
        [SerializeField] private Transform[] objectBalls = new Transform[0];
        [SerializeField] private Transform[] pockets = new Transform[0];
        [SerializeField] private Bounds tableBounds;
        [SerializeField, Min(0.001f)] private float ballRadius = 0.028575f;
        [SerializeField, Min(0f)] private float cueDistancePenalty = 0.8f;
        [SerializeField, Min(0f)] private float pocketDistancePenalty = 0.35f;
        [SerializeField, Range(0f, 2f)] private float cutAnglePenalty = 1.1f;

        public bool TrySelectBest(out Transform bestObjectBall, out Transform bestPocket, out float bestProbability, out AimSolution bestSolution)
        {
            bestObjectBall = null;
            bestPocket = null;
            bestSolution = default;
            bestProbability = 0f;

            if (aiming == null || cueBall == null || objectBalls == null || pockets == null)
            {
                return false;
            }

            LayerMask mask = aiming.config ? aiming.config.collisionMask : default;
            bool hasTarget = false;

            for (int i = 0; i < objectBalls.Length; i++)
            {
                Transform objectBall = objectBalls[i];
                if (objectBall == null || !objectBall.gameObject.activeInHierarchy || objectBall == cueBall)
                    continue;

                for (int p = 0; p < pockets.Length; p++)
                {
                    Transform pocket = pockets[p];
                    if (pocket == null || !pocket.gameObject.activeInHierarchy)
                        continue;

                    ShotContext ctx = new ShotContext
                    {
                        cueBallPos = cueBall.position,
                        objectBallPos = objectBall.position,
                        pocketPos = pocket.position,
                        ballRadius = ballRadius,
                        tableBounds = tableBounds,
                        requiresPower = false,
                        highSpin = false,
                        collisionMask = mask
                    };

                    if (!aiming.TryGetAimSolution(ctx, out AimSolution sol, visualize: false))
                        continue;

                    float probability = EstimateProbability(ctx, sol, mask);
                    if (!hasTarget || probability > bestProbability)
                    {
                        bestProbability = probability;
                        bestObjectBall = objectBall;
                        bestPocket = pocket;
                        bestSolution = sol;
                        hasTarget = true;
                    }
                }
            }

            return hasTarget;
        }

        float EstimateProbability(in ShotContext ctx, in AimSolution sol, LayerMask mask)
        {
            float losRadius = ctx.ballRadius * 0.98f;
            bool cueToObjClear = PhysicsUtil.SphereLineClear(ctx.cueBallPos, ctx.objectBallPos, losRadius, mask);
            bool objToPocketClear = PhysicsUtil.SphereLineClear(ctx.objectBallPos, ctx.pocketPos, losRadius, mask);
            bool cueToAimClear = PhysicsUtil.SphereLineClear(ctx.cueBallPos, sol.aimEnd, ctx.ballRadius * 0.92f, mask);
            if (!cueToObjClear || !objToPocketClear || !cueToAimClear)
                return 0f;

            Vector3 cueToObject = ctx.objectBallPos - ctx.cueBallPos;
            Vector3 objectToPocket = ctx.pocketPos - ctx.objectBallPos;
            if (cueToObject.sqrMagnitude < 1e-8f || objectToPocket.sqrMagnitude < 1e-8f)
                return 0f;

            float cutAngle = Vector3.Angle(cueToObject, objectToPocket);
            float cueDistance = cueToObject.magnitude;
            float pocketDistance = objectToPocket.magnitude;

            float cutFactor = Mathf.Exp(-(cutAngle / 90f) * cutAnglePenalty);
            float cueDistanceFactor = 1f / (1f + cueDistancePenalty * cueDistance);
            float pocketDistanceFactor = 1f / (1f + pocketDistancePenalty * pocketDistance);
            return Mathf.Clamp01(cutFactor * cueDistanceFactor * pocketDistanceFactor);
        }
    }
}
