using System;
using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    [Serializable]
    public struct BowlingFrameScore
    {
        public int firstRoll;
        public int secondRoll;
        public int bonusRollA;
        public int bonusRollB;
        public bool isStrike;
        public bool isSpare;
        public int total;
    }

    /// <summary>
    /// Official 10-pin scoring with strike/spare bonuses.
    /// </summary>
    public static class BowlingRulesEngine
    {
        public static BowlingFrameScore[] BuildFrames(int[] rolls)
        {
            BowlingFrameScore[] frames = new BowlingFrameScore[10];
            int r = 0;

            for (int f = 0; f < 10; f++)
            {
                if (r >= rolls.Length)
                {
                    break;
                }

                if (rolls[r] == 10 && f < 9)
                {
                    frames[f].firstRoll = 10;
                    frames[f].isStrike = true;
                    frames[f].bonusRollA = SafeRoll(rolls, r + 1);
                    frames[f].bonusRollB = SafeRoll(rolls, r + 2);
                    frames[f].total = 10 + frames[f].bonusRollA + frames[f].bonusRollB;
                    r += 1;
                    continue;
                }

                frames[f].firstRoll = SafeRoll(rolls, r);
                frames[f].secondRoll = SafeRoll(rolls, r + 1);
                int framePins = frames[f].firstRoll + frames[f].secondRoll;
                frames[f].isSpare = framePins == 10;

                if (f < 9 && frames[f].isSpare)
                {
                    frames[f].bonusRollA = SafeRoll(rolls, r + 2);
                    frames[f].total = 10 + frames[f].bonusRollA;
                }
                else
                {
                    frames[f].total = framePins;
                }

                r += 2;
            }

            return frames;
        }

        private static int SafeRoll(int[] rolls, int index)
        {
            if (rolls == null || index < 0 || index >= rolls.Length)
            {
                return 0;
            }

            return Mathf.Clamp(rolls[index], 0, 10);
        }
    }
}
