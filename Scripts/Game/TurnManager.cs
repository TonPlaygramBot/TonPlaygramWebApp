using UnityEngine;

namespace TonPlaygram.Snooker.Game
{
    public sealed class TurnManager : MonoBehaviour
    {
        [SerializeField]
        private int startingPlayerId;

        public int CurrentPlayerId { get; private set; }

        private void Awake()
        {
            CurrentPlayerId = Mathf.Clamp(startingPlayerId, 0, 1);
        }

        public void Reset(int playerId)
        {
            CurrentPlayerId = Mathf.Clamp(playerId, 0, 1);
        }

        public void SwitchTurn()
        {
            CurrentPlayerId = GetOpponentId();
        }

        public int GetOpponentId()
        {
            return CurrentPlayerId == 0 ? 1 : 0;
        }
    }
}
