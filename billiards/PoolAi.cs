using System;
using System.Collections.Generic;
using System.Linq;

namespace Billiards;

public enum GameMode
{
    EightBall,
    NineBall,
    Points
}

public enum BallType
{
    Solid,
    Stripe,
    Yellow,
    Red,
    Eight,
    Nine,
    Cue,
    Other
}

public enum GroupMode
{
    SolidsStripes,
    YellowRed
}

public enum GroupAssignment
{
    Unassigned,
    Solids,
    Stripes,
    Yellow,
    Red
}

public sealed class Pocket
{
    public Vec2 Center { get; init; }
    public Vec2 JawLeft { get; init; }
    public Vec2 JawRight { get; init; }
    public double MouthWidth { get; init; }
    public double PocketRadius { get; init; }
}

public sealed class Ball
{
    public int Id { get; init; }
    public Vec2 Pos { get; set; }
    public bool OnTable { get; set; } = true;
    public BallType Type { get; init; }
    public int Points { get; init; } = 1;
}

public sealed class PlayerState
{
    public GroupAssignment Group { get; set; } = GroupAssignment.Unassigned;
}

public sealed class GameState
{
    public GameMode Mode { get; init; }
    public IReadOnlyList<Ball> Balls { get; init; } = Array.Empty<Ball>();
    public IReadOnlyList<Pocket> Pockets { get; init; } = Array.Empty<Pocket>();
    public PlayerState CurrentPlayer { get; init; } = new();
    public PlayerState Opponent { get; init; } = new();
    public GroupMode GroupMode { get; init; } = GroupMode.SolidsStripes;
    public bool CallPocketRequired { get; init; }
    public bool AllowBanks { get; init; }
    public bool AllowCombos { get; init; }
    public double BallRadius { get; init; } = PhysicsConstants.BallRadius;
    public AiConfig Config { get; init; } = new();
}

public sealed class AiConfig
{
    public ShotScoreWeights Weights { get; init; } = new();
    public double CueCorridorRadiusScale { get; init; } = 1.10;
    public double ObjectCorridorRadiusScale { get; init; } = 1.10;
    public double NearMissRadiusScale { get; init; } = 1.25;
    public double OpeningMinRad { get; init; } = 0.12;
    public double OpeningMaxRad { get; init; } = 0.9;
    public double CenterOffsetMaxRad { get; init; } = 0.35;
    public double OpeningRejectRad { get; init; } = 0.08;
    public double JawRiskDistanceScale { get; init; } = 2.2;
    public double ScratchAngleRad { get; init; } = 0.21;
    public double ScratchPenaltyPerPocket { get; init; } = 0.6;
    public double MouthCrowdRadiusScale { get; init; } = 2.8;
    public double GroupPreferenceBonus { get; init; } = 0.35;
    public double ThinCutPenaltyMultiplier { get; init; } = 1.6;
    public Func<GameState, CandidateShot, double>? SimulationHook { get; init; }
}

public sealed class ShotScoreWeights
{
    public double Open { get; init; } = 4.0;
    public double Center { get; init; } = 3.0;
    public double Jaw { get; init; } = 3.5;
    public double Cut { get; init; } = 2.0;
    public double DistO { get; init; } = 1.0;
    public double DistC { get; init; } = 0.5;
    public double Scratch { get; init; } = 2.5;
    public double Sell { get; init; } = 1.0;
    public double Points { get; init; } = 2.0;
    public double ModeBonus { get; init; } = 1.0;
}

public sealed class ShotDecision
{
    public required Ball ObjectBall { get; init; }
    public required Pocket Pocket { get; init; }
    public required ShotPlan Plan { get; init; }
    public double Score { get; init; }
    public IReadOnlyList<CandidateShot> TopCandidates { get; init; } = Array.Empty<CandidateShot>();
}

public sealed class ShotPlan
{
    public Vec2 CueDirection { get; init; }
    public Vec2 GhostBallPos { get; init; }
    public Vec2 ObjectDirection { get; init; }
}

