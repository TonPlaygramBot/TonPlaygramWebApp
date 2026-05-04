using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Collects pinfall rolls and computes cumulative score with BowlingRulesEngine.
    /// </summary>
    public class BowlingScoreboardSystem : MonoBehaviour
    {
        [System.Serializable]
        public class ScoreChangedEvent : UnityEvent<int> { }

        [SerializeField] private int maxFrames = 10;

        public ScoreChangedEvent onScoreChanged;

        private readonly List<int> _rolls = new List<int>(24);

        public IReadOnlyList<int> Rolls => _rolls;

        public void AddRoll(int knockedPins)
        {
            if (_rolls.Count >= 21)
            {
                return;
            }

            _rolls.Add(Mathf.Clamp(knockedPins, 0, 10));
            onScoreChanged?.Invoke(GetTotalScore());
        }

        public void ResetMatch()
        {
            _rolls.Clear();
            onScoreChanged?.Invoke(0);
        }

        public int GetTotalScore()
        {
            BowlingFrameScore[] frames = BowlingRulesEngine.BuildFrames(_rolls.ToArray());
            int running = 0;
            int frameCount = Mathf.Min(maxFrames, frames.Length);
            for (int i = 0; i < frameCount; i++)
            {
                running += frames[i].total;
            }

            return running;
        }
    }
}
