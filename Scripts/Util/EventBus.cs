using System;
using UnityEngine;

namespace TonPlay.Snooker.Util
{
    /// <summary>
    /// Global event bus providing strongly typed hooks for UI and gameplay systems.
    /// </summary>
    public static class EventBus
    {
        public static event Action<BallType>? OnBallPotted;
        public static event Action<string, int>? OnFoul;
        public static event Action<int, int>? OnScoreUpdated;
        public static event Action<int>? OnFrameEnd;

        public static void RaiseBallPotted(BallType ball)
        {
            Debug.Log($"EventBus: Ball potted - {ball}");
            OnBallPotted?.Invoke(ball);
        }

        public static void RaiseFoul(string reason, int penaltyPoints)
        {
            Debug.LogWarning($"EventBus: Foul - {reason}, penalty {penaltyPoints}");
            OnFoul?.Invoke(reason, penaltyPoints);
        }

        public static void RaiseScoreUpdated(int playerAScore, int playerBScore)
        {
            Debug.Log($"EventBus: Scores updated A:{playerAScore} B:{playerBScore}");
            OnScoreUpdated?.Invoke(playerAScore, playerBScore);
        }

        public static void RaiseFrameEnd(int winnerPlayerId)
        {
            Debug.Log($"EventBus: Frame ended. Winner {winnerPlayerId}");
            OnFrameEnd?.Invoke(winnerPlayerId);
        }
    }

    public enum BallType
    {
        Cue,
        Red,
        Yellow,
        Green,
        Brown,
        Blue,
        Pink,
        Black
    }
}
