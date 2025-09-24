using System;
using System.Collections.Generic;
using System.Linq;

namespace TonPlaygram.Billiards
{
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

    public enum PlayPhase
    {
        RedPhase,
        ColourPhase
    }

    public enum TargetMode
    {
        Red,
        Colour,
        SpecificColour
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

    public readonly struct FoulResult
    {
        private FoulResult(bool isFoul, string reason, int penaltyPoints)
        {
            IsFoul = isFoul;
            Reason = reason;
            PenaltyPoints = penaltyPoints;
        }

        public bool IsFoul { get; }
        public string Reason { get; }
        public int PenaltyPoints { get; }

        public static FoulResult NoFoul => new(false, string.Empty, 0);

        public static FoulResult Create(string reason, int penaltyPoints)
        {
            return new FoulResult(true, reason, penaltyPoints);
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

    internal sealed class ShotState
    {
        private readonly List<BallType> _pottedBalls = new();
        private readonly List<BallType> _ballsOffTable = new();
        private BallType? _firstContact;

        public bool ShotInProgress { get; private set; }
        public bool CueBallPotted { get; private set; }

        public void Begin()
        {
            if (ShotInProgress)
            {
                return;
            }

            ShotInProgress = true;
            _firstContact = null;
            _pottedBalls.Clear();
            _ballsOffTable.Clear();
            CueBallPotted = false;
        }

        public void RegisterFirstContact(BallType ball)
        {
            if (_firstContact.HasValue)
            {
                return;
            }

            _firstContact = ball;
        }

        public void RegisterPot(BallType ball)
        {
            if (!ShotInProgress)
            {
                Begin();
            }

            if (ball == BallType.Cue)
            {
                CueBallPotted = true;
                return;
            }

            _pottedBalls.Add(ball);
        }

        public void RegisterBallOffTable(BallType ball)
        {
            if (!ShotInProgress)
            {
                Begin();
            }

            _ballsOffTable.Add(ball);
        }

        public ShotSummary CreateSummary()
        {
            return new ShotSummary(ShotInProgress, _firstContact, _pottedBalls.ToList(), CueBallPotted, _ballsOffTable.ToList());
        }

        public void Reset()
        {
            ShotInProgress = false;
            _firstContact = null;
            _pottedBalls.Clear();
            _ballsOffTable.Clear();
            CueBallPotted = false;
        }
    }

    internal static class FoulDetector
    {
        public static FoulResult Evaluate(
            ShotSummary shot,
            TargetBallInfo target,
            IReadOnlyDictionary<BallType, int> pointValues)
        {
            if (!shot.ShotInProgress)
            {
                return FoulResult.NoFoul;
            }

            int highestValue = GetBallOnValue(target, pointValues);

            if (!shot.HasHitAnyBall)
            {
                return FoulResult.Create("No ball contacted", Math.Max(4, highestValue));
            }

            switch (target.Mode)
            {
                case TargetMode.Red:
                    if (shot.FirstContact != BallType.Red)
                    {
                        highestValue = ConsiderBallValue(highestValue, shot.FirstContact, pointValues);
                        return FoulResult.Create("Must strike a red first", Math.Max(4, highestValue));
                    }

                    if (shot.PottedBalls.Any(IsColour))
                    {
                        foreach (var ball in shot.PottedBalls.Where(IsColour))
                        {
                            highestValue = ConsiderBallValue(highestValue, ball, pointValues);
                        }

                        return FoulResult.Create("Colour potted when red was on", Math.Max(4, highestValue));
                    }

                    break;
                case TargetMode.Colour:
                    if (!shot.FirstContact.HasValue || shot.FirstContact == BallType.Red)
                    {
                        highestValue = ConsiderBallValue(highestValue, shot.FirstContact, pointValues);
                        return FoulResult.Create("Must strike a colour first", Math.Max(4, highestValue));
                    }

                    if (shot.PottedBalls.Any(ball => ball == BallType.Red))
                    {
                        highestValue = ConsiderBallValue(highestValue, BallType.Red, pointValues);
                        return FoulResult.Create("Red potted when colour was on", Math.Max(4, highestValue));
                    }

                    break;
                case TargetMode.SpecificColour:
                    if (!target.SpecificColour.HasValue)
                    {
                        return FoulResult.NoFoul;
                    }

                    var required = target.SpecificColour.Value;
                    if (shot.FirstContact != required)
                    {
                        highestValue = ConsiderBallValue(highestValue, shot.FirstContact, pointValues);
                        return FoulResult.Create($"Must strike {required} first", Math.Max(4, highestValue));
                    }

                    if (shot.PottedBalls.Any(ball => ball != required))
                    {
                        foreach (var ball in shot.PottedBalls.Where(ball => ball != required))
                        {
                            highestValue = ConsiderBallValue(highestValue, ball, pointValues);
                        }

                        return FoulResult.Create("Ball not on was potted", Math.Max(4, highestValue));
                    }

                    break;
            }

            if (shot.BallsOffTable.Count > 0)
            {
                foreach (var ball in shot.BallsOffTable)
                {
                    highestValue = ConsiderBallValue(highestValue, ball, pointValues);
                }

                return FoulResult.Create("Ball left the table", Math.Max(4, highestValue));
            }

            if (shot.CueBallPotted)
            {
                return FoulResult.Create("Cue ball potted", Math.Max(4, highestValue));
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

    /// <summary>
    /// Comprehensive snooker rules engine implementing WPBSA frame logic.
    /// </summary>
    public class SnookerGameState
    {
        private static readonly IReadOnlyDictionary<BallType, int> PointValues = new Dictionary<BallType, int>
        {
            { BallType.Red, 1 },
            { BallType.Yellow, 2 },
            { BallType.Green, 3 },
            { BallType.Brown, 4 },
            { BallType.Blue, 5 },
            { BallType.Pink, 6 },
            { BallType.Black, 7 }
        };

        private static readonly BallType[] ColourOrder =
        {
            BallType.Yellow,
            BallType.Green,
            BallType.Brown,
            BallType.Blue,
            BallType.Pink,
            BallType.Black
        };

        private readonly ShotState _shotState = new();
        private readonly Dictionary<BallType, bool> _coloursOnTable = new();

        private PlayPhase _playPhase;
        private TargetBallInfo _currentTarget;
        private int _redsRemaining;
        private int _colourClearanceIndex;
        private bool _frameEnded;
        private bool _reSpottedBlackActive;
        private int _targetScore;

        public event Action<int, int>? ScoreUpdated;
        public event Action<string, int>? FoulCommitted;
        public event Action<int>? FrameEnded;

        public int[] Scores { get; } = new int[2];

        public int CurrentPlayer { get; private set; }

        public PlayPhase Phase => _playPhase;

        public TargetBallInfo CurrentTarget => _currentTarget;

        public bool FrameOver => _frameEnded;

        public bool ReSpottedBlackActive => _reSpottedBlackActive;

        public int RedsRemaining => _redsRemaining;

        public int TargetScore => _targetScore;

        public bool GameOver => _frameEnded;

        public void ResetGame(int reds = 15, int targetScore = 0)
        {
            Scores[0] = 0;
            Scores[1] = 0;
            CurrentPlayer = 0;
            _redsRemaining = Math.Max(0, reds);
            _colourClearanceIndex = 0;
            _playPhase = PlayPhase.RedPhase;
            _currentTarget = new TargetBallInfo(TargetMode.Red, null);
            _frameEnded = false;
            _reSpottedBlackActive = false;
            _targetScore = Math.Max(0, targetScore);
            _shotState.Reset();

            _coloursOnTable.Clear();
            _coloursOnTable[BallType.Yellow] = true;
            _coloursOnTable[BallType.Green] = true;
            _coloursOnTable[BallType.Brown] = true;
            _coloursOnTable[BallType.Blue] = true;
            _coloursOnTable[BallType.Pink] = true;
            _coloursOnTable[BallType.Black] = true;

            RaiseScoreUpdated();

            EnsureColourPhaseIfNoReds();
        }

        public void StartShot()
        {
            if (_frameEnded)
            {
                return;
            }

            _shotState.Begin();
        }

        public void RegisterFirstContact(BallType ball)
        {
            if (_frameEnded)
            {
                return;
            }

            EnsureShotStarted();
            _shotState.RegisterFirstContact(ball);
        }

        public void PotBall(BallType ball)
        {
            if (_frameEnded)
            {
                return;
            }

            EnsureShotStarted();
            _shotState.RegisterPot(ball);

            if (ball == BallType.Red)
            {
                _redsRemaining = Math.Max(0, _redsRemaining - 1);
            }
        }

        public void PotCueBall()
        {
            PotBall(BallType.Cue);
        }

        public void ReportBallOffTable(BallType ball)
        {
            if (_frameEnded)
            {
                return;
            }

            EnsureShotStarted();
            _shotState.RegisterBallOffTable(ball);
        }

        public void EndShot()
        {
            if (!_shotState.ShotInProgress)
            {
                return;
            }

            if (_frameEnded)
            {
                _shotState.Reset();
                return;
            }

            var summary = _shotState.CreateSummary();
            var foulResult = FoulDetector.Evaluate(summary, _currentTarget, PointValues);

            if (foulResult.IsFoul)
            {
                ApplyFoul(summary, foulResult);
            }
            else
            {
                HandleLegalShot(summary);
            }

            _shotState.Reset();
        }

        public void ConcedeFoul(int value, string reason = "Manual foul")
        {
            if (_frameEnded)
            {
                return;
            }

            int penalty = Math.Max(4, value);
            AwardFoulToOpponent(reason, penalty);

            if (_reSpottedBlackActive)
            {
                EndFrame(1 - CurrentPlayer);
            }
            else
            {
                SwitchPlayer();
            }
        }

        public void Foul(int value)
        {
            ConcedeFoul(value);
        }

        public void EndTurn()
        {
            if (_frameEnded)
            {
                return;
            }

            _shotState.Reset();
            SwitchPlayer();

            if (_playPhase == PlayPhase.RedPhase)
            {
                _currentTarget = new TargetBallInfo(TargetMode.Red, null);
            }
            else if (_playPhase == PlayPhase.ColourPhase && !_reSpottedBlackActive)
            {
                _currentTarget = new TargetBallInfo(TargetMode.SpecificColour, ColourOrder[_colourClearanceIndex]);
            }
        }

        private void ApplyFoul(ShotSummary summary, FoulResult foulResult)
        {
            AwardFoulToOpponent(foulResult.Reason, foulResult.PenaltyPoints);
            RestoreColoursAfterFoul(summary);
            EnsureColourPhaseIfNoReds();

            if (_reSpottedBlackActive)
            {
                EndFrame(1 - CurrentPlayer);
                return;
            }

            SwitchPlayer();
        }

        private void AwardFoulToOpponent(string reason, int penalty)
        {
            int opponent = 1 - CurrentPlayer;
            AddScore(opponent, penalty);
            FoulCommitted?.Invoke(reason, penalty);
        }

        private void HandleLegalShot(ShotSummary summary)
        {
            int points = CalculatePoints(summary);

            if (points > 0)
            {
                AddScore(CurrentPlayer, points);
            }

            ProcessBallStatesAfterLegalShot(summary);
            UpdateTargetAfterLegalShot(summary);
            EnsureColourPhaseIfNoReds();

            bool continueTurn = points > 0 && !_frameEnded && !_reSpottedBlackActive;

            if (!continueTurn && !_frameEnded)
            {
                SwitchPlayer();
            }
        }

        private void UpdateTargetAfterLegalShot(ShotSummary summary)
        {
            switch (_currentTarget.Mode)
            {
                case TargetMode.Red:
                    if (summary.PottedBalls.Any(ball => ball == BallType.Red))
                    {
                        _currentTarget = new TargetBallInfo(TargetMode.Colour, null);
                    }
                    break;
                case TargetMode.Colour:
                    if (summary.PottedBalls.Any(ball => ball != BallType.Cue))
                    {
                        if (_redsRemaining > 0)
                        {
                            _currentTarget = new TargetBallInfo(TargetMode.Red, null);
                        }
                        else
                        {
                            BeginColourPhase();
                        }
                    }
                    else
                    {
                        if (_redsRemaining > 0)
                        {
                            _currentTarget = new TargetBallInfo(TargetMode.Red, null);
                        }
                        else
                        {
                            BeginColourPhase();
                        }
                    }
                    break;
                case TargetMode.SpecificColour:
                    if (!_currentTarget.SpecificColour.HasValue)
                    {
                        return;
                    }

                    var target = _currentTarget.SpecificColour.Value;
                    if (summary.PottedBalls.Any(ball => ball == target))
                    {
                        AdvanceColourPhase();
                    }
                    break;
            }
        }

        private void BeginColourPhase()
        {
            _playPhase = PlayPhase.ColourPhase;
            _colourClearanceIndex = 0;
            _currentTarget = new TargetBallInfo(TargetMode.SpecificColour, ColourOrder[_colourClearanceIndex]);
        }

        private void EnsureColourPhaseIfNoReds()
        {
            if (_playPhase == PlayPhase.ColourPhase)
            {
                return;
            }

            if (_redsRemaining > 0)
            {
                return;
            }

            BeginColourPhase();
        }

        private void AdvanceColourPhase()
        {
            if (_reSpottedBlackActive)
            {
                EndFrame(CurrentPlayer);
                return;
            }

            _colourClearanceIndex++;
            if (_colourClearanceIndex >= ColourOrder.Length)
            {
                HandleColourClearanceComplete();
            }
            else
            {
                _currentTarget = new TargetBallInfo(TargetMode.SpecificColour, ColourOrder[_colourClearanceIndex]);
            }
        }

        private void HandleColourClearanceComplete()
        {
            int scoreDifference = Scores[0] - Scores[1];
            if (scoreDifference == 0)
            {
                StartReSpottedBlack();
            }
            else
            {
                int winner = scoreDifference > 0 ? 0 : 1;
                EndFrame(winner);
            }
        }

        private void StartReSpottedBlack()
        {
            _reSpottedBlackActive = true;
            _playPhase = PlayPhase.ColourPhase;
            _colourClearanceIndex = ColourOrder.Length - 1;
            _currentTarget = new TargetBallInfo(TargetMode.SpecificColour, BallType.Black);
            _coloursOnTable[BallType.Black] = true;
        }

        private void EndFrame(int winner)
        {
            if (_frameEnded)
            {
                return;
            }

            _frameEnded = true;
            FrameEnded?.Invoke(winner);
        }

        private int CalculatePoints(ShotSummary summary)
        {
            int points = 0;
            foreach (var ball in summary.PottedBalls)
            {
                if (PointValues.TryGetValue(ball, out var value))
                {
                    points += value;
                }
            }

            return points;
        }

        private void AddScore(int player, int points)
        {
            if (points <= 0)
            {
                return;
            }

            Scores[player] += points;
            RaiseScoreUpdated();

            if (_targetScore > 0 && Scores[player] >= _targetScore)
            {
                EndFrame(player);
            }
        }

        private void RaiseScoreUpdated()
        {
            ScoreUpdated?.Invoke(Scores[0], Scores[1]);
        }

        private void ProcessBallStatesAfterLegalShot(ShotSummary summary)
        {
            foreach (var ball in summary.PottedBalls)
            {
                if (ball == BallType.Red)
                {
                    continue;
                }

                if (_playPhase == PlayPhase.RedPhase && _currentTarget.Mode != TargetMode.SpecificColour)
                {
                    _coloursOnTable[ball] = true;
                }
                else
                {
                    _coloursOnTable[ball] = false;
                }
            }
        }

        private void RestoreColoursAfterFoul(ShotSummary summary)
        {
            foreach (var ball in summary.PottedBalls)
            {
                if (ball == BallType.Red)
                {
                    continue;
                }

                _coloursOnTable[ball] = true;
            }

            foreach (var ball in summary.BallsOffTable)
            {
                if (ball == BallType.Red)
                {
                    continue;
                }

                _coloursOnTable[ball] = true;
            }
        }

        private void SwitchPlayer()
        {
            CurrentPlayer = 1 - CurrentPlayer;
        }

        private void EnsureShotStarted()
        {
            if (!_shotState.ShotInProgress)
            {
                _shotState.Begin();
            }
        }

        public static BallType ParseBall(string colour)
        {
            return colour.ToLowerInvariant() switch
            {
                "red" => BallType.Red,
                "yellow" => BallType.Yellow,
                "green" => BallType.Green,
                "brown" => BallType.Brown,
                "blue" => BallType.Blue,
                "pink" => BallType.Pink,
                "black" => BallType.Black,
                "cue" => BallType.Cue,
                _ => throw new ArgumentException($"Unknown ball colour '{colour}'", nameof(colour))
            };
        }

        public void PotBall(string colour)
        {
            var ball = ParseBall(colour);
            StartShot();
            if (ball != BallType.Cue)
            {
                RegisterFirstContact(ball);
            }
            PotBall(ball);
            EndShot();
        }
    }
}