public sealed class CandidateShot
{
    public required Ball ObjectBall { get; init; }
    public required Pocket Pocket { get; init; }
    public required ShotPlan Plan { get; init; }
    public double Score { get; set; }
    public double BaseScore { get; set; }
    public double OpeningAngle { get; init; }
    public double CenterOffset { get; init; }
    public double OpenScore { get; init; }
    public double CenteringScore { get; init; }
    public double CutAngle { get; init; }
    public double DistCue { get; init; }
    public double DistObj { get; init; }
    public double JawRisk { get; init; }
    public double ScratchRisk { get; init; }
    public double SellRisk { get; init; }
    public double CrowdedMouthPenalty { get; init; }
    public bool CueBlocked { get; init; }
    public bool ObjBlocked { get; init; }
    public int CueNearMiss { get; init; }
    public int ObjNearMiss { get; init; }
    public double ExpectedPoints { get; init; }
}

public static class PoolAi
{
    public static ShotDecision SelectBestShot(GameState state)
    {
        var cueBall = state.Balls.FirstOrDefault(b => b.Type == BallType.Cue && b.OnTable)
            ?? throw new InvalidOperationException("Cue ball missing.");
        var legalBalls = GetLegalObjectBalls(state);
        var candidates = new List<CandidateShot>();
        foreach (var ball in legalBalls)
        {
            candidates.AddRange(GenerateCandidates(state, cueBall, ball));
        }

        if (candidates.Count == 0)
        {
            throw new InvalidOperationException("No legal candidates generated.");
        }

        var groupPreference = ComputeGroupPreference(state, candidates);
        ApplyGroupPreference(candidates, groupPreference, state.Config.GroupPreferenceBonus, state.GroupMode);

        var hasWideOpen = candidates.Any(c => c.OpeningAngle >= state.Config.OpeningRejectRad && c.Score > double.NegativeInfinity);
        foreach (var candidate in candidates)
        {
            if (hasWideOpen && candidate.OpeningAngle < state.Config.OpeningRejectRad)
            {
                candidate.Score -= 10.0;
            }
        }

        var top = candidates.OrderByDescending(c => c.Score).ToList();
        var best = top[0];

        return new ShotDecision
        {
            ObjectBall = best.ObjectBall,
            Pocket = best.Pocket,
            Plan = best.Plan,
            Score = best.Score,
            TopCandidates = top.Take(5).ToList()
        };
    }

    public static List<Ball> GetLegalObjectBalls(GameState state)
    {
        var ballsOnTable = state.Balls.Where(b => b.OnTable).ToList();
        return state.Mode switch
        {
            GameMode.EightBall => GetLegalEightBallTargets(state, ballsOnTable),
            GameMode.NineBall => GetLegalNineBallTargets(ballsOnTable),
            GameMode.Points => ballsOnTable.Where(b => b.Type != BallType.Cue).ToList(),
            _ => new List<Ball>()
        };
    }

    private static List<Ball> GetLegalEightBallTargets(GameState state, IReadOnlyList<Ball> balls)
    {
        var nonCue = balls.Where(b => b.Type != BallType.Cue).ToList();
        var group = state.CurrentPlayer.Group;
        var remainingGroup = nonCue.Where(b => MatchesGroup(state.GroupMode, group, b)).ToList();
        var hasGroupBalls = remainingGroup.Any();

        if (group == GroupAssignment.Unassigned)
        {
            return nonCue.Where(b => b.Type != BallType.Eight).ToList();
        }

        if (!hasGroupBalls)
        {
            return nonCue.Where(b => b.Type == BallType.Eight).ToList();
        }

        return remainingGroup;
    }

    private static List<Ball> GetLegalNineBallTargets(IReadOnlyList<Ball> balls)
    {
        var lowest = balls.Where(b => b.OnTable && b.Type != BallType.Cue)
            .OrderBy(b => b.Id)
            .FirstOrDefault();
        return lowest == null ? new List<Ball>() : new List<Ball> { lowest };
    }

