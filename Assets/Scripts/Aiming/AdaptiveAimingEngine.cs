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
            }
            ConfigureLineRenderer();
        }

        void ConfigureLineRenderer()
        {
            if (lr == null) return;

            lr.positionCount = 2;
            if (lr.material == null)
            {
                lr.material = new Material(Shader.Find("Sprites/Default"));
            }

            lr.widthMultiplier = config ? config.lineWidth : 0.01f;
            lr.startColor = lr.endColor = config ? config.lineColor : Color.cyan;
            lr.enabled = true;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public AimSolution GetAimSolution(in ShotContext ctx)
        {
            ShotContext evalCtx = NormalizePocketTarget(ctx);
            var info = classifier.Classify(evalCtx, config);
            if (!info.losCueToObj || !info.losObjToPocket)
            {
                var blocked = new AimSolution
                {
                    isValid = false,
                    strategyUsed = "None",
                    aimStart = evalCtx.cueBallPos,
                    aimEnd = evalCtx.objectBallPos,
                    recommendedPower01 = 0f,
                    tipOffset = Vector2.zero,
                    cueElevationDeg = 0f,
                    debugNote = !info.losCueToObj ? "Blocked: cue→object" : "Blocked: object→pocket"
                };

                DrawGuideLine(blocked.aimStart, blocked.aimEnd);
                if (showDebug) overlay.UpdateOverlay(evalCtx, info, blocked);
                return blocked;
            }

            var sol = SelectBestSolution(evalCtx, info);
            if (!sol.isValid)
            {
                sol = BuildDefaultSolution(evalCtx, info);
            }
            sol.recommendedPower01 = RecommendPower(info.distBucket, ctx.requiresPower);
            if (ctx.highSpin)
            {
                // Keep spin strength consistent across left/right and top/back so
                // players get identical response regardless of spin direction.
                float uniformSpin = Mathf.Min(
                    Mathf.Abs(config.sideSpinAmount),
                    Mathf.Abs(config.verticalSpinAmount));
                float side = Mathf.Sign(Vector3.Cross(info.vOP, info.vOC).y) * uniformSpin;
                float vert = Mathf.Sign(config.verticalSpinAmount) * uniformSpin;
                sol.tipOffset = new Vector2(Mathf.Clamp(side, -config.tipOffsetMax, config.tipOffsetMax),
                    Mathf.Clamp(vert, -config.tipOffsetMax, config.tipOffsetMax));
                sol.cueElevationDeg = (ctx.requiresPower && info.isRailShot) ? config.elevationForPower : 0f;
            }

            DrawGuideLine(sol.aimStart, sol.aimEnd);
            if (showDebug) overlay.UpdateOverlay(evalCtx, info, sol);

            return sol;
        }

        void DrawGuideLine(Vector3 start, Vector3 end)
        {
            if (lr == null) return;
            lr.enabled = true;
            lr.SetPosition(0, start);
            lr.SetPosition(1, end);
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

        ShotContext NormalizePocketTarget(in ShotContext ctx)
        {
            var normalized = ctx;
            normalized.pocketPos = ComputePocketAimPoint(ctx, config);
            return normalized;
        }

        public static Vector3 ComputePocketAimPoint(in ShotContext ctx, AimingConfig cfg)
        {
            Vector3 toPocket = ctx.pocketPos - ctx.objectBallPos;
            if (toPocket.sqrMagnitude < 1e-8f)
                return ctx.pocketPos;

            Vector3 pocketDir = toPocket.normalized;
            float depth = cfg ? cfg.pocketApproachDepth : 0.12f;
            Vector3 entranceCenter = ctx.pocketPos - pocketDir * Mathf.Max(depth, ctx.ballRadius * 0.5f);

            Vector3 objectToCue = ctx.cueBallPos - ctx.objectBallPos;
            if (objectToCue.sqrMagnitude < 1e-8f)
                return entranceCenter;

            Vector3 cueDir = objectToCue.normalized;
            float cutDot = Mathf.Clamp(Vector3.Dot(-pocketDir, cueDir), -1f, 1f);
            float cutAngleDeg = Mathf.Acos(cutDot) * Mathf.Rad2Deg;
            float straightThreshold = cfg ? cfg.straightPocketCenterAngleDeg : 7f;
            if (cutAngleDeg <= straightThreshold)
                return entranceCenter;

            float startAngle = cfg ? cfg.jawGuideStartAngleDeg : 12f;
            float maxAngle = cfg ? cfg.jawGuideMaxAngleDeg : 50f;
            if (maxAngle <= startAngle)
                maxAngle = startAngle + 1f;

            float t = Mathf.InverseLerp(startAngle, maxAngle, cutAngleDeg);
            float minOffset = cfg ? cfg.jawGuideOffsetMin : 0.01f;
            float maxOffset = cfg ? cfg.jawGuideOffsetMax : 0.028f;
            float offset = Mathf.Lerp(minOffset, maxOffset, t);
            offset = Mathf.Clamp(offset, 0f, Mathf.Max(0f, maxOffset));

            Vector3 lateral = Vector3.Cross(Vector3.up, pocketDir);
            if (lateral.sqrMagnitude < 1e-8f)
                return entranceCenter;

            lateral.Normalize();
            float sideSign = Mathf.Sign(Vector3.Cross(cueDir, pocketDir).y);
            if (Mathf.Approximately(sideSign, 0f))
                return entranceCenter;

            return entranceCenter + lateral * sideSign * offset;
        }

        AimSolution SelectBestSolution(in ShotContext ctx, in ShotInfo info)
        {
            IAimingStrategy[] candidates = { ghost, contact, fractional, cte };
            bool hasBest = false;
            float bestScore = float.MaxValue;
            AimSolution best = default;

            foreach (var candidate in candidates)
            {
                var attempt = candidate.Solve(ctx, info, config);
                if (!attempt.isValid)
                    continue;

                if (!IsCuePathClear(ctx.cueBallPos, attempt.aimEnd, ctx))
                    continue;

                float score = ScoreAttempt(ctx, info, attempt);
                if (score < bestScore)
                {
                    bestScore = score;
                    best = attempt;
                    best.strategyUsed = candidate.Name;
                    best.debugNote = $"{attempt.debugNote} score={score:0.###}";
                    hasBest = true;
                }
            }

            if (!hasBest)
                return default;

            best.isValid = true;
            return best;
        }

        AimSolution BuildDefaultSolution(in ShotContext ctx, in ShotInfo info)
        {
            IAimingStrategy fallback = info.isStraight ? ghost :
                (info.isRailShot || info.angleDeg < 30f) ? contact :
                (info.angleDeg <= 45f) ? ghost : fractional;
            var sol = fallback.Solve(ctx, info, config);
            sol.strategyUsed = fallback.Name;
            return sol;
        }

        bool IsCuePathClear(Vector3 cue, Vector3 target, in ShotContext ctx)
        {
            float clearance = ctx.ballRadius * (config ? config.cuePathClearanceRadiusScale : 0.92f);
            return PhysicsUtil.SphereLineClear(cue, target, clearance, ctx.collisionMask);
        }

        float ScoreAttempt(in ShotContext ctx, in ShotInfo info, in AimSolution attempt)
        {
            Vector3 cueDir = (attempt.aimEnd - ctx.cueBallPos).normalized;
            Vector3 idealDir = (ctx.objectBallPos - ctx.cueBallPos).normalized;
            float directionalMiss = 1f - Mathf.Clamp01(Vector3.Dot(cueDir, idealDir));

            float cutPenalty = (config ? config.cutAnglePenalty : 0.55f) * (info.angleDeg / 90f);
            float distancePenalty = (config ? config.distancePenalty : 0.2f) * Vector3.Distance(ctx.cueBallPos, attempt.aimEnd);
            return directionalMiss + cutPenalty + distancePenalty;
        }
    }
}
