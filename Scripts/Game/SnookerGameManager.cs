using System;
using System.Collections.Generic;
using System.Linq;
using TonPlay.Snooker.Util;
using UnityEngine;

namespace TonPlay.Snooker.Game
{
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

    [Serializable]
    public struct FrameScore
    {
        public int PlayerA;
        public int PlayerB;
    }

    /// <summary>
    /// Central snooker rules engine managing frame progression, scoring and fouls.
    /// </summary>
    public class SnookerGameManager : MonoBehaviour
    {
        public static readonly IReadOnlyDictionary<BallType, int> PointValue = new Dictionary<BallType, int>
        {
            { BallType.Red, 1 },
            { BallType.Yellow, 2 },
            { BallType.Green, 3 },
            { BallType.Brown, 4 },
            { BallType.Blue, 5 },
            { BallType.Pink, 6 },
            { BallType.Black, 7 }
        };

        [Header("Dependencies")]
        [SerializeField]
        private TurnManager? turnManager;

        [SerializeField]
        private FoulDetector? foulDetector;

        [Header("Balls")]
        [SerializeField]
        private BallController? cueBall;

        [SerializeField]
        private BallController[] trackedBalls = Array.Empty<BallController>();

        private readonly Dictionary<BallType, BallController> colourLookup = new();
        private readonly List<BallController> redBalls = new();

        private readonly BallType[] colourClearanceOrder =
        {
            BallType.Yellow,
            BallType.Green,
            BallType.Brown,
            BallType.Blue,
            BallType.Pink,
            BallType.Black
        };

        private readonly ShotState shotState = new();

        private FrameScore frameScore;
        private PlayPhase playPhase;
        private TargetBallInfo currentTarget;
        private int redsRemaining;
        private int colourClearanceIndex;
        private bool frameEnded;
        private bool reSpottedBlackActive;

        private void Awake()
        {
            BuildBallLookup();
        }

        private void OnEnable()
        {
            EventBus.OnBallPotted += HandleBallPottedEvent;
        }

        private void OnDisable()
        {
            EventBus.OnBallPotted -= HandleBallPottedEvent;
        }

        private void Start()
        {
            InitializeFrame();
        }

        public void InitializeFrame()
        {
            if (turnManager == null)
            {
                Debug.LogError("SnookerGameManager: TurnManager reference missing");
            }

            if (foulDetector == null)
            {
                Debug.LogError("SnookerGameManager: FoulDetector reference missing");
            }

            frameEnded = false;
            reSpottedBlackActive = false;
            playPhase = PlayPhase.RedPhase;
            currentTarget = new TargetBallInfo(TargetMode.Red, null);
            frameScore = new FrameScore { PlayerA = 0, PlayerB = 0 };
            colourClearanceIndex = 0;
            shotState.Reset();
            ResetBallsToSpots();
            redsRemaining = redBalls.Count(ball => ball != null);
            turnManager?.ResetForNewFrame();
            EventBus.RaiseScoreUpdated(frameScore.PlayerA, frameScore.PlayerB);
            Debug.Log("SnookerGameManager: Frame initialized");
        }

        public void StartShot()
        {
            if (frameEnded)
            {
                return;
            }

            shotState.Begin();
        }

        public void RegisterFirstContact(BallType ballType)
        {
            if (frameEnded)
            {
                return;
            }

            EnsureShotStarted();
            shotState.RegisterFirstContact(ballType);
        }

        public void ReportBallOffTable(BallType ballType)
        {
            if (frameEnded)
            {
                return;
            }

            EnsureShotStarted();
            shotState.RegisterBallOffTable(ballType);

            if (ballType == BallType.Red)
            {
                redsRemaining = Mathf.Max(0, redsRemaining - 1);
            }
        }

        public void EndShot()
        {
            if (!shotState.ShotInProgress)
            {
                Debug.LogWarning("SnookerGameManager: EndShot called with no active shot");
                return;
            }

            if (frameEnded)
            {
                shotState.Reset();
                return;
            }

            if (foulDetector == null)
            {
                Debug.LogError("SnookerGameManager: Cannot evaluate shot without FoulDetector");
                shotState.Reset();
                return;
            }

            var summary = shotState.CreateSummary();
            var foulResult = foulDetector.EvaluateShot(summary, currentTarget, PointValue);

            if (foulResult.IsFoul)
            {
                ApplyFoul(summary, foulResult);
            }
            else
            {
                HandleLegalShot(summary);
            }

            shotState.Reset();
        }

        private void HandleBallPottedEvent(BallType ballType)
        {
            if (frameEnded)
            {
                return;
            }

            EnsureShotStarted();
            shotState.RegisterPot(ballType);

            if (ballType == BallType.Red)
            {
                redsRemaining = Mathf.Max(0, redsRemaining - 1);
            }
            else if (ballType == BallType.Cue)
            {
                // Cue ball handled via shot state.
            }
        }