    public static IEnumerable<CandidateShot> GenerateCandidates(GameState state, Ball cueBall, Ball objectBall)
    {
        var blockers = state.Balls.Where(b => b.OnTable && b.Id != cueBall.Id && b.Id != objectBall.Id).ToList();
        foreach (var pocket in state.Pockets)
        {
            var dOP = (pocket.Center - objectBall.Pos).Normalized();
            if (dOP.LengthSquared < PhysicsConstants.Epsilon)
            {
                continue;
            }

            var ghost = ComputeGhostBall(objectBall.Pos, dOP, state.BallRadius);
            var dCG = (ghost.Position - cueBall.Pos).Normalized();
            if (dCG.LengthSquared < PhysicsConstants.Epsilon)
            {
                continue;
            }

            var cueRadius = state.BallRadius * state.Config.CueCorridorRadiusScale;
            var objRadius = state.BallRadius * state.Config.ObjectCorridorRadiusScale;
            var cueClear = CorridorCheck(cueBall.Pos, ghost.Position, cueRadius, blockers, state.Config.NearMissRadiusScale);
            var objClear = CorridorCheck(objectBall.Pos, pocket.Center, objRadius, blockers, state.Config.NearMissRadiusScale);

            var cutAngle = ComputeCutAngle(cueBall.Pos, objectBall.Pos, dOP);
            var opening = ComputePocketOpening(objectBall.Pos, pocket, dOP, state.Config);
            var jawRisk = ComputeJawRisk(objectBall.Pos, pocket, state.BallRadius, state.Config.JawRiskDistanceScale);
            var distCue = (cueBall.Pos - ghost.Position).Length;
            var distObj = (objectBall.Pos - pocket.Center).Length;
            var scratch = ComputeScratchRisk(state, cueBall, dCG, blockers);
            var sell = ComputeSellRisk(state, cueBall.Pos, dCG, blockers);
            var crowded = ComputeCrowdedMouthPenalty(state, pocket, blockers);
            var expectedPoints = state.Mode == GameMode.Points ? objectBall.Points * opening.Makeability : 0.0;
            var score = ScoreCandidate(state, cutAngle, distCue, distObj, opening, jawRisk, scratch, sell, crowded, cueClear, objClear, expectedPoints);

            var candidate = new CandidateShot
            {
                ObjectBall = objectBall,
                Pocket = pocket,
                Plan = new ShotPlan { CueDirection = dCG, GhostBallPos = ghost.Position, ObjectDirection = dOP },
                Score = score,
                BaseScore = score,
                OpeningAngle = opening.OpeningAngle,
                CenterOffset = opening.CenterOffset,
                OpenScore = opening.OpenScore,
                CenteringScore = opening.CenteringScore,
                CutAngle = cutAngle,
                DistCue = distCue,
                DistObj = distObj,
                JawRisk = jawRisk,
                ScratchRisk = scratch,
                SellRisk = sell,
                CrowdedMouthPenalty = crowded,
                CueBlocked = cueClear.Blocked,
                ObjBlocked = objClear.Blocked,
                CueNearMiss = cueClear.NearMissCount,
                ObjNearMiss = objClear.NearMissCount,
                ExpectedPoints = expectedPoints
            };

            if (state.Config.SimulationHook != null && candidate.Score > double.NegativeInfinity)
            {
                candidate.Score += state.Config.SimulationHook(state, candidate);
            }

            yield return candidate;
        }
    }

