using UnityEngine;
using System.Runtime.CompilerServices;

namespace Aiming
{
    public struct ShotContext
    {
        public Vector3 cueBallPos, objectBallPos;
        public Vector3 pocketPos;
        public float ballRadius;
        public Bounds tableBounds;
        public bool requiresPower;
        public bool highSpin;
        public LayerMask collisionMask;
    }

    public struct AimSolution
    {
        public bool isValid;
        public string strategyUsed;
        public Vector3 aimStart;
        public Vector3 aimEnd;
        public float recommendedPower01;
        public Vector2 tipOffset;
        public float cueElevationDeg;
        public string debugNote;
    }

    [DisallowMultipleComponent]
    public class AdaptiveAimingEngine : MonoBehaviour
    {
        public AimingConfig config;
        public bool showDebug = true;

        LineRenderer lr;
        IAimingStrategy ghost, contact, fractional, cte;
        ShotClassifier classifier;
        AimingDebugOverlay overlay;

        void Awake()
        {
            if (config == null) config = Resources.Load<AimingConfig>("AimingConfig");
            ghost = new Strategies.GhostBallStrategy();
            contact = new Strategies.ContactPointStrategy();
            fractional = new Strategies.FractionalStrategy();
            cte = new Strategies.CTEApproxStrategy();
            classifier = new ShotClassifier();
            overlay = GetComponent<AimingDebugOverlay>();
            if (overlay == null) overlay = gameObject.AddComponent<AimingDebugOverlay>();
            overlay.Init(config);
            showDebug = config ? config.showDebugDefault : showDebug;
            lr = GetComponent<LineRenderer>();
            if (lr == null)
            {
                lr = gameObject.AddComponent<LineRenderer>();
                lr.positionCount = 2;
                lr.material = new Material(Shader.Find("Sprites/Default"));
                lr.widthMultiplier = config ? config.lineWidth : 0.01f;
                lr.startColor = lr.endColor = config ? config.lineColor : Color.cyan;
            }
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public AimSolution GetAimSolution(in ShotContext ctx)
        {
            var info = classifier.Classify(ctx, config);
            if (!info.losCueToObj || !info.losObjToPocket)
            {
                return new AimSolution
                {
                    isValid = false,
                    strategyUsed = "None",
                    aimStart = ctx.cueBallPos,
                    aimEnd = ctx.objectBallPos,
                    recommendedPower01 = 0f,
                    tipOffset = Vector2.zero,
                    cueElevationDeg = 0f,
                    debugNote = !info.losCueToObj ? "Blocked: cue→object" : "Blocked: object→pocket"
                };
            }

            IAimingStrategy strat;
            if (info.isStraight)
            {
                strat = ghost;
            }
            else if (info.isRailShot || info.angleDeg < 30f)
            {
                strat = contact;
            }
            else if (info.angleDeg <= 45f)
            {
                bool longOrSpin = (info.distBucket == ShotClassifier.DistBucket.Long) || ctx.highSpin;
                strat = longOrSpin ? cte : ghost;
            }
            else
            {
                strat = fractional;
            }
            if ((ctx.requiresPower || ctx.highSpin) && info.distBucket != ShotClassifier.DistBucket.Short) strat = cte;

            var sol = strat.Solve(ctx, info, config);
            sol.recommendedPower01 = RecommendPower(info.distBucket, ctx.requiresPower);
            if (ctx.highSpin)
            {
                float side = Mathf.Sign(Vector3.Cross(info.vOP, info.vOC).y) * config.sideSpinAmount;
                float vert = config.verticalSpinAmount * (ctx.requiresPower ? 1f : 0.7f);
                sol.tipOffset = new Vector2(Mathf.Clamp(side, -config.tipOffsetMax, config.tipOffsetMax),
                    Mathf.Clamp(vert, -config.tipOffsetMax, config.tipOffsetMax));
                sol.cueElevationDeg = (ctx.requiresPower && info.isRailShot) ? config.elevationForPower : 0f;
            }
            sol.strategyUsed = strat.Name;

            if (showDebug)
            {
                lr.enabled = true;
                lr.SetPosition(0, sol.aimStart);
                lr.SetPosition(1, sol.aimEnd);
                overlay.UpdateOverlay(ctx, info, sol);
            }
            else lr.enabled = false;

            return sol;
        }

        float RecommendPower(ShotClassifier.DistBucket b, bool requiresPower)
        {
            switch (b)
            {
                case ShotClassifier.DistBucket.Short: return requiresPower ? 0.55f : 0.35f;
                case ShotClassifier.DistBucket.Medium: return requiresPower ? 0.70f : 0.50f;
                default: return requiresPower ? 0.90f : 0.70f;
            }
        }
    }
}
