using UnityEngine;
using UnityEngine.AI;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Moves the human avatar to a chair after a throw and returns to throw position when turn starts.
    /// </summary>
    public class BowlingSeatingController : MonoBehaviour
    {
        [SerializeField] private NavMeshAgent humanAgent;
        [SerializeField] private Animator humanAnimator;
        [SerializeField] private Transform throwStandPoint;
        [SerializeField] private Transform chairSitPoint;
        [SerializeField] private float arriveDistance = 0.2f;
        [SerializeField] private string sitBoolParam = "IsSitting";

        private bool _seated;

        public void OnShotFinished()
        {
            if (humanAgent == null || chairSitPoint == null)
            {
                return;
            }

            SetSitAnimation(false);
            humanAgent.isStopped = false;
            humanAgent.SetDestination(chairSitPoint.position);
            _seated = false;
        }

        public void OnNextTurnReady()
        {
            if (humanAgent == null || throwStandPoint == null)
            {
                return;
            }

            SetSitAnimation(false);
            humanAgent.isStopped = false;
            humanAgent.SetDestination(throwStandPoint.position);
            _seated = false;
        }

        private void Update()
        {
            if (humanAgent == null || _seated)
            {
                return;
            }

            if (!humanAgent.pathPending && humanAgent.remainingDistance <= arriveDistance)
            {
                humanAgent.isStopped = true;

                if (chairSitPoint != null && Vector3.Distance(transform.position, chairSitPoint.position) <= arriveDistance + 0.05f)
                {
                    transform.position = chairSitPoint.position;
                    transform.rotation = chairSitPoint.rotation;
                    SetSitAnimation(true);
                    _seated = true;
                }
            }
        }

        private void SetSitAnimation(bool sit)
        {
            if (humanAnimator != null && !string.IsNullOrWhiteSpace(sitBoolParam))
            {
                humanAnimator.SetBool(sitBoolParam, sit);
            }
        }
    }
}
