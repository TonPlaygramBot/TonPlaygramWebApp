using System.Collections;
using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Simulates a realistic 10-pin cycle: sweep down, clear deadwood, table lift/spot, and release.
    /// Driven by transforms so art can be replaced with higher fidelity GLTF meshes.
    /// </summary>
    public class BowlingPinDeckMechanism : MonoBehaviour
    {
        [Header("Mechanism Parts")]
        [SerializeField] private Transform sweepBar;
        [SerializeField] private Transform pinTable;
        [SerializeField] private Transform deadwoodCollector;

        [Header("Sweep Travel")]
        [SerializeField] private float sweepGuardY = 1.2f;
        [SerializeField] private float sweepDeckY = 0.35f;
        [SerializeField] private float sweepSpeed = 2.5f;

        [Header("Table Travel")]
        [SerializeField] private float tableUpY = 2.8f;
        [SerializeField] private float tableDetectY = 0.9f;
        [SerializeField] private float tableSpotY = 0.7f;
        [SerializeField] private float tableSpeed = 2f;

        [Header("Timing")]
        [SerializeField] private float deadwoodHoldSeconds = 0.4f;
        [SerializeField] private float settlePauseSeconds = 0.35f;

        private bool _isCycling;

        public bool IsCycling => _isCycling;

        public void StartCycle()
        {
            if (_isCycling)
            {
                return;
            }

            StartCoroutine(CycleRoutine());
        }

        private IEnumerator CycleRoutine()
        {
            _isCycling = true;

            yield return MoveLocalY(sweepBar, sweepDeckY, sweepSpeed);
            yield return MoveLocalY(pinTable, tableDetectY, tableSpeed);
            yield return new WaitForSeconds(settlePauseSeconds);

            if (deadwoodCollector != null)
            {
                deadwoodCollector.gameObject.SetActive(true);
            }

            yield return new WaitForSeconds(deadwoodHoldSeconds);
            yield return MoveLocalY(sweepBar, sweepGuardY, sweepSpeed);
            yield return MoveLocalY(pinTable, tableUpY, tableSpeed);
            yield return MoveLocalY(pinTable, tableSpotY, tableSpeed);
            yield return MoveLocalY(pinTable, tableUpY, tableSpeed);

            if (deadwoodCollector != null)
            {
                deadwoodCollector.gameObject.SetActive(false);
            }

            _isCycling = false;
        }

        private static IEnumerator MoveLocalY(Transform target, float toY, float speed)
        {
            if (target == null)
            {
                yield break;
            }

            Vector3 p = target.localPosition;
            while (Mathf.Abs(p.y - toY) > 0.005f)
            {
                p.y = Mathf.MoveTowards(p.y, toY, speed * Time.deltaTime);
                target.localPosition = p;
                yield return null;
            }
        }
    }
}
