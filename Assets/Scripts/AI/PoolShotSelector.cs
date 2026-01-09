using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace PoolRoyale.AI
{
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

    [Serializable]
    public class Ball
    {
        public int id;
        public Vector2 pos;
        public bool onTable = true;
        public BallType type;
        public int points = 1;
    }

    [Serializable]
    public class Pocket
    {
        public int id;
        public Vector2 center;
        public Vector2 jawLeft;
        public Vector2 jawRight;
        public float mouthWidth;
        public float pocketRadius;
    }

    [Serializable]
    public class Table
    {
        public Vector2 min;
        public Vector2 max;
        public bool hasBounds;
        public List<Pocket> pockets = new List<Pocket>();

        public Vector2 Center
        {
            get
            {
                if (hasBounds) return (min + max) * 0.5f;
                if (pockets.Count == 0) return Vector2.zero;
                Vector2 sum = Vector2.zero;
                foreach (Pocket p in pockets) sum += p.center;
                return sum / pockets.Count;
            }
        }
    }

    [Serializable]
    public class PlayerState
    {
        public GroupAssignment group = GroupAssignment.Unassigned;
    }

    [Serializable]
    public class GameState
    {
        public GameMode mode;
        public GroupMode groupMode;
        public PlayerState currentPlayer = new PlayerState();
        public PlayerState opponent = new PlayerState();
        public bool callPocketRequired;
        public int? calledPocketId;
        public Table table = new Table();
        public List<Ball> balls = new List<Ball>();
        public float ballRadius = 0.028f;
        public bool allowBanks;
        public bool allowCombos;
    }

    [Serializable]
    public class ShotWeights
    {
        public float wOpen = 4f;
        public float wCenter = 3f;
        public float wJaw = 3.5f;
        public float wCut = 2f;
        public float wDistO = 1f;
        public float wDistC = 0.5f;
        public float wScratch = 2.5f;
        public float wSell = 1f;
        public float wPoints = 2f;
        public float wMode = 1f;
    }

    public struct PocketOpenMetrics
    {
        public float openingAngle;
        public float centerOffset;
        public float openScore;
        public float centeringScore;
    }

    public struct GhostBallMetrics
    {
        public Vector2 ghostPos;
        public Vector2 cueDir;
    }

    public class CandidateShot
    {
        public int objectBallId;
        public int pocketId;
        public Vector2 ghostPos;
        public Vector2 cueDir;
        public float openingAngle;
        public float centerOffset;
        public float openScore;
        public float centeringScore;
        public float cutAngle;
        public float distCue;
        public float distObj;
        public float jawRisk;
        public float scratchRisk;
        public float sellRisk;
        public float crowdedMouthPenalty;
        public float nearMissPenalty;
        public float expectedPoints;
        public bool cueClear;
        public bool objClear;
        public bool nearMiss;
        public float score;
    }

    public class ShotDecision
    {
        public CandidateShot bestShot;
        public List<CandidateShot> topCandidates = new List<CandidateShot>();
    }

    public static class PoolRules
    {
        public static List<Ball> GetLegalObjectBalls(GameState state)
        {
            List<Ball> balls = state.balls.Where(b => b.onTable && b.type != BallType.Cue).ToList();
            if (state.mode == GameMode.NineBall)
            {
                Ball lowest = balls.Where(b => b.id != 0).OrderBy(b => b.id).FirstOrDefault();
                return lowest != null ? new List<Ball> { lowest } : new List<Ball>();
            }

            if (state.mode == GameMode.EightBall)
            {
                if (state.currentPlayer.group == GroupAssignment.Unassigned)
                {
                    return balls.Where(b => b.type != BallType.Eight).ToList();
                }

                GroupAssignment group = state.currentPlayer.group;
                return balls.Where(b => MatchesGroup(state.groupMode, group, b)).ToList();
            }

            return balls;
        }

        public static bool MatchesGroup(GroupMode mode, GroupAssignment group, Ball ball)
        {
            if (ball.type == BallType.Cue) return false;
            if (group == GroupAssignment.Unassigned) return false;
            if (mode == GroupMode.SolidsStripes)
            {
                if (group == GroupAssignment.Solids) return ball.id >= 1 && ball.id <= 7;
                if (group == GroupAssignment.Stripes) return ball.id >= 9 && ball.id <= 15;
                return false;
            }

            if (group == GroupAssignment.Yellow) return ball.type == BallType.Yellow;
            if (group == GroupAssignment.Red) return ball.type == BallType.Red;
            return false;
        }

        public static bool IsEightBallLegal(GameState state, Ball ball)
        {
            if (ball.type != BallType.Eight) return false;
            if (state.mode != GameMode.EightBall) return false;
            if (state.currentPlayer.group == GroupAssignment.Unassigned) return false;
            return !state.balls.Any(b => b.onTable && MatchesGroup(state.groupMode, state.currentPlayer.group, b));
        }
    }

    public class PoolShotSelector
    {
        public ShotWeights weights = new ShotWeights();

        public ShotDecision SelectBestShot(GameState state)
        {
            List<Ball> legalBalls = PoolRules.GetLegalObjectBalls(state);
            Ball cueBall = state.balls.FirstOrDefault(b => b.type == BallType.Cue || b.id == 0);
            if (cueBall == null || legalBalls.Count == 0)
            {
                return new ShotDecision();
            }

            List<CandidateShot> candidates = new List<CandidateShot>();
            foreach (Ball ball in legalBalls)
            {
                candidates.AddRange(GenerateCandidates(state, cueBall, ball));
            }

            ApplyGroupPreferenceBonus(state, candidates);

            candidates = candidates.OrderByDescending(c => c.score).ToList();
            ShotDecision decision = new ShotDecision();
            if (candidates.Count > 0)
            {
                decision.bestShot = candidates[0];
                decision.topCandidates = candidates.Take(5).ToList();
            }

            return decision;
        }

        public IEnumerable<CandidateShot> GenerateCandidates(GameState state, Ball cueBall, Ball objectBall)
        {
            foreach (Pocket pocket in state.table.pockets)
            {
                if (state.callPocketRequired && state.calledPocketId.HasValue && pocket.id != state.calledPocketId.Value)
                {
                    continue;
                }

                Vector2 dOP = (pocket.center - objectBall.pos).normalized;
                GhostBallMetrics ghost = ComputeGhostBall(objectBall.pos, dOP, state.ballRadius);
                Vector2 ghostPos = ghost.ghostPos;
                Vector2 dCG = ghost.cueDir;

                CandidateShot candidate = new CandidateShot
                {
                    objectBallId = objectBall.id,
                    pocketId = pocket.id,
                    ghostPos = ghostPos,
                    cueDir = dCG
                };

                PocketOpenMetrics openMetrics = ComputePocketOpening(objectBall.pos, pocket, dOP);
                candidate.openingAngle = openMetrics.openingAngle;
                candidate.centerOffset = openMetrics.centerOffset;
                candidate.openScore = openMetrics.openScore;
                candidate.centeringScore = openMetrics.centeringScore;
                candidate.cutAngle = ComputeCutAngle(cueBall.pos, objectBall.pos, dOP);
                candidate.distCue = Vector2.Distance(cueBall.pos, ghostPos);
                candidate.distObj = Vector2.Distance(objectBall.pos, pocket.center);
                candidate.jawRisk = ComputeJawRisk(objectBall.pos, pocket, pocket.center, state.ballRadius);
                candidate.crowdedMouthPenalty = ComputeCrowdedMouthPenalty(state, pocket, cueBall, objectBall);

                List<Ball> blockersCue = state.balls.Where(b => b.onTable && b.id != cueBall.id && b.id != objectBall.id).ToList();
                List<Ball> blockersObj = state.balls.Where(b => b.onTable && b.id != objectBall.id).ToList();
                float nearMissCue;
                float nearMissObj;
                candidate.cueClear = IsCorridorClear(cueBall.pos, ghostPos, state.ballRadius * 1.1f, blockersCue, out nearMissCue);
                candidate.objClear = IsCorridorClear(objectBall.pos, pocket.center, state.ballRadius * 1.08f, blockersObj, out nearMissObj);
                candidate.nearMiss = nearMissCue > 0f || nearMissObj > 0f;
                candidate.nearMissPenalty = Mathf.Max(nearMissCue, nearMissObj);

                if (!candidate.cueClear || !candidate.objClear)
                {
                    candidate.score = float.NegativeInfinity;
                    yield return candidate;
                    continue;
                }

                candidate.scratchRisk = ComputeScratchRisk(state, cueBall.pos, dCG, objectBall.pos);
                candidate.sellRisk = ComputeSellRisk(state, cueBall.pos, dCG);
                candidate.expectedPoints = ComputeExpectedPoints(state, objectBall, candidate);
                candidate.score = ScoreCandidate(state, objectBall, candidate);

                yield return candidate;
            }
        }

        private void ApplyGroupPreferenceBonus(GameState state, List<CandidateShot> candidates)
        {
            if (state.mode != GameMode.EightBall) return;
            if (state.currentPlayer.group != GroupAssignment.Unassigned) return;

            float solidsScore = 0f;
            float stripesScore = 0f;
            float yellowScore = 0f;
            float redScore = 0f;

            foreach (CandidateShot candidate in candidates)
            {
                Ball ball = state.balls.FirstOrDefault(b => b.id == candidate.objectBallId);
                if (ball == null) continue;
                if (state.groupMode == GroupMode.SolidsStripes)
                {
                    if (ball.id >= 1 && ball.id <= 7) solidsScore += candidate.score;
                    if (ball.id >= 9 && ball.id <= 15) stripesScore += candidate.score;
                }
                else
                {
                    if (ball.type == BallType.Yellow) yellowScore += candidate.score;
                    if (ball.type == BallType.Red) redScore += candidate.score;
                }
            }

            float bonus = 0.25f;
            GroupAssignment favored = GroupAssignment.Unassigned;
            if (state.groupMode == GroupMode.SolidsStripes)
            {
                if (solidsScore > stripesScore) favored = GroupAssignment.Solids;
                if (stripesScore > solidsScore) favored = GroupAssignment.Stripes;
            }
            else
            {
                if (yellowScore > redScore) favored = GroupAssignment.Yellow;
                if (redScore > yellowScore) favored = GroupAssignment.Red;
            }

            if (favored == GroupAssignment.Unassigned) return;

            foreach (CandidateShot candidate in candidates)
            {
                Ball ball = state.balls.FirstOrDefault(b => b.id == candidate.objectBallId);
                if (ball == null) continue;
                if (PoolRules.MatchesGroup(state.groupMode, favored, ball))
                {
                    candidate.score += bonus;
                }
            }
        }

        public static PocketOpenMetrics ComputePocketOpening(Vector2 objectPos, Pocket pocket, Vector2 dOP)
        {
            float theta1 = Mathf.Atan2(pocket.jawLeft.y - objectPos.y, pocket.jawLeft.x - objectPos.x);
            float theta2 = Mathf.Atan2(pocket.jawRight.y - objectPos.y, pocket.jawRight.x - objectPos.x);
            float openingAngle = SmallestAngleBetween(theta1, theta2);
            Vector2 mouthCenter = (pocket.jawLeft + pocket.jawRight) * 0.5f;
            float thetaCenter = Mathf.Atan2(mouthCenter.y - objectPos.y, mouthCenter.x - objectPos.x);
            float thetaDir = Mathf.Atan2(dOP.y, dOP.x);
            float centerOffset = AbsAngularDifference(thetaCenter, thetaDir);
            float openScore = Normalize(openingAngle, 0.15f, 0.7f);
            float centeringScore = 1f - Normalize(centerOffset, 0f, 0.35f);
            return new PocketOpenMetrics
            {
                openingAngle = openingAngle,
                centerOffset = centerOffset,
                openScore = openScore,
                centeringScore = centeringScore
            };
        }

        public static GhostBallMetrics ComputeGhostBall(Vector2 objectPos, Vector2 pocketDir, float radius)
        {
            Vector2 ghostPos = objectPos - pocketDir * (2f * radius);
            return new GhostBallMetrics
            {
                ghostPos = ghostPos,
                cueDir = (ghostPos - objectPos).sqrMagnitude > 1e-6f ? (ghostPos - objectPos).normalized : Vector2.zero
            };
        }

        public static bool IsCorridorClear(Vector2 a, Vector2 b, float corridorRadius, IEnumerable<Ball> blockers, out float nearMissPenalty)
        {
            nearMissPenalty = 0f;
            foreach (Ball ball in blockers)
            {
                if (!ball.onTable) continue;
                float dist = DistancePointToSegment(ball.pos, a, b);
                if (dist <= corridorRadius)
                {
                    return false;
                }

                float nearThreshold = corridorRadius * 1.15f;
                if (dist <= nearThreshold)
                {
                    float penalty = 1f - Mathf.InverseLerp(corridorRadius, nearThreshold, dist);
                    nearMissPenalty = Mathf.Max(nearMissPenalty, penalty);
                }
            }
            return true;
        }

        public static float DistancePointToSegment(Vector2 p, Vector2 a, Vector2 b)
        {
            Vector2 ap = p - a;
            Vector2 ab = b - a;
            float ab2 = Vector2.Dot(ab, ab);
            if (ab2 <= Mathf.Epsilon) return ap.magnitude;
            float t = Mathf.Clamp01(Vector2.Dot(ap, ab) / ab2);
            Vector2 proj = a + ab * t;
            return Vector2.Distance(p, proj);
        }

        public static float ComputeCutAngle(Vector2 cuePos, Vector2 objPos, Vector2 dOP)
        {
            Vector2 vCO = (objPos - cuePos).normalized;
            float dot = Mathf.Clamp(Vector2.Dot(vCO, dOP), -1f, 1f);
            return Mathf.Acos(dot);
        }

        public static float ComputeJawRisk(Vector2 objectPos, Pocket pocket, Vector2 pocketCenter, float ballRadius)
        {
            float distLeft = DistancePointToSegment(pocket.jawLeft, objectPos, pocketCenter);
            float distRight = DistancePointToSegment(pocket.jawRight, objectPos, pocketCenter);
            float distJaw = Mathf.Min(distLeft, distRight);
            float danger = ballRadius * 1.1f;
            float safe = ballRadius * 2.4f;
            if (distJaw <= danger) return 1f;
            if (distJaw >= safe) return 0f;
            return 1f - Mathf.InverseLerp(danger, safe, distJaw);
        }

        public static float ComputeScratchRisk(GameState state, Vector2 cuePos, Vector2 cueDir, Vector2 objectPos)
        {
            float risk = 0f;
            foreach (Pocket pocket in state.table.pockets)
            {
                Vector2 toPocket = (pocket.center - cuePos);
                float dist = toPocket.magnitude;
                if (dist < Mathf.Epsilon) continue;
                float angle = AbsAngularDifference(Mathf.Atan2(cueDir.y, cueDir.x), Mathf.Atan2(toPocket.y, toPocket.x));
                if (angle < 0.26f)
                {
                    float nearMiss;
                    bool clear = IsCorridorClear(cuePos, pocket.center, state.ballRadius * 0.9f, state.balls, out nearMiss);
                    if (clear)
                    {
                        risk = Mathf.Max(risk, Mathf.InverseLerp(2.5f, 0.5f, dist));
                    }
                }
            }
            return risk;
        }

        public static float ComputeSellRisk(GameState state, Vector2 cuePos, Vector2 cueDir)
        {
            Vector2 predicted = cuePos + cueDir * state.ballRadius * 6f;
            Vector2 center = state.table.Center;
            float dist = Vector2.Distance(predicted, center);
            float tableSpan = state.table.hasBounds ? Vector2.Distance(state.table.min, state.table.max) : 2.4f;
            float centerRisk = 1f - Mathf.InverseLerp(tableSpan * 0.15f, tableSpan * 0.45f, dist);
            return Mathf.Clamp01(centerRisk);
        }

        public static float ComputeCrowdedMouthPenalty(GameState state, Pocket pocket, Ball cueBall, Ball objectBall)
        {
            float penalty = 0f;
            Vector2 mouthCenter = (pocket.jawLeft + pocket.jawRight) * 0.5f;
            float crowdRadius = state.ballRadius * 2.6f;
            foreach (Ball ball in state.balls)
            {
                if (!ball.onTable || ball.id == cueBall.id || ball.id == objectBall.id) continue;
                float dist = Vector2.Distance(ball.pos, mouthCenter);
                if (dist < crowdRadius)
                {
                    penalty = Mathf.Max(penalty, Mathf.InverseLerp(crowdRadius, state.ballRadius, dist));
                }
            }
            return penalty;
        }

        private float ComputeExpectedPoints(GameState state, Ball objectBall, CandidateShot candidate)
        {
            if (state.mode != GameMode.Points) return 0f;
            float makeability = Mathf.Clamp01((candidate.openScore + candidate.centeringScore) * 0.5f);
            makeability *= Mathf.Clamp01(1f - candidate.cutAngle / 1.4f);
            makeability *= Mathf.Clamp01(1f - candidate.jawRisk);
            return objectBall.points * makeability;
        }

        private float ScoreCandidate(GameState state, Ball objectBall, CandidateShot candidate)
        {
            if (!candidate.cueClear || !candidate.objClear) return float.NegativeInfinity;
            float cutPenalty = Mathf.Clamp01(candidate.cutAngle / 1.35f);
            float distObjPenalty = Mathf.Clamp01(candidate.distObj / 2.2f);
            float distCuePenalty = Mathf.Clamp01(candidate.distCue / 2.5f);
            float score =
                weights.wOpen * candidate.openScore +
                weights.wCenter * candidate.centeringScore -
                weights.wJaw * candidate.jawRisk -
                weights.wCut * cutPenalty -
                weights.wDistO * distObjPenalty -
                weights.wDistC * distCuePenalty -
                weights.wScratch * candidate.scratchRisk -
                weights.wSell * candidate.sellRisk -
                weights.wMode * candidate.crowdedMouthPenalty -
                weights.wMode * candidate.nearMissPenalty;

            if (state.mode == GameMode.Points)
            {
                score += weights.wPoints * candidate.expectedPoints;
            }

            if (state.mode == GameMode.NineBall && objectBall.id == 9)
            {
                score += weights.wMode * 0.5f * candidate.openScore;
            }

            if (candidate.openingAngle < 0.18f)
            {
                score -= weights.wOpen * 1.2f;
            }

            if (candidate.cutAngle > 1.2f && candidate.openingAngle < 0.3f)
            {
                score -= weights.wCut * 2.2f;
            }

            if (objectBall.type == BallType.Eight && !PoolRules.IsEightBallLegal(state, objectBall))
            {
                return float.NegativeInfinity;
            }

            return score;
        }

        public static float SmallestAngleBetween(float angleA, float angleB)
        {
            return AbsAngularDifference(angleA, angleB);
        }

        public static float AbsAngularDifference(float angleA, float angleB)
        {
            float delta = Mathf.DeltaAngle(angleA * Mathf.Rad2Deg, angleB * Mathf.Rad2Deg);
            return Mathf.Abs(delta) * Mathf.Deg2Rad;
        }

        private static float Normalize(float value, float min, float max)
        {
            if (Mathf.Abs(max - min) < Mathf.Epsilon) return 0f;
            return Mathf.Clamp01((value - min) / (max - min));
        }
    }
}
