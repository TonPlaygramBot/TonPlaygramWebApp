using System.Collections.Generic;
using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Returns played balls through an under-lane path and keeps remaining balls in storage slots.
    /// </summary>
    public class BowlingBallReturnSystem : MonoBehaviour
    {
        [SerializeField] private Rigidbody[] bowlingBalls;
        [SerializeField] private Transform[] returnWaypoints;
        [SerializeField] private Transform[] ballStorageSlots;
        [SerializeField] private Transform playerPickupPoint;
        [SerializeField] private float moveSpeed = 4.5f;
        [SerializeField] private float snapDistance = 0.08f;

        private readonly Queue<Rigidbody> queue = new Queue<Rigidbody>();
        private int waypointIndex;
        private bool returning;
        private Rigidbody activeBall;

        private void Awake()
        {
            if (bowlingBalls == null)
            {
                return;
            }

            for (int i = 0; i < bowlingBalls.Length; i++)
            {
                if (bowlingBalls[i] != null)
                {
                    queue.Enqueue(bowlingBalls[i]);
                }
            }

            SnapQueuedBallsToStorage();
        }

        public void StartReturn()
        {
            if (returning || returnWaypoints == null || returnWaypoints.Length == 0 || queue.Count == 0)
            {
                return;
            }

            activeBall = queue.Dequeue();
            if (activeBall == null)
            {
                return;
            }

            returning = true;
            waypointIndex = 0;
            activeBall.isKinematic = true;
        }

        private void Update()
        {
            if (!returning || activeBall == null)
            {
                return;
            }

            Transform target = returnWaypoints[waypointIndex];
            Vector3 next = Vector3.MoveTowards(activeBall.position, target.position, moveSpeed * Time.deltaTime);
            activeBall.MovePosition(next);

            if (Vector3.Distance(next, target.position) > snapDistance)
            {
                return;
            }

            waypointIndex++;
            if (waypointIndex < returnWaypoints.Length)
            {
                return;
            }

            returning = false;
            activeBall.isKinematic = false;

            if (playerPickupPoint != null)
            {
                activeBall.position = playerPickupPoint.position;
            }

            queue.Enqueue(activeBall);
            activeBall = null;
            SnapQueuedBallsToStorage();
        }

        private void SnapQueuedBallsToStorage()
        {
            if (ballStorageSlots == null || ballStorageSlots.Length == 0)
            {
                return;
            }

            int slot = 0;
            foreach (Rigidbody rb in queue)
            {
                if (rb == null || slot >= ballStorageSlots.Length)
                {
                    continue;
                }

                Transform storage = ballStorageSlots[slot];
                if (storage != null)
                {
                    rb.position = storage.position;
                    rb.rotation = storage.rotation;
                }

                slot++;
            }
        }
    }
}
