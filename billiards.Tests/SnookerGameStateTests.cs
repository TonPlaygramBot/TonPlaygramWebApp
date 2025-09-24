using NUnit.Framework;
using TonPlaygram.Billiards;

namespace Billiards.Tests
{
    public class SnookerGameStateTests
    {
        [Test]
        public void PlayerScoresForRedAndColour()
        {
            var state = new SnookerGameState();
            state.ResetGame(2);

            state.PotBall("red");
            state.PotBall("black");

            Assert.That(state.Scores[0], Is.EqualTo(8));
            Assert.That(state.Scores[1], Is.EqualTo(0));
            Assert.That(state.CurrentPlayer, Is.EqualTo(0));
        }

        [Test]
        public void FoulAwardsPointsToOpponent()
        {
            var state = new SnookerGameState();
            state.ResetGame(1);

            state.Foul(5);

            Assert.That(state.Scores[1], Is.EqualTo(5));
            Assert.That(state.Scores[0], Is.EqualTo(0));
        }

        [Test]
        public void GameEndsAfterColoursCleared()
        {
            var state = new SnookerGameState();
            state.ResetGame(0);

            string[] order = {"yellow", "green", "brown", "blue", "pink", "black"};
            foreach (var c in order)
            {
                state.PotBall(c);
            }

            Assert.That(state.GameOver, Is.True);
        }

        [Test]
        public void GameEndsWhenTargetScoreReached()
        {
            var state = new SnookerGameState();
            state.ResetGame(0, 10);

            state.Foul(7);
            Assert.That(state.GameOver, Is.False);

            state.Foul(7);
            Assert.That(state.GameOver, Is.True);
        }

        [Test]
        public void ClearingBallsDoesNotEndGameBeforeTargetScore()
        {
            var state = new SnookerGameState();
            // Set a target higher than the available points on the table so
            // the frame would normally be cleared without ending.
            state.ResetGame(0, 100);

            string[] order = {"yellow", "green", "brown", "blue", "pink", "black"};
            foreach (var c in order)
            {
                state.PotBall(c);
            }

            Assert.That(state.GameOver, Is.False);
        }
    }
}
