using UnityEngine;

namespace Aiming.Gameplay.Environment
{
    /// <summary>
    /// Pulls chairs closer/smaller and makes human characters bigger for portrait readability.
    /// Useful for portrait-camera readability tuning in Murlan Royal scenes.
    /// </summary>
    public class MurlanRoyalTableSeatingLayout : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform tableCenter;
        [SerializeField] private Transform[] humanCharacters;
        [SerializeField] private Transform[] chairs;

        [Header("Layout Tuning")]
        [SerializeField, Min(0.1f)] private float humanScaleMultiplier = 1.15f;
        [SerializeField, Min(0f)] private float chairInwardOffset = 0.2f;
        [SerializeField, Min(0.01f)] private float chairScaleMultiplier = 0.88f;
        [SerializeField] private bool fixHumanFacingDirection = true;
        [SerializeField] private bool humansShouldFaceTableCenter = true;
        [SerializeField] private Vector3 humanFacingEulerOffset = new Vector3(0f, 180f, 0f);
        [SerializeField] private bool runOnAwake = true;

        void Awake()
        {
            if (runOnAwake)
            {
                ApplyLayout();
            }
        }

        [ContextMenu("Apply Murlan Royal Seating Layout")]
        public void ApplyLayout()
        {
            Vector3 center = tableCenter != null ? tableCenter.position : transform.position;
            ScaleHumans();
            FixHumanFacing(center);
            PullChairsInward(center);
            ScaleChairs();
        }

        private void ScaleHumans()
        {
            if (humanCharacters == null)
            {
                return;
            }

            for (int i = 0; i < humanCharacters.Length; i++)
            {
                Transform human = humanCharacters[i];
                if (human == null)
                {
                    continue;
                }

                human.localScale *= humanScaleMultiplier;
            }
        }

        private void PullChairsInward(Vector3 center)
        {
            if (chairs == null)
            {
                return;
            }

            for (int i = 0; i < chairs.Length; i++)
            {
                Transform chair = chairs[i];
                if (chair == null)
                {
                    continue;
                }

                Vector3 horizontalDirection = center - chair.position;
                horizontalDirection.y = 0f;

                if (horizontalDirection.sqrMagnitude <= 0.0001f)
                {
                    continue;
                }

                chair.position += horizontalDirection.normalized * chairInwardOffset;
            }
        }

        private void FixHumanFacing(Vector3 center)
        {
            if (!fixHumanFacingDirection || humanCharacters == null)
            {
                return;
            }

            for (int i = 0; i < humanCharacters.Length; i++)
            {
                Transform human = humanCharacters[i];
                if (human == null)
                {
                    continue;
                }

                Vector3 lookDirection = humansShouldFaceTableCenter ? (center - human.position) : (human.position - center);
                lookDirection.y = 0f;
                if (lookDirection.sqrMagnitude <= 0.0001f)
                {
                    continue;
                }

                human.rotation = Quaternion.LookRotation(lookDirection.normalized, Vector3.up) * Quaternion.Euler(humanFacingEulerOffset);
            }
        }

        private void ScaleChairs()
        {
            if (chairs == null)
            {
                return;
            }

            for (int i = 0; i < chairs.Length; i++)
            {
                Transform chair = chairs[i];
                if (chair == null)
                {
                    continue;
                }

                chair.localScale *= chairScaleMultiplier;
            }
        }
    }
}
