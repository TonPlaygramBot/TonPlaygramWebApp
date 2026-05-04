using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Orchestrates post-shot flow: score fallen pins, return ball, and reset pin deck.
    /// Wire this from your shot-end trigger/callback.
    /// </summary>
    public class BowlingGameFlowController : MonoBehaviour
    {
        [SerializeField] private BowlingPinDeckSystem pinDeckSystem;
        [SerializeField] private BowlingScoreboardSystem scoreboardSystem;
        [SerializeField] private BowlingBallReturnSystem ballReturnSystem;
        [SerializeField] private bool autoResetRackAfterReturn = true;

        private void OnEnable()
        {
            if (ballReturnSystem != null)
            {
                ballReturnSystem.onReturnCompleted.AddListener(OnBallReturnCompleted);
            }

            if (pinDeckSystem != null && scoreboardSystem != null)
            {
                pinDeckSystem.onPinsScored.AddListener(scoreboardSystem.AddRoll);
            }
        }

        private void OnDisable()
        {
            if (ballReturnSystem != null)
            {
                ballReturnSystem.onReturnCompleted.RemoveListener(OnBallReturnCompleted);
            }

            if (pinDeckSystem != null && scoreboardSystem != null)
            {
                pinDeckSystem.onPinsScored.RemoveListener(scoreboardSystem.AddRoll);
            }
        }

        public void CompleteShotCycle()
        {
            if (pinDeckSystem != null)
            {
                pinDeckSystem.SweepAndScoreFallenPins();
            }

            if (ballReturnSystem != null)
            {
                ballReturnSystem.StartReturn();
            }
        }

        private void OnBallReturnCompleted()
        {
            if (autoResetRackAfterReturn && pinDeckSystem != null && pinDeckSystem.CountStandingPins() == 0)
            {
                pinDeckSystem.ResetRack();
            }
        }
    }
}
