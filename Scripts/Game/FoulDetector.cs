using System;
using System.Collections.Generic;
using System.Linq;
using TonPlay.Snooker.Util;
using UnityEngine;

namespace TonPlay.Snooker.Game
{
    /// <summary>
    /// Encapsulates WPBSA foul validation for a single shot.
    /// </summary>
    public class FoulDetector : MonoBehaviour
    {
        public FoulResult EvaluateShot(ShotSummary shot, TargetBallInfo target, IReadOnlyDictionary<BallType, int> pointValues)
        {
            if (!shot.ShotInProgress)
            {
                return FoulResult.NoFoul;
            }

            int highestValue = GetBallOnValue(target, pointValues);

            if (!shot.HasHitAnyBall)
            {
                return FoulResult.CreateFoul("No ball contacted", Math.Max(4, highestValue));
            }

            switch (target.Mode)
            {
                case TargetMode.Red:
                    if (shot.FirstContact != BallType.Red)
                    {
                        highestValue = ConsiderBallValue(highestValue, shot.FirstContact, pointValues);
                        return FoulResult.CreateFoul("Must strike a red first", Math.Max(4, highestValue));
                    }

                    if (shot.PottedBalls.Any(IsColour))
                    {
                        foreach (var ball in shot.PottedBalls.Where(IsColour))
                        {
                            highestValue = ConsiderBallValue(highestValue, ball, pointValues);
                        }

                        return FoulResult.CreateFoul("Colour potted when red was on", Math.Max(4, highestValue));
                    }

                    break;
                case TargetMode.Colour:
                    if (!shot.FirstContact.HasValue || shot.FirstContact == BallType.Red)
                    {
                        highestValue = ConsiderBallValue(highestValue, shot.FirstContact, pointValues);
                        return FoulResult.CreateFoul("Must strike a colour first", Math.Max(4, highestValue));
                    }

                    if (shot.PottedBalls.Any(ball => ball == BallType.Red))
                    {
                        highestValue = ConsiderBallValue(highestValue, BallType.Red, pointValues);
                        return FoulResult.CreateFoul("Red potted when colour was on", Math.Max(4, highestValue));
                    }

                    break;
                case TargetMode.SpecificColour:
                    if (!target.SpecificColour.HasValue)
                    {
                        Debug.LogError("FoulDetector: SpecificColour target without value");
                        return FoulResult.NoFoul;
                    }

                    var required = target.SpecificColour.Value;
                    if (shot.FirstContact != required)
                    {
                        highestValue = ConsiderBallValue(highestValue, shot.FirstContact, pointValues);
                        return FoulResult.CreateFoul($"Must strike {required} first", Math.Max(4, highestValue));
                    }

                    if (shot.PottedBalls.Any(ball => ball != required))
                    {
                        foreach (var ball in shot.PottedBalls.Where(ball => ball != required))
                        {
                            highestValue = ConsiderBallValue(highestValue, ball, pointValues);
                        }

                        return FoulResult.CreateFoul("Ball not on was potted", Math.Max(4, highestValue));
                    }

                    break;
                default:
                    Debug.LogWarning($"FoulDetector: Unsupported target mode {target.Mode}");
                    break;
            }

            if (shot.BallsOffTable.Count > 0)
            {
                foreach (var ball in shot.BallsOffTable)
                {
                    highestValue = ConsiderBallValue(highestValue, ball, pointValues);
                }

                return FoulResult.CreateFoul("Ball left the table", Math.Max(4, highestValue));
            }

            if (shot.CueBallPotted)
            {
                return FoulResult.CreateFoul("Cue ball potted", Math.Max(4, highestValue));
            }

            return FoulResult.NoFoul;
        }

        private static int ConsiderBallValue(int currentHighest, BallType? ball, IReadOnlyDictionary<BallType, int> pointValues)
        {
            if (!ball.HasValue)
            {
                return currentHighest;
            }

            return ConsiderBallValue(currentHighest, ball.Value, pointValues);
        }

        private static int ConsiderBallValue(int currentHighest, BallType ball, IReadOnlyDictionary<BallType, int> pointValues)
        {
            if (pointValues.TryGetValue(ball, out var value))
            {
                return Math.Max(currentHighest, value);
            }

            return currentHighest;
        }

        private static int GetBallOnValue(TargetBallInfo target, IReadOnlyDictionary<BallType, int> pointValues)
        {
            return target.Mode switch
            {
                TargetMode.Red => pointValues[BallType.Red],
                TargetMode.Colour => pointValues[BallType.Black],
                TargetMode.SpecificColour when target.SpecificColour.HasValue => pointValues[target.SpecificColour.Value],
                _ => 4
            };
        }

        private static bool IsColour(BallType ball)
        {
            return ball != BallType.Cue && ball != BallType.Red;
        }
    }

    public readonly struct ShotSummary
    {
        public ShotSummary(bool shotInProgress, BallType? firstContact, IReadOnlyList<BallType> pottedBalls, bool cueBallPotted, IReadOnlyList<BallType> ballsOffTable)
        {
            ShotInProgress = shotInProgress;
            FirstContact = firstContact;
            PottedBalls = pottedBalls;
            CueBallPotted = cueBallPotted;
            BallsOffTable = ballsOffTable;
        }

        public bool ShotInProgress { get; }
        public BallType? FirstContact { get; }
        public IReadOnlyList<BallType> PottedBalls { get; }
        public bool CueBallPotted { get; }
        public IReadOnlyList<BallType> BallsOffTable { get; }

        public bool HasHitAnyBall => FirstContact.HasValue;
    }

    public readonly struct FoulResult
    {
        private FoulResult(bool isFoul, string reason, int penalty)
        {
            IsFoul = isFoul;
            Reason = reason;
            PenaltyPoints = penalty;
        }

        public bool IsFoul { get; }
        public string Reason { get; }
        public int PenaltyPoints { get; }

        public static FoulResult NoFoul => new(false, string.Empty, 0);

        public static FoulResult CreateFoul(string reason, int penalty)
        {
            return new(true, reason, penalty);
        }
    }

    public readonly struct TargetBallInfo
    {
        public TargetBallInfo(TargetMode mode, BallType? specificColour)
        {
            Mode = mode;
            SpecificColour = specificColour;
        }

        public TargetMode Mode { get; }
        public BallType? SpecificColour { get; }
    }
}
