using UnityEngine;

namespace TonPlaygram.Settings
{
    /// <summary>
    /// Scene-side adapter for the Texas Hold'em settings menu.
    ///
    /// Purpose:
    /// - Disable legacy graphics/HDRI option groups.
    /// - Ensure only the new 4-option graphics preset UI is visible.
    ///
    /// Attach this to your Texas Hold'em menu root and assign references in Inspector.
    /// This keeps migration from older menu layouts safe and explicit.
    /// </summary>
    public sealed class TexasHoldemGraphicsMenuInstaller : MonoBehaviour
    {
        [Header("Legacy groups to remove from menu")]
        [SerializeField] private GameObject[] legacyGraphicsOptionRoots;
        [SerializeField] private GameObject[] legacyHdriOptionRoots;

        [Header("New graphics preset panel (Auto/Low/Medium/High)")]
        [SerializeField] private GameObject newGraphicsPresetPanel;

        private void Awake()
        {
            DisableLegacyGroups(legacyGraphicsOptionRoots);
            DisableLegacyGroups(legacyHdriOptionRoots);

            if (newGraphicsPresetPanel != null)
            {
                newGraphicsPresetPanel.SetActive(true);
            }
            else
            {
                Debug.LogWarning("[TexasHoldemGraphicsMenuInstaller] New graphics preset panel is not assigned.");
            }
        }

        private static void DisableLegacyGroups(GameObject[] roots)
        {
            if (roots == null)
            {
                return;
            }

            for (var i = 0; i < roots.Length; i++)
            {
                var root = roots[i];
                if (root != null)
                {
                    root.SetActive(false);
                }
            }
        }
    }
}
