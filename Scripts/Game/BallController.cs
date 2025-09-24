using TonPlay.Snooker.Util;
using UnityEngine;

namespace TonPlay.Snooker.Game
{
    /// <summary>
    /// Lightweight wrapper for individual snooker balls allowing the rules engine
    /// to be driven without physics dependencies.
    /// </summary>
    public class BallController : MonoBehaviour
    {
        [SerializeField]
        private BallType ballType;

        [SerializeField]
        private Transform? spotTransform;

        private Vector3 initialPosition;

        public BallType BallType => ballType;

        public bool IsOnTable { get; private set; } = true;

        private void Awake()
        {
            initialPosition = transform.position;
        }

        public void HandlePotted()
        {
            if (!IsOnTable)
            {
                return;
            }

            IsOnTable = false;
            EventBus.RaiseBallPotted(ballType);
        }

        public void Respot()
        {
            var targetPosition = spotTransform != null ? spotTransform.position : initialPosition;
            transform.position = targetPosition;
            IsOnTable = true;
        }

        public void RemoveFromTable()
        {
            IsOnTable = false;
        }

        public void ResetBall()
        {
            transform.position = spotTransform != null ? spotTransform.position : initialPosition;
            IsOnTable = true;
        }
    }
}
