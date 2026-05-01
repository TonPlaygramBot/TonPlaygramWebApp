using UnityEngine;

namespace Aiming.Gameplay.Environment
{
    /// <summary>
    /// Portrait-oriented readability and interaction layout tuning for Murlan Royal.
    /// - Hides extra human-held card visuals at the top side.
    /// - Moves human characters closer/lower toward the table.
    /// - Aligns both hands forward toward the real table cards.
    /// - Tightens only the bottom edge of each player's card fan for one-hand pickup.
    /// </summary>
    public class MurlanRoyalTableSeatingLayout : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform tableCenter;
        [SerializeField] private Transform[] humanCharacters;

        [Header("Remove Extra Top Human Cards")]
        [Tooltip("Only assign the duplicate top human-held card visuals that must be hidden.")]
        [SerializeField] private GameObject[] topHumanDuplicateCards;

        [Header("Character Position (Portrait View)")]
        [Tooltip("Moves humans inward toward table center (screen-wise closer to table).")]
        [SerializeField, Min(0f)] private float humanInwardOffset = 0.35f;
        [Tooltip("Lowers humans vertically so they sit visually closer to table edge.")]
        [SerializeField, Min(0f)] private float humanDownOffset = 0.12f;

        [Header("Hand Placement")]
        [SerializeField] private Transform[] leftHands;
        [SerializeField] private Transform[] rightHands;
        [SerializeField] private Transform[] leftHandTargets;
        [SerializeField] private Transform[] rightHandTargets;
        [Tooltip("Rotate hands to match target rotation for forward reach pose.")]
        [SerializeField] private bool applyHandRotation = true;

        [Header("Card Fan Bottom Tightening")]
        [Tooltip("Each entry is one player's ordered card fan root-to-tip.")]
        [SerializeField] private CardFanLayout[] playerCardFans;
        [SerializeField] private bool runOnAwake = true;

        [System.Serializable]
        private struct CardFanLayout
        {
            public string playerName;
            public Transform[] cards;
            [Tooltip("How much to pull the bottom side inward toward the fan pivot.")]
            [Min(0f)] public float bottomTighten;
        }

        private void Awake()
        {
            if (runOnAwake)
            {
                ApplyLayout();
            }
        }

        [ContextMenu("Apply Murlan Royal Seating Layout")]
        public void ApplyLayout()
        {
            HideTopHumanDuplicateCards();

            Vector3 center = tableCenter != null ? tableCenter.position : transform.position;
            PullHumansInwardAndDown(center);
            AlignHandsToTargets();
            TightenCardFansBottomEdges();
        }

        private void HideTopHumanDuplicateCards()
        {
            if (topHumanDuplicateCards == null)
            {
                return;
            }

            for (int i = 0; i < topHumanDuplicateCards.Length; i++)
            {
                GameObject duplicateCard = topHumanDuplicateCards[i];
                if (duplicateCard != null)
                {
                    duplicateCard.SetActive(false);
                }
            }
        }

        private void PullHumansInwardAndDown(Vector3 center)
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

                Vector3 horizontalDirection = center - human.position;
                horizontalDirection.y = 0f;

                if (horizontalDirection.sqrMagnitude > 0.0001f)
                {
                    human.position += horizontalDirection.normalized * humanInwardOffset;
                }

                human.position += Vector3.down * humanDownOffset;
            }
        }

        private void AlignHandsToTargets()
        {
            AlignHandSet(leftHands, leftHandTargets);
            AlignHandSet(rightHands, rightHandTargets);
        }

        private void AlignHandSet(Transform[] hands, Transform[] targets)
        {
            if (hands == null || targets == null)
            {
                return;
            }

            int count = Mathf.Min(hands.Length, targets.Length);
            for (int i = 0; i < count; i++)
            {
                Transform hand = hands[i];
                Transform target = targets[i];
                if (hand == null || target == null)
                {
                    continue;
                }

                hand.position = target.position;
                if (applyHandRotation)
                {
                    hand.rotation = target.rotation;
                }
            }
        }

        private void TightenCardFansBottomEdges()
        {
            if (playerCardFans == null)
            {
                return;
            }

            for (int i = 0; i < playerCardFans.Length; i++)
            {
                CardFanLayout fan = playerCardFans[i];
                Transform[] cards = fan.cards;
                if (cards == null || cards.Length < 2)
                {
                    continue;
                }

                Vector3 pivot = cards[0] != null ? cards[0].position : Vector3.zero;
                for (int c = 1; c < cards.Length; c++)
                {
                    Transform card = cards[c];
                    if (card == null)
                    {
                        continue;
                    }

                    Vector3 toPivot = pivot - card.position;
                    Vector3 planar = new Vector3(toPivot.x, 0f, toPivot.z);
                    if (planar.sqrMagnitude <= 0.0001f)
                    {
                        continue;
                    }

                    card.position += planar.normalized * fan.bottomTighten;
                }
            }
        }
    }
}
