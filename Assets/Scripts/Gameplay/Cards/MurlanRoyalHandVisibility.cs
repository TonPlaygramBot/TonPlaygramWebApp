using UnityEngine;

namespace Aiming.Gameplay.Cards
{
    /// <summary>
    /// Prevents network seat order from deciding whether a hand is face-up. Each client
    /// sees its own cards' fronts; every opponent hand remains face-down.
    /// </summary>
    public class MurlanRoyalHandVisibility : MonoBehaviour
    {
        [SerializeField] private string ownerUserId;
        [SerializeField] private GameObject cardFronts;
        [SerializeField] private GameObject cardBacks;

        public void SetOwner(string userId)
        {
            ownerUserId = userId;
        }

        public void ApplyForLocalPlayer(string localUserId)
        {
            bool isLocalHand = !string.IsNullOrEmpty(localUserId) && ownerUserId == localUserId;
            if (cardFronts != null) cardFronts.SetActive(isLocalHand);
            if (cardBacks != null) cardBacks.SetActive(!isLocalHand);
        }

        public void Bind(string ownerId, string localUserId)
        {
            SetOwner(ownerId);
            ApplyForLocalPlayer(localUserId);
        }
    }
}