    private static double ScoreCandidate(
        GameState state,
        double cutAngle,
        double distCue,
        double distObj,
        PocketOpenMetrics opening,
        double jawRisk,
        double scratch,
        double sell,
        double crowdedPenalty,
        CorridorResult cueClear,
        CorridorResult objClear,
        double expectedPoints)
    {
        if (cueClear.Blocked || objClear.Blocked)
        {
            return double.NegativeInfinity;
        }

        var weights = state.Config.Weights;
        var maxDist = GetTableMaxDistance(state);
        var distCuePenalty = Normalize(distCue, 0, maxDist);
        var distObjPenalty = Normalize(distObj, 0, maxDist);
        var cutPenalty = Normalize(cutAngle, 0, Math.PI * 0.5);

        if (opening.OpeningAngle < state.Config.OpeningMinRad)
        {
            cutPenalty *= state.Config.ThinCutPenaltyMultiplier;
        }

        var nearMissPenalty = (cueClear.NearMissCount + objClear.NearMissCount) * 0.35;

        var score =
            weights.Open * opening.OpenScore +
            weights.Center * opening.CenteringScore -
            weights.Jaw * jawRisk -
            weights.Cut * cutPenalty -
            weights.DistO * distObjPenalty -
            weights.DistC * distCuePenalty -
            weights.Scratch * scratch -
            weights.Sell * sell -
            crowdedPenalty -
            nearMissPenalty;

        if (state.Mode == GameMode.Points)
        {
            score += weights.Points * expectedPoints;
        }

        if (state.Mode == GameMode.NineBall && opening.Makeability > 0.8 && opening.OpenScore > 0.7)
        {
            score += weights.ModeBonus * 0.5;
        }

        return score;
    }

    public static PocketOpenMetrics ComputePocketOpening(Vec2 objectPos, Pocket pocket, Vec2 dOP, AiConfig config)
    {
        var theta1 = Math.Atan2(pocket.JawLeft.Y - objectPos.Y, pocket.JawLeft.X - objectPos.X);
        var theta2 = Math.Atan2(pocket.JawRight.Y - objectPos.Y, pocket.JawRight.X - objectPos.X);
        var openingAngle = SmallestAngleBetween(theta1, theta2);

        var mouthCenter = (pocket.JawLeft + pocket.JawRight) * 0.5;
        var thetaC = Math.Atan2(mouthCenter.Y - objectPos.Y, mouthCenter.X - objectPos.X);
        var thetaD = Math.Atan2(dOP.Y, dOP.X);
        var centerOffset = AbsAngularDifference(thetaD, thetaC);

        var openScore = Normalize(openingAngle, config.OpeningMinRad, config.OpeningMaxRad);
        var centeringScore = 1.0 - Normalize(centerOffset, 0, config.CenterOffsetMaxRad);
        var makeability = 0.55 * openScore + 0.45 * centeringScore;

        return new PocketOpenMetrics(openingAngle, centerOffset, openScore, centeringScore, makeability);
    }

    public static double SmallestAngleBetweenAngles(double a, double b) => SmallestAngleBetween(a, b);

    public static GhostBallMetrics ComputeGhostBall(Vec2 objectPos, Vec2 pocketDir, double radius)
    {
        var ghostPos = objectPos - pocketDir * (2 * radius);
        return new GhostBallMetrics(ghostPos);
    }

    public static bool IsCorridorClear(Vec2 a, Vec2 b, double corridorRadius, IEnumerable<Ball> ballsToTreatAsBlockers)
    {
        foreach (var ball in ballsToTreatAsBlockers)
        {
            if (!ball.OnTable)
            {
                continue;
            }

            var dist = DistancePointToSegment(ball.Pos, a, b);
            if (dist <= corridorRadius)
            {
                return false;
            }
        }

        return true;
    }

    public static double ComputeCutAngle(Vec2 cuePos, Vec2 objectPos, Vec2 dOP)
    {
        var vCO = (objectPos - cuePos).Normalized();
        var dot = Math.Clamp(Vec2.Dot(vCO, dOP), -1.0, 1.0);
        return Math.Acos(dot);
    }

