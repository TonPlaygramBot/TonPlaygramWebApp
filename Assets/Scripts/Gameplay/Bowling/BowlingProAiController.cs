using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Lightweight pro-style AI: targets pocket based on remaining pins and applies controlled hook.
    /// </summary>
    public class BowlingProAiController : MonoBehaviour
    {
        [SerializeField] private Rigidbody aiBall;
        [SerializeField] private Transform foulLineTarget;
        [SerializeField] private Transform pocketTarget;
        [SerializeField] private float launchForce = 18f;
        [SerializeField] private float hookTorque = 2.4f;

        public void PlayProShot(float laneOilFactor, float pressureFactor)
        {
            if (aiBall == null || foulLineTarget == null || pocketTarget == null)
            {
                return;
            }

            aiBall.linearVelocity = Vector3.zero;
            aiBall.angularVelocity = Vector3.zero;

            Vector3 aimPoint = Vector3.Lerp(foulLineTarget.position, pocketTarget.position, 0.72f + pressureFactor * 0.1f);
            Vector3 direction = (aimPoint - aiBall.position).normalized;

            float adjustedForce = launchForce * Mathf.Lerp(1.05f, 0.92f, laneOilFactor);
            float adjustedHook = hookTorque * Mathf.Lerp(0.85f, 1.2f, laneOilFactor);

            aiBall.AddForce(direction * adjustedForce, ForceMode.Impulse);
            aiBall.AddTorque(Vector3.up * adjustedHook, ForceMode.Impulse);
        }
    }
}
