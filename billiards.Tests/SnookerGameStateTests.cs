using System.Collections.Generic;
using NUnit.Framework;
using TonPlaygram.Billiards;

namespace Billiards.Tests
{
    public class SnookerGameStateTests
    {
        private readonly List<string> _foulLog = new();
        private readonly List<int> _frameWinners = new();

        [SetUp]
        public void SetUp()
        {
            _foulLog.Clear();
            _frameWinners.Clear();
        }

        [Test]
        public void RedPhaseAlternatesBetweenRedAndColour()
        {
            var state = CreateState();
            state.ResetGame(2);

            state.StartShot();
            state.RegisterFirstContact(BallType.Red);
            state.PotBall(BallType.Red);
            state.EndShot();

            Assert.That(state.Scores[0], Is.EqualTo(1));
            Assert.That(state.CurrentTarget.Mode, Is.EqualTo(TargetMode.Colour));
            Assert.That(state.CurrentPlayer, Is.EqualTo(0));

            state.StartShot();
            state.RegisterFirstContact(BallType.Black);
            state.PotBall(BallType.Black);
            state.EndShot();

            Assert.That(state.Scores[0], Is.EqualTo(8));
            Assert.That(state.CurrentTarget.Mode, Is.EqualTo(TargetMode.Red));
            Assert.That(state.CurrentPlayer, Is.EqualTo(0));
        }

        [Test]
        public void ColourPhaseRequiresFixedOrder()
        {
            var state = CreateState();
            state.ResetGame(0);

            Assert.That(state.CurrentTarget.Mode, Is.EqualTo(TargetMode.SpecificColour));
            Assert.That(state.CurrentTarget.SpecificColour, Is.EqualTo(BallType.Yellow));

            state.StartShot();
            state.RegisterFirstContact(BallType.Yellow);
            state.PotBall(BallType.Yellow);
            state.EndShot();

            Assert.That(state.CurrentTarget.SpecificColour, Is.EqualTo(BallType.Green));

            state.StartShot();
            state.RegisterFirstContact(BallType.Blue);
            state.EndShot();

            // Wrong first contact should foul and advance turn.
            Assert.That(_foulLog, Has.Count.EqualTo(1));
            Assert.That(state.Scores[1], Is.EqualTo(5));
            Assert.That(state.CurrentPlayer, Is.EqualTo(1));
        }

        [Test]
        public void FoulWhenWrongBallStruckFirst()
        {
            var state = CreateState();
            state.ResetGame();

            state.StartShot();
            state.RegisterFirstContact(BallType.Yellow);
            state.EndShot();

            Assert.That(_foulLog, Has.Count.EqualTo(1));
            Assert.That(state.Scores[1], Is.EqualTo(4));
            Assert.That(state.CurrentPlayer, Is.EqualTo(1));
        }

        [Test]
        public void FoulWhenCueBallPotted()
        {
            var state = CreateState();
            state.ResetGame();

            state.StartShot();
            state.RegisterFirstContact(BallType.Red);
            state.PotCueBall();
            state.EndShot();

            Assert.That(_foulLog, Has.Count.EqualTo(1));
            Assert.That(state.Scores[1], Is.EqualTo(4));
            Assert.That(state.CurrentPlayer, Is.EqualTo(1));
        }

        [Test]
        public void LegalPotKeepsPlayerAtTable()
        {
            var state = CreateState();
            state.ResetGame(1);

            state.StartShot();
            state.RegisterFirstContact(BallType.Red);
            state.PotBall(BallType.Red);
            state.EndShot();

            state.StartShot();
            state.RegisterFirstContact(BallType.Black);
            state.PotBall(BallType.Black);
            state.EndShot();

            Assert.That(state.CurrentPlayer, Is.EqualTo(0));
            Assert.That(state.Scores[0], Is.EqualTo(8));
        }

        [Test]
        public void NoRedsRemainingSwitchesToColourPhase()
        {
            var state = CreateState();
            state.ResetGame(1);

            state.StartShot();
            state.RegisterFirstContact(BallType.Red);
            state.PotBall(BallType.Red);
            state.EndShot();

            state.StartShot();
            state.RegisterFirstContact(BallType.Black);
            state.PotBall(BallType.Black);
            state.EndShot();

            Assert.That(state.Phase, Is.EqualTo(PlayPhase.ColourPhase));
            Assert.That(state.CurrentTarget.Mode, Is.EqualTo(TargetMode.SpecificColour));
            Assert.That(state.CurrentTarget.SpecificColour, Is.EqualTo(BallType.Yellow));
        }

        [Test]
        public void TieAfterFinalBlackTriggersReSpottedBlack()
        {
            var state = CreateState();
            state.ResetGame(0);

            // Player 0 clears up to pink.
            PotColour(state, BallType.Yellow);
            PotColour(state, BallType.Green);
            PotColour(state, BallType.Brown);
            PotColour(state, BallType.Blue);
            PotColour(state, BallType.Pink);

            // Player 0 deliberately concedes fouls to reduce the lead to seven for the opponent.
            state.ConcedeFoul(6, "Force colour decider");
            state.EndTurn();
            state.ConcedeFoul(7, "Maintain seven point lead");

            Assert.That(state.CurrentPlayer, Is.EqualTo(1));
            Assert.That(state.CurrentTarget.SpecificColour, Is.EqualTo(BallType.Black));
            Assert.That(state.Scores[0] - state.Scores[1], Is.EqualTo(7));

            // Player 1 pots the final black to tie the frame.
            PotColour(state, BallType.Black);

            Assert.That(state.ReSpottedBlackActive, Is.True);
            Assert.That(state.FrameOver, Is.False);
            Assert.That(state.Scores[0], Is.EqualTo(20));
            Assert.That(state.Scores[1], Is.EqualTo(20));

            int reSpotShooter = state.CurrentPlayer;
            Assert.That(reSpotShooter, Is.EqualTo(0));

            // Player 0 wins the re-spotted black.
            PotColour(state, BallType.Black);

            Assert.That(state.FrameOver, Is.True);
            Assert.That(_frameWinners, Is.EqualTo(new[] { 0 }));
            Assert.That(state.Scores[0], Is.EqualTo(27));
        }

        private SnookerGameState CreateState()
        {
            var state = new SnookerGameState();
            state.FoulCommitted += (reason, points) => _foulLog.Add($"{reason}:{points}");
            state.FrameEnded += winner => _frameWinners.Add(winner);
            return state;
        }

        private static void PotColour(SnookerGameState state, BallType colour)
        {
            state.StartShot();
            state.RegisterFirstContact(colour);
            state.PotBall(colour);
            state.EndShot();
        }
    }
}