    public static double ComputeJawRisk(Vec2 objectPos, Pocket pocket, double ballRadius, double riskDistanceScale)
    {
        var distJ1 = DistancePointToSegment(pocket.JawLeft, objectPos, pocket.Center);
        var distJ2 = DistancePointToSegment(pocket.JawRight, objectPos, pocket.Center);
        var dist = Math.Min(distJ1, distJ2);
        var min = ballRadius * 0.5;
        var max = ballRadius * riskDistanceScale;
        return 1.0 - Normalize(dist, min, max);
    }

    public static double ComputeScratchRisk(GameState state, Ball cueBall, Vec2 cueDirection, IReadOnlyList<Ball> blockers)
    {
        var risk = 0.0;
        foreach (var pocket in state.Pockets)
        {
            var dirToPocket = (pocket.Center - cueBall.Pos).Normalized();
            if (dirToPocket.LengthSquared < PhysicsConstants.Epsilon)
            {
                continue;
            }

            var angle = AbsAngularDifference(Math.Atan2(cueDirection.Y, cueDirection.X), Math.Atan2(dirToPocket.Y, dirToPocket.X));
            if (angle <= state.Config.ScratchAngleRad)
            {
                var clear = IsCorridorClear(cueBall.Pos, pocket.Center, state.BallRadius * 1.05, blockers);
                if (clear)
                {
                    risk += state.Config.ScratchPenaltyPerPocket;
                }
            }
        }

        return Math.Clamp(risk, 0, 1.5);
    }

    public static double ComputeCrowdedMouthPenalty(GameState state, Pocket pocket, IReadOnlyList<Ball> blockers)
    {
        var mouthCenter = (pocket.JawLeft + pocket.JawRight) * 0.5;
        var radius = state.BallRadius * state.Config.MouthCrowdRadiusScale;
        foreach (var ball in blockers)
        {
            if ((ball.Pos - mouthCenter).Length <= radius)
            {
                return 1.5;
            }
        }

        return 0.0;
    }

    private static double ComputeSellRisk(GameState state, Vec2 cuePos, Vec2 cueDir, IReadOnlyList<Ball> blockers)
    {
        var estimatedCuePos = cuePos + cueDir * Math.Min(0.3, 0.2 * GetTableMaxDistance(state));
        var openLines = 0;
        foreach (var ball in state.Balls)
        {
            if (!ball.OnTable || ball.Type == BallType.Cue)
            {
                continue;
            }

            var clear = IsCorridorClear(estimatedCuePos, ball.Pos, state.BallRadius * 1.1, blockers);
            if (clear)
            {
                openLines++;
            }
        }

        return Normalize(openLines, 0, 6);
    }

    private static GroupAssignment? ComputeGroupPreference(GameState state, IReadOnlyList<CandidateShot> candidates)
    {
        if (state.Mode != GameMode.EightBall || state.CurrentPlayer.Group != GroupAssignment.Unassigned)
        {
            return null;
        }

        var groupScores = new Dictionary<GroupAssignment, double>();
        foreach (var candidate in candidates)
        {
            var group = GetGroupFromBall(state.GroupMode, candidate.ObjectBall);
            if (group == null)
            {
                continue;
            }

            groupScores.TryAdd(group.Value, 0.0);
            if (!double.IsNegativeInfinity(candidate.BaseScore))
            {
                groupScores[group.Value] += candidate.BaseScore;
            }
        }

        if (groupScores.Count == 0)
        {
            return null;
        }

        return groupScores.OrderByDescending(kvp => kvp.Value).First().Key;
    }

    private static void ApplyGroupPreference(IEnumerable<CandidateShot> candidates, GroupAssignment? preference, double bonus, GroupMode groupMode)
    {
        if (preference == null)
        {
            return;
        }

        foreach (var candidate in candidates)
        {
            if (GetGroupFromBall(groupMode, candidate.ObjectBall) == preference)
            {
                candidate.Score += bonus;
            }
        }

        static GroupAssignment? GetGroupFromBall(GroupMode groupMode, Ball ball)
        {
            if (ball.Type == BallType.Eight || ball.Type == BallType.Cue)
            {
                return null;
            }

            if (groupMode == GroupMode.SolidsStripes)
            {
                return ball.Id <= 7 ? GroupAssignment.Solids : GroupAssignment.Stripes;
            }

            return ball.Type switch
            {
                BallType.Yellow => GroupAssignment.Yellow,
                BallType.Red => GroupAssignment.Red,
                    _ => null
                };
        }
    }

