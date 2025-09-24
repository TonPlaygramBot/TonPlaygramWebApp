using System;
using System.Collections.Generic;
using UnityEngine;

namespace TonPlaygram.Snooker.Game
{
    public readonly struct FoulResult
    {
        public FoulResult(bool isFoul, string reason, int penaltyPoints)
        {
            IsFoul = isFoul;
            Reason = reason;
            PenaltyPoints = penaltyPoints;
        }

        public bool IsFoul { get; }
        public string Reason { get; }
        public int PenaltyPoints { get; }
    }

    public sealed class FoulDetector : MonoBehaviour
    {
        public FoulResult EvaluateShot(
            in ShotDescriptor shotDescriptor,
            TargetMode targetMode,
            BallType? specificTarget,
            int ballOnValue,
            IReadOnlyDictionary<BallType, int> pointValues)
        {
            if (pointValues == null)
            {
                throw new ArgumentNullException(nameof(pointValues));
            }

            if (shotDescriptor.BallOffTable)
            {
                var penalty = CalculatePenalty(ballOnValue, shotDescriptor, pointValues, 7);
                return new FoulResult(true, "Ball off table", penalty);
            }

            if (!shotDescriptor.FirstBallContact.HasValue)
            {
                var penalty = CalculatePenalty(ballOnValue, shotDescriptor, pointValues);
                return new FoulResult(true, "No ball hit", penalty);
            }

            var firstContact = shotDescriptor.FirstBallContact.Value;
            if (!IsFirstContactLegal(firstContact, targetMode, specificTarget))
            {
                var penalty = CalculatePenalty(ballOnValue, shotDescriptor, pointValues);
                return new FoulResult(true, "Wrong ball first hit", penalty);
            }

            if (shotDescriptor.CueBallPotted)
            {
                var penalty = CalculatePenalty(ballOnValue, shotDescriptor, pointValues, 4);
                return new FoulResult(true, "Cue ball potted", penalty);
            }

            if (PottingIllegalBall(shotDescriptor, targetMode, specificTarget))
            {
                var penalty = CalculatePenalty(ballOnValue, shotDescriptor, pointValues);
                return new FoulResult(true, "Ball not on potted", penalty);
            }

            return new FoulResult(false, string.Empty, 0);
        }

        private static bool IsFirstContactLegal(BallType firstContact, TargetMode targetMode, BallType? specificTarget)
        {
            return targetMode switch
            {
                TargetMode.Red => firstContact == BallType.Red,
                TargetMode.Colour => firstContact != BallType.Red && firstContact != BallType.Cue,
                TargetMode.SpecificColour => specificTarget.HasValue && firstContact == specificTarget.Value,
                _ => false
            };
        }

        private static bool PottingIllegalBall(in ShotDescriptor shotDescriptor, TargetMode targetMode, BallType? specificTarget)
        {
            if (shotDescriptor.PottedBalls == null || shotDescriptor.PottedBalls.Count == 0)
            {
                return false;
            }

            foreach (var ball in shotDescriptor.PottedBalls)
            {
                switch (targetMode)
                {
                    case TargetMode.Red when ball != BallType.Red:
                        return true;
                    case TargetMode.Colour when ball == BallType.Red:
                        return true;
                    case TargetMode.SpecificColour when (!specificTarget.HasValue || ball != specificTarget.Value):
                        return true;
                }
            }

            return false;
        }

        private static int CalculatePenalty(
            int ballOnValue,
            in ShotDescriptor shotDescriptor,
            IReadOnlyDictionary<BallType, int> pointValues,
            int minimumOverride = 0)
        {
            var highest = ballOnValue;

            if (shotDescriptor.FirstBallContact.HasValue && pointValues.TryGetValue(shotDescriptor.FirstBallContact.Value, out var firstContactValue))
            {
                highest = Mathf.Max(highest, firstContactValue);
            }

            if (shotDescriptor.PottedBalls != null)
            {
                foreach (var ball in shotDescriptor.PottedBalls)
                {
                    if (!pointValues.TryGetValue(ball, out var value))
                    {
                        continue;
                    }

                    highest = Mathf.Max(highest, value);
                }
            }

            if (shotDescriptor.CueBallPotted)
            {
                highest = Mathf.Max(highest, 4);
            }

            if (minimumOverride > 0)
            {
                highest = Mathf.Max(highest, minimumOverride);
            }

            return Mathf.Max(4, Mathf.Clamp(highest, 0, 7));
        }
    }
}
