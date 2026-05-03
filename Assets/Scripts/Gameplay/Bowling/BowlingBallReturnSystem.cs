using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Sends the ball through a side return path to mimic a real bowling return channel.
    /// </summary>
    public class BowlingBallReturnSystem : MonoBehaviour
    {
        [SerializeField] private Rigidbody bowlingBall;
        [SerializeField] private Transform[] returnWaypoints;
        [SerializeField] private float moveSpeed = 4.5f;
        [SerializeField] private float snapDistance = 0.08f;

        private int waypointIndex;
        private bool returning;

        public void StartReturn()
        {
            if (bowlingBall == null || returnWaypoints == null || returnWaypoints.Length == 0)
            {
                return;
            }

            returning = true;
            waypointIndex = 0;
            bowlingBall.isKinematic = true;
        }

        private void Update()
        {
            if (!returning || bowlingBall == null)
            {
                return;
            }

            Transform target = returnWaypoints[waypointIndex];
            Vector3 next = Vector3.MoveTowards(bowlingBall.position, target.position, moveSpeed * Time.deltaTime);
            bowlingBall.MovePosition(next);

            if (Vector3.Distance(next, target.position) <= snapDistance)
            {
                waypointIndex++;
                if (waypointIndex >= returnWaypoints.Length)
                {
                    returning = false;
                    bowlingBall.isKinematic = false;
                }
            }
        }
    }
}
