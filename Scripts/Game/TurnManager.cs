using UnityEngine;

namespace TonPlay.Snooker.Game
{
    /// <summary>
    /// Handles active player tracking and turn transitions for a frame.
    /// </summary>
    public class TurnManager : MonoBehaviour
    {
        [SerializeField]
        private int startingPlayerIndex;

        private int currentPlayerIndex;

        public int CurrentPlayerIndex => currentPlayerIndex;

        public void Initialize()
        {
            currentPlayerIndex = Mathf.Clamp(startingPlayerIndex, 0, 1);
        }

        public void SwitchTurn()
        {
            currentPlayerIndex = 1 - currentPlayerIndex;
            Debug.Log($"TurnManager: Switching turn. Current player {currentPlayerIndex}");
        }

        public void ForceTurn(int playerIndex)
        {
            if (playerIndex < 0 || playerIndex > 1)
            {
                Debug.LogError($"TurnManager: Invalid player index {playerIndex}");
                return;
            }

            currentPlayerIndex = playerIndex;
        }

        public void ResetForNewFrame()
        {
            Initialize();
        }
    }
}
