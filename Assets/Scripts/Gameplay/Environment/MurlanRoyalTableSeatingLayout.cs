using UnityEngine;

namespace Aiming.Gameplay.Environment
{
    /// <summary>
    /// Keeps the visible seats in sync with the players in a Murlan Royal match.
    /// In a 1v1 match only the local (bottom) and opponent (top) seats are shown.
    /// </summary>
    public class MurlanRoyalTableSeatingLayout : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform tableCenter;
        [SerializeField] private Transform[] humanCharacters;
        [SerializeField] private Transform[] chairs;

        [Header("Match Seats")]
        [SerializeField, Range(2, 4)] private int activePlayerCount = 2;
        [Tooltip("Seat transforms in portrait-screen order: bottom, top, left, right.")]
        [SerializeField] private Transform[] seatAnchors;

        [Header("Layout Tuning")]
        [SerializeField, Min(0f)] private float humanOutwardOffset = 0.35f;
        [SerializeField, Min(0.1f)] private float chairScaleMultiplier = 1.08f;
        [SerializeField] private bool fixHumanFacingDirection = true;
        [SerializeField] private bool humansShouldFaceTableCenter = true;
        [SerializeField] private Vector3 humanFacingEulerOffset = new Vector3(0f, 180f, 0f);
        [SerializeField] private bool runOnAwake = true;
        private bool chairsScaled;

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
            ApplyActiveSeats();
            PushHumansOutward(center);
            FixHumanFacing(center);
            ScaleChairs();
        }

        /// <summary>Called by the online match bootstrap after receiving the roster.</summary>
        public void ConfigureForPlayers(int playerCount)
        {
            activePlayerCount = Mathf.Clamp(playerCount, 2, 4);
            ApplyLayout();
        }

        private void ApplyActiveSeats()
        {
            int available = humanCharacters == null ? 0 : humanCharacters.Length;
            int visibleCount = Mathf.Min(activePlayerCount, available);
            for (int i = 0; i < available; i++)
            {
                Transform human = humanCharacters[i];
                bool active = i < visibleCount;
                if (human != null)
                {
                    human.gameObject.SetActive(active);
                    if (active && seatAnchors != null && i < seatAnchors.Length && seatAnchors[i] != null)
                    {
                        human.SetPositionAndRotation(seatAnchors[i].position, seatAnchors[i].rotation);
                    }
                }

                if (chairs != null && i < chairs.Length && chairs[i] != null)
                {
                    chairs[i].gameObject.SetActive(active);
                }
            }
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

                if (!human.gameObject.activeSelf) continue;

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

                if (!human.gameObject.activeSelf) continue;

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
            if (chairs == null || chairsScaled)
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
            chairsScaled = true;
        }
    }
}
