using System;
using System.Collections.Generic;
using UnityEngine;
using TonPlaygram.Snooker.Util;

namespace TonPlaygram.Snooker.Game
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

    [Serializable]
    public struct FrameScore
    {
        public int PlayerA;
        public int PlayerB;
    }

    public readonly struct ShotDescriptor
    {
        public BallType? FirstBallContact { get; init; }
        public IReadOnlyList<BallType> PottedBalls { get; init; }
        public bool CueBallPotted { get; init; }
        public bool BallOffTable { get; init; }

        public bool HasPotted(BallType ballType)
        {
            if (PottedBalls == null)
            {
                return false;
            }

            for (var i = 0; i < PottedBalls.Count; i++)
            {
                if (PottedBalls[i] == ballType)
                {
                    return true;
                }
            }

            return false;
        }

        public int CountPotted(BallType ballType)
        {
            if (PottedBalls == null || PottedBalls.Count == 0)
            {
                return 0;
            }

            var total = 0;
            for (var i = 0; i < PottedBalls.Count; i++)
            {
                if (PottedBalls[i] == ballType)
                {
                    total++;
                }
            }

            return total;
        }
    }

    public sealed class SnookerGameManager : MonoBehaviour
    {
        private static readonly Dictionary<BallType, int> PointValues = new()
        {
            { BallType.Red, 1 },
            { BallType.Yellow, 2 },
            { BallType.Green, 3 },
            { BallType.Brown, 4 },
            { BallType.Blue, 5 },
            { BallType.Pink, 6 },
            { BallType.Black, 7 }
        };

        [SerializeField]
        private TurnManager turnManager;

        [SerializeField]
        private FoulDetector foulDetector;

        [SerializeField]
        private FrameScore frameScore;

        [SerializeField]
        private int totalRedsOnTable = 15;

        private readonly BallType[] _colourClearanceOrder =
        {
            BallType.Yellow,
            BallType.Green,
            BallType.Brown,
            BallType.Blue,
            BallType.Pink,
            BallType.Black
        };

        private readonly HashSet<BallType> _coloursOnTable = new()
        {
            BallType.Yellow,
            BallType.Green,
            BallType.Brown,
            BallType.Blue,
            BallType.Pink,
            BallType.Black
        };

        private PlayPhase _currentPhase = PlayPhase.RedPhase;
        private TargetMode _currentTargetMode = TargetMode.Red;
        private BallType? _specificTargetColour;
        private int _remainingReds;
        private int _colourClearanceIndex;
        private bool _reSpottedBlackActive;
        private bool _frameEnded;

        private void Awake()
        {
            if (turnManager == null)
            {
                Debug.LogError("TurnManager reference not assigned.");
            }

            if (foulDetector == null)
            {
                Debug.LogError("FoulDetector reference not assigned.");
            }

            _remainingReds = Mathf.Max(0, totalRedsOnTable);
        }

        public void StartFrame(int startingPlayerId = 0)
        {
            _frameEnded = false;
            _reSpottedBlackActive = false;
            _currentPhase = PlayPhase.RedPhase;
            _currentTargetMode = TargetMode.Red;
            _specificTargetColour = null;
            _remainingReds = Mathf.Max(0, totalRedsOnTable);
            _colourClearanceIndex = 0;
            _coloursOnTable.Clear();
            _coloursOnTable.UnionWith(_colourClearanceOrder);
            frameScore.PlayerA = 0;
            frameScore.PlayerB = 0;
            turnManager?.Reset(startingPlayerId);
            EventBus.RaiseScoreUpdated(frameScore.PlayerA, frameScore.PlayerB);
        }

        public void ResolveShot(in ShotDescriptor shotDescriptor)
        {
            if (_frameEnded)
            {
                Debug.LogWarning("Shot received after frame ended. Ignored.");
                return;
            }

            if (turnManager == null)
            {
                Debug.LogError("TurnManager missing. Cannot resolve shot.");
                return;
            }

            var ballOnValue = DetermineBallOnValue();
            // TODO: Handle free ball scenarios and adjust ball-on logic accordingly.
            var foulResult = foulDetector?.EvaluateShot(
                shotDescriptor,
                _currentTargetMode,
                _specificTargetColour,
                ballOnValue,
                PointValues);

            if (foulResult is { IsFoul: true })
            {
                HandleFoul(foulResult.Value);
                return;
            }

            HandleLegalShot(shotDescriptor);
        }

        private int DetermineBallOnValue()
        {
            if (_reSpottedBlackActive)
            {
                return PointValues[BallType.Black];
            }

            return _currentTargetMode switch
            {
                TargetMode.Red => PointValues[BallType.Red],
                TargetMode.Colour => DetermineHighestAvailableColourValue(),
                TargetMode.SpecificColour when _specificTargetColour.HasValue && PointValues.TryGetValue(_specificTargetColour.Value, out var value) => value,
                _ => PointValues[BallType.Red]
            };
        }

        private int DetermineHighestAvailableColourValue()
        {
            var highest = 0;
            foreach (var colour in _coloursOnTable)
            {
                if (!PointValues.TryGetValue(colour, out var value))
                {
                    continue;
                }

                if (value > highest)
                {
                    highest = value;
                }
            }

            return highest == 0 ? PointValues[BallType.Black] : highest;
        }

        private void HandleFoul(in FoulResult foulResult)
        {
            var opponentId = turnManager.GetOpponentId();
            AddPoints(opponentId, foulResult.PenaltyPoints);
            EventBus.RaiseFoul(foulResult.Reason, foulResult.PenaltyPoints);
            EventBus.RaiseScoreUpdated(frameScore.PlayerA, frameScore.PlayerB);

            if (_reSpottedBlackActive)
            {
                EndFrame(opponentId);
                return;
            }

            turnManager.SwitchTurn();
        }

        private void HandleLegalShot(in ShotDescriptor shotDescriptor)
        {
            var pointsScored = 0;
            var continueTurn = false;

            switch (_currentPhase)
            {
                case PlayPhase.RedPhase:
                    HandleRedPhaseShot(shotDescriptor, ref pointsScored, ref continueTurn);
                    break;
                case PlayPhase.ColourPhase:
                    HandleColourPhaseShot(shotDescriptor, ref pointsScored, ref continueTurn);
                    break;
                default:
                    throw new ArgumentOutOfRangeException();
            }

            if (pointsScored > 0)
            {
                AddPoints(turnManager.CurrentPlayerId, pointsScored);
                EventBus.RaiseScoreUpdated(frameScore.PlayerA, frameScore.PlayerB);
            }

            if (!continueTurn)
            {
                turnManager.SwitchTurn();
            }
        }

        private void HandleRedPhaseShot(in ShotDescriptor shotDescriptor, ref int pointsScored, ref bool continueTurn)
        {
            switch (_currentTargetMode)
            {
                case TargetMode.Red:
                    var redsPotted = shotDescriptor.CountPotted(BallType.Red);
                    if (redsPotted > 0)
                    {
                        pointsScored += redsPotted * PointValues[BallType.Red];
                        _remainingReds = Mathf.Max(0, _remainingReds - redsPotted);
                        continueTurn = true;
                        _currentTargetMode = TargetMode.Colour;
                    }
                    else
                    {
                        continueTurn = false;
                    }

                    break;
                case TargetMode.Colour:
                    var colourPoints = 0;
                    if (shotDescriptor.PottedBalls != null)
                    {
                        foreach (var ball in shotDescriptor.PottedBalls)
                        {
                            if (ball == BallType.Red)
                            {
                                continue;
                            }

                            if (!PointValues.TryGetValue(ball, out var value))
                            {
                                continue;
                            }

                            colourPoints += value;
                            ReSpotColour(ball);
                        }
                    }

                    if (colourPoints > 0)
                    {
                        pointsScored += colourPoints;
                        continueTurn = true;
                    }
                    else
                    {
                        continueTurn = false;
                    }

                    _currentTargetMode = TargetMode.Red;
                    break;
                default:
                    Debug.LogError($"Unexpected target mode {_currentTargetMode} in red phase.");
                    break;
            }

            if (_remainingReds == 0 && _currentTargetMode == TargetMode.Red)
            {
                EnterColourClearance();
            }
        }

        private void HandleColourPhaseShot(in ShotDescriptor shotDescriptor, ref int pointsScored, ref bool continueTurn)
        {
            if (!_specificTargetColour.HasValue)
            {
                Debug.LogError("Colour phase active but no target colour set.");
                return;
            }

            var targetColour = _specificTargetColour.Value;
            if (shotDescriptor.HasPotted(targetColour))
            {
                if (PointValues.TryGetValue(targetColour, out var value))
                {
                    pointsScored += value;
                }

                _coloursOnTable.Remove(targetColour);
                continueTurn = true;
                AdvanceColourClearance();
            }
            else
            {
                continueTurn = false;
            }
        }

        private void EnterColourClearance()
        {
            _currentPhase = PlayPhase.ColourPhase;
            _colourClearanceIndex = 0;
            _currentTargetMode = TargetMode.SpecificColour;
            _specificTargetColour = _colourClearanceOrder[_colourClearanceIndex];
        }

        private void AdvanceColourClearance()
        {
            if (_reSpottedBlackActive)
            {
                EndFrame(turnManager.CurrentPlayerId);
                return;
            }

            _colourClearanceIndex++;
            if (_colourClearanceIndex >= _colourClearanceOrder.Length)
            {
                FinaliseFrameAfterClearance();
                return;
            }

            _specificTargetColour = _colourClearanceOrder[_colourClearanceIndex];
        }

        private void FinaliseFrameAfterClearance()
        {
            if (frameScore.PlayerA == frameScore.PlayerB)
            {
                BeginReSpottedBlack();
                return;
            }

            var winner = frameScore.PlayerA > frameScore.PlayerB ? 0 : 1;
            EndFrame(winner);
        }

        private void BeginReSpottedBlack()
        {
            _reSpottedBlackActive = true;
            _currentPhase = PlayPhase.ColourPhase;
            _currentTargetMode = TargetMode.SpecificColour;
            _specificTargetColour = BallType.Black;
            _coloursOnTable.Clear();
            _coloursOnTable.Add(BallType.Black);
            Debug.Log("Re-spotted black initiated.");
        }

        private void EndFrame(int winnerPlayerId)
        {
            if (_frameEnded)
            {
                return;
            }

            _frameEnded = true;
            EventBus.RaiseFrameEnd(winnerPlayerId);
        }

        private void AddPoints(int playerId, int points)
        {
            if (points <= 0)
            {
                return;
            }

            if (playerId == 0)
            {
                frameScore.PlayerA += points;
            }
            else
            {
                frameScore.PlayerB += points;
            }
        }

        private void ReSpotColour(BallType colour)
        {
            if (!_coloursOnTable.Contains(colour))
            {
                _coloursOnTable.Add(colour);
            }

            // TODO: Implement spot resolution rules when multiple balls occupy a spot.
        }
    }
}