    private static GroupAssignment? GetGroupFromBall(GroupMode groupMode, Ball ball)
    {
        if (ball.Type == BallType.Eight || ball.Type == BallType.Cue)
        {
            return null;
        }

        return groupMode == GroupMode.SolidsStripes
            ? (ball.Id <= 7 ? GroupAssignment.Solids : GroupAssignment.Stripes)
            : ball.Type switch
            {
                BallType.Yellow => GroupAssignment.Yellow,
                BallType.Red => GroupAssignment.Red,
                _ => null
            };
    }

    private static bool MatchesGroup(GroupMode mode, GroupAssignment group, Ball ball)
    {
        if (group == GroupAssignment.Unassigned)
        {
            return false;
        }

        if (mode == GroupMode.SolidsStripes)
        {
            return group == GroupAssignment.Solids
                ? ball.Id >= 1 && ball.Id <= 7
                : ball.Id >= 9 && ball.Id <= 15;
        }

        return group == GroupAssignment.Yellow ? ball.Type == BallType.Yellow : ball.Type == BallType.Red;
    }

    private static double DistancePointToSegment(Vec2 p, Vec2 a, Vec2 b)
    {
        var ab = b - a;
        var t = Vec2.Dot(p - a, ab) / Math.Max(ab.LengthSquared, PhysicsConstants.Epsilon);
        t = Math.Clamp(t, 0, 1);
        var closest = a + ab * t;
        return (p - closest).Length;
    }

    private static double Normalize(double value, double min, double max)
    {
        if (max <= min)
        {
            return 0.0;
        }

        return Math.Clamp((value - min) / (max - min), 0.0, 1.0);
    }

    private static double GetTableMaxDistance(GameState state)
    {
        var maxDist = 0.0;
        var pockets = state.Pockets;
        for (var i = 0; i < pockets.Count; i++)
        {
            for (var j = i + 1; j < pockets.Count; j++)
            {
                var dist = (pockets[i].Center - pockets[j].Center).Length;
                if (dist > maxDist)
                {
                    maxDist = dist;
                }
            }
        }

        return maxDist > 0 ? maxDist : 1.0;
    }

    private static double NormalizeAngle(double angle)
    {
        while (angle > Math.PI)
        {
            angle -= Math.PI * 2.0;
        }

        while (angle < -Math.PI)
        {
            angle += Math.PI * 2.0;
        }

        return angle;
    }

    private static double SmallestAngleBetween(double a, double b)
    {
        return AbsAngularDifference(a, b);
    }

    private static double AbsAngularDifference(double a, double b)
    {
        return Math.Abs(NormalizeAngle(a - b));
    }

    private static CorridorResult CorridorCheck(Vec2 a, Vec2 b, double radius, IReadOnlyList<Ball> balls, double nearMissScale)
    {
        var nearMissRadius = radius * nearMissScale;
        var blocked = false;
        var nearMiss = 0;
        foreach (var ball in balls)
        {
            var dist = DistancePointToSegment(ball.Pos, a, b);
            if (dist <= radius)
            {
                blocked = true;
                break;
            }

            if (dist <= nearMissRadius)
            {
                nearMiss++;
            }
        }

        return new CorridorResult(blocked, nearMiss);
    }
}

public readonly record struct PocketOpenMetrics(
    double OpeningAngle,
    double CenterOffset,
    double OpenScore,
    double CenteringScore,
    double Makeability);

public readonly record struct GhostBallMetrics(Vec2 Position);

public readonly record struct CorridorResult(bool Blocked, int NearMissCount);
