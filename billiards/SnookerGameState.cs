using System;
using System.Collections.Generic;

namespace TonPlaygram.Billiards
{
    /// <summary>
    /// Encapsulates the scoring and turn based logic for a basic game of
    /// snooker.  The implementation only models the rule set needed by the
    /// demo: keeping track of remaining reds, awarding points for pots and
    /// fouls and determining when the frame has ended.
    /// </summary>
    public class SnookerGameState
    {
        private readonly Dictionary<string, int> _ballValues = new()
        {
            {"red", 1},
            {"yellow", 2},
            {"green", 3},
            {"brown", 4},
            {"blue", 5},
            {"pink", 6},
            {"black", 7}
        };

        private readonly string[] _colourOrder =
            {"yellow", "green", "brown", "blue", "pink", "black"};

        private int _redsRemaining;
        private bool _expectingColour;
        private int _colourIndex;

        /// <summary>Scores for the two players.</summary>
        public int[] Scores { get; } = new int[2];

        /// <summary>Index of the active player: 0 or 1.</summary>
        public int CurrentPlayer { get; private set; }

        /// <summary>True once all balls have been correctly potted.</summary>
        public bool GameOver => _redsRemaining == 0 && _colourIndex >= _colourOrder.Length;

        /// <summary>Reset the match to its initial state.</summary>
        /// <param name="reds">Number of reds to begin with, normally 15.</param>
        public void ResetGame(int reds = 15)
        {
            Scores[0] = Scores[1] = 0;
            CurrentPlayer = 0;
            _redsRemaining = reds;
            _expectingColour = false;
            _colourIndex = 0;
        }

        /// <summary>
        /// Record that a ball was potted. If the wrong ball is potted a foul is
        /// automatically awarded to the opponent. The active player only
        /// continues their break on a successful legal pot.
        /// </summary>
        public void PotBall(string colour)
        {
            if (GameOver) return;

            colour = colour.ToLowerInvariant();

            if (_expectingColour)
            {
                HandlePotColour(colour);
            }
            else
            {
                HandlePotRedOrSequence(colour);
            }
        }

        private void HandlePotRedOrSequence(string colour)
        {
            if (_redsRemaining > 0)
            {
                if (colour == "red")
                {
                    Scores[CurrentPlayer] += 1;
                    _redsRemaining--;
                    _expectingColour = true;
                }
                else
                {
                    Foul(ValueOf(colour));
                    SwitchPlayer();
                }
            }
            else
            {
                // Colours must be cleared in order once no reds remain
                if (colour == _colourOrder[_colourIndex])
                {
                    Scores[CurrentPlayer] += ValueOf(colour);
                    _colourIndex++;
                }
                else
                {
                    Foul(ValueOf(colour));
                    SwitchPlayer();
                }
            }
        }

        private void HandlePotColour(string colour)
        {
            if (colour == "red")
            {
                Foul(1);
                SwitchPlayer();
                return;
            }

            if (!_ballValues.ContainsKey(colour))
            {
                Foul(0);
                SwitchPlayer();
                return;
            }

            // During the red phase colours are re-spotted, afterwards they are
            // taken from the table in a set order.
            int value = ValueOf(colour);
            Scores[CurrentPlayer] += value;

            if (_redsRemaining > 0)
            {
                _expectingColour = false;
            }
            else
            {
                if (colour == _colourOrder[_colourIndex])
                {
                    _colourIndex++;
                    _expectingColour = false;
                }
                else
                {
                    Foul(value);
                    SwitchPlayer();
                }
            }
        }

        /// <summary>
        /// Called when the current player fails to pot a ball but does not
        /// commit a foul.
        /// </summary>
        public void EndTurn()
        {
            if (!GameOver)
            {
                SwitchPlayer();
                _expectingColour = false;
            }
        }

        /// <summary>Award a foul. The opponent receives at least four points.</summary>
        public void Foul(int value)
        {
            int points = Math.Max(4, value);
            Scores[1 - CurrentPlayer] += points;
        }

        private void SwitchPlayer()
        {
            CurrentPlayer = 1 - CurrentPlayer;
        }

        private int ValueOf(string colour)
        {
            return _ballValues.TryGetValue(colour, out int v) ? v : 0;
        }
    }
}
