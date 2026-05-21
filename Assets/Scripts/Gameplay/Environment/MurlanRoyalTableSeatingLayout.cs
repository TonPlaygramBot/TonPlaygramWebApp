using UnityEngine;

namespace Aiming.Gameplay.Environment
{
    /// <summary>
    /// Pushes human characters farther from the table and slightly enlarges chairs.
    /// Useful for portrait-camera readability tuning in Murlan Royal scenes.
    /// </summary>
    public class MurlanRoyalTableSeatingLayout : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform tableCenter;
        [SerializeField] private Transform[] humanCharacters;
        [SerializeField] private Transform[] chairs;

        [Header("Layout Tuning")]
        [SerializeField, Min(0f)] private float humanOutwardOffset = 0.35f;
        [SerializeField, Min(0.1f)] private float chairScaleMultiplier = 1.08f;
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
            PushHumansOutward(center);
            FixHumanFacing(center);
            ScaleChairs();
        }

        private void PushHumansOutward(Vector3 center)
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

                Vector3 horizontalDirection = human.position - center;
                horizontalDirection.y = 0f;

                if (horizontalDirection.sqrMagnitude <= 0.0001f)
                {
                    continue;
                }

                human.position += horizontalDirection.normalized * humanOutwardOffset;
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