        private void ApplyFoul(ShotSummary summary, FoulResult foulResult)
        {
            if (turnManager == null)
            {
                Debug.LogError("SnookerGameManager: TurnManager missing during foul application");
                return;
            }

            var opponent = 1 - turnManager.CurrentPlayerIndex;
            AddScore(opponent, foulResult.PenaltyPoints);
            EventBus.RaiseFoul(foulResult.Reason, foulResult.PenaltyPoints);
            // TODO: Support free-ball selections following fouls.
            RespawnColoursForSummary(summary);
            RespotCueBall();
            EnsureColourPhaseIfNoReds();

            if (reSpottedBlackActive)
            {
                EndFrame(opponent);
                return;
            }

            if (!frameEnded)
            {
                turnManager.SwitchTurn();
            }
        }

        private void HandleLegalShot(ShotSummary summary)
        {
            if (turnManager == null)
            {
                Debug.LogError("SnookerGameManager: TurnManager missing during legal shot handling");
                return;
            }

            var points = CalculatePoints(summary);
            var currentPlayer = turnManager.CurrentPlayerIndex;

            if (points > 0)
            {
                AddScore(currentPlayer, points);
            }

            ProcessBallStatesAfterLegalShot(summary);
            UpdateTargetAfterLegalShot(summary);
            EnsureColourPhaseIfNoReds();

            var continueTurn = points > 0 && !frameEnded && !reSpottedBlackActive;

            if (!continueTurn && !frameEnded)
            {
                turnManager.SwitchTurn();
            }
        }

        private void UpdateTargetAfterLegalShot(ShotSummary summary)
        {
            switch (currentTarget.Mode)
            {
                case TargetMode.Red:
                    if (summary.PottedBalls.Any(ball => ball == BallType.Red))
                    {
                        currentTarget = new TargetBallInfo(TargetMode.Colour, null);
                    }
                    break;
                case TargetMode.Colour:
                    if (summary.PottedBalls.Any(ball => ball != BallType.Cue))
                    {
                        if (redsRemaining > 0)
                        {
                            currentTarget = new TargetBallInfo(TargetMode.Red, null);
                        }
                        else
                        {
                            BeginColourPhase();
                        }
                    }
                    else
                    {
                        if (redsRemaining > 0)
                        {
                            currentTarget = new TargetBallInfo(TargetMode.Red, null);
                        }
                        else
                        {
                            BeginColourPhase();
                        }
                    }
                    break;
                case TargetMode.SpecificColour:
                    if (!currentTarget.SpecificColour.HasValue)
                    {
                        Debug.LogError("SnookerGameManager: SpecificColour target missing value");
                        return;
                    }

                    var targetColour = currentTarget.SpecificColour.Value;
                    if (summary.PottedBalls.Any(ball => ball == targetColour))
                    {
                        AdvanceColourPhase();
                    }
                    break;
            }
        }

        private void BeginColourPhase()
        {
            playPhase = PlayPhase.ColourPhase;
            colourClearanceIndex = 0;
            currentTarget = new TargetBallInfo(TargetMode.SpecificColour, colourClearanceOrder[colourClearanceIndex]);
            Debug.Log("SnookerGameManager: Entering colour clearance phase");
        }

        private void EnsureColourPhaseIfNoReds()
        {
            if (playPhase == PlayPhase.ColourPhase)
            {
                return;
            }

            if (redsRemaining > 0)
            {
                return;
            }

            playPhase = PlayPhase.ColourPhase;
            colourClearanceIndex = 0;
            currentTarget = new TargetBallInfo(TargetMode.SpecificColour, colourClearanceOrder[colourClearanceIndex]);
        }

        private void AdvanceColourPhase()
        {
            if (reSpottedBlackActive)
            {
                var winner = turnManager != null ? turnManager.CurrentPlayerIndex : 0;
                EndFrame(winner);
                return;
            }

            colourClearanceIndex++;
            if (colourClearanceIndex >= colourClearanceOrder.Length)
            {
                HandleColourClearanceComplete();
            }
            else
            {
                currentTarget = new TargetBallInfo(TargetMode.SpecificColour, colourClearanceOrder[colourClearanceIndex]);
            }
        }

        private void HandleColourClearanceComplete()
        {
            var scoreDifference = frameScore.PlayerA - frameScore.PlayerB;
            if (scoreDifference == 0)
            {
                StartReSpottedBlack();
            }
            else
            {
                var winner = scoreDifference > 0 ? 0 : 1;
                EndFrame(winner);
            }
        }

        private void StartReSpottedBlack()
        {
            reSpottedBlackActive = true;
            playPhase = PlayPhase.ColourPhase;
            colourClearanceIndex = colourClearanceOrder.Length - 1;
            currentTarget = new TargetBallInfo(TargetMode.SpecificColour, BallType.Black);

            if (colourLookup.TryGetValue(BallType.Black, out var blackBall))
            {
                blackBall.Respot();
            }

            RespotCueBall();
            Debug.Log("SnookerGameManager: Starting re-spotted black");
        }

