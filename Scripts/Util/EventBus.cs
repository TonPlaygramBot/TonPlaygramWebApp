using System;
using TonPlaygram.Snooker.Game;

namespace TonPlaygram.Snooker.Util
{
    public static class EventBus
    {
        public static event Action<BallType> BallPotted;
        public static event Action<string, int> FoulOccurred;
        public static event Action<int, int> ScoreUpdated;
        public static event Action<int> FrameEnded;

        public static void RaiseBallPotted(BallType ball)
        {
            BallPotted?.Invoke(ball);
        }

        public static void RaiseFoul(string reason, int penaltyPoints)
        {
            FoulOccurred?.Invoke(reason, penaltyPoints);
        }

        public static void RaiseScoreUpdated(int playerAScore, int playerBScore)
        {
            ScoreUpdated?.Invoke(playerAScore, playerBScore);
        }

        public static void RaiseFrameEnd(int winnerPlayerId)
        {
            FrameEnded?.Invoke(winnerPlayerId);
        }
    }
}
