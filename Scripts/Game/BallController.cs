using UnityEngine;
using TonPlaygram.Snooker.Util;

namespace TonPlaygram.Snooker.Game
{
    public sealed class BallController : MonoBehaviour
    {
        [SerializeField]
        private BallType ballType;

        [SerializeField]
        private Transform preferredSpot;

        private Vector3 _initialPosition;

        public BallType BallType => ballType;

        private void Awake()
        {
            _initialPosition = preferredSpot != null ? preferredSpot.position : transform.position;
        }

        public void HandlePotted()
        {
            EventBus.RaiseBallPotted(ballType);
        }

        public void ReSpot()
        {
            if (preferredSpot == null)
            {
                Debug.LogWarning($"No preferred spot defined for {ballType}. Using initial position.");
                transform.position = _initialPosition;
                return;
            }

            transform.position = preferredSpot.position;
        }
    }
}