        private void EndFrame(int winnerPlayerIndex)
        {
            if (frameEnded)
            {
                return;
            }

            frameEnded = true;
            EventBus.RaiseFrameEnd(winnerPlayerIndex);
            Debug.Log($"SnookerGameManager: Frame ended. Winner {winnerPlayerIndex}");
        }

        private int CalculatePoints(ShotSummary summary)
        {
            var points = 0;
            foreach (var ball in summary.PottedBalls)
            {
                if (PointValue.TryGetValue(ball, out var value))
                {
                    points += value;
                }
            }

            return points;
        }

        private void AddScore(int playerIndex, int points)
        {
            if (points <= 0)
            {
                return;
            }

            if (playerIndex == 0)
            {
                frameScore.PlayerA += points;
            }
            else
            {
                frameScore.PlayerB += points;
            }

            EventBus.RaiseScoreUpdated(frameScore.PlayerA, frameScore.PlayerB);
        }

        private void ProcessBallStatesAfterLegalShot(ShotSummary summary)
        {
            foreach (var ball in summary.PottedBalls)
            {
                if (ball == BallType.Red)
                {
                    continue;
                }

                if (playPhase == PlayPhase.RedPhase && currentTarget.Mode != TargetMode.SpecificColour)
                {
                    RespotColour(ball);
                }
                else
                {
                    RemoveColourFromTable(ball);
                }
            }

            foreach (var ball in summary.BallsOffTable)
            {
                if (ball == BallType.Red)
                {
                    continue;
                }

                if (playPhase == PlayPhase.RedPhase && currentTarget.Mode != TargetMode.SpecificColour)
                {
                    RespotColour(ball);
                }
                else
                {
                    RespotColour(ball);
                }
            }
        }

        private void RespawnColoursForSummary(ShotSummary summary)
        {
            foreach (var ball in summary.PottedBalls)
            {
                if (ball != BallType.Red)
                {
                    RespotColour(ball);
                }
            }

            foreach (var ball in summary.BallsOffTable)
            {
                if (ball != BallType.Red)
                {
                    RespotColour(ball);
                }
            }
        }

        private void RespotCueBall()
        {
            if (cueBall == null)
            {
                return;
            }

            cueBall.Respot();
        }

        private void RespotColour(BallType ball)
        {
            if (colourLookup.TryGetValue(ball, out var controller))
            {
                controller.Respot();
            }
        }

        private void RemoveColourFromTable(BallType ball)
        {
            if (colourLookup.TryGetValue(ball, out var controller))
            {
                controller.RemoveFromTable();
            }
        }

        private void ResetBallsToSpots()
        {
            foreach (var ball in trackedBalls)
            {
                ball?.ResetBall();
            }
        }

        private void BuildBallLookup()
        {
            colourLookup.Clear();
            redBalls.Clear();

            foreach (var ball in trackedBalls)
            {
                if (ball == null)
                {
                    continue;
                }

                switch (ball.BallType)
                {
                    case BallType.Red:
                        redBalls.Add(ball);
                        break;
                    case BallType.Cue:
                        cueBall ??= ball;
                        break;
                    default:
                        colourLookup[ball.BallType] = ball;
                        break;
                }
            }
        }

        private void EnsureShotStarted()
        {
            if (!shotState.ShotInProgress)
            {
                shotState.Begin();
            }
        }

        private class ShotState
        {
            private readonly List<BallType> pottedBalls = new();
            private readonly List<BallType> ballsOffTable = new();
            private BallType? firstContact;

            public bool ShotInProgress { get; private set; }
            public bool CueBallPotted { get; private set; }

            public void Begin()
            {
                if (ShotInProgress)
                {
                    return;
                }

                ShotInProgress = true;
                firstContact = null;
                pottedBalls.Clear();
                ballsOffTable.Clear();
                CueBallPotted = false;
            }

            public void RegisterFirstContact(BallType ballType)
            {
                if (firstContact.HasValue)
                {
                    return;
                }

                firstContact = ballType;
            }

            public void RegisterPot(BallType ballType)
            {
                if (!ShotInProgress)
                {
                    Begin();
                }

                if (ballType == BallType.Cue)
                {
                    CueBallPotted = true;
                    return;
                }

                pottedBalls.Add(ballType);
            }

            public void RegisterBallOffTable(BallType ballType)
            {
                if (!ShotInProgress)
                {
                    Begin();
                }

                ballsOffTable.Add(ballType);
            }

            public ShotSummary CreateSummary()
            {
                return new ShotSummary(ShotInProgress, firstContact, pottedBalls.ToList(), CueBallPotted, ballsOffTable.ToList());
            }

            public void Reset()
            {
                ShotInProgress = false;
                firstContact = null;
                pottedBalls.Clear();
                ballsOffTable.Clear();
                CueBallPotted = false;
            }
        }
    }
}
