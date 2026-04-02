using UnityEngine;

namespace Aiming.Gameplay.Rendering
{
    /// <summary>
    /// Locks HDRI loading to high quality when 120hz is enabled so 8k environments
    /// keep loading consistently.
    /// </summary>
    public class HdriQualityGuard : MonoBehaviour
    {
        [SerializeField] private bool lockLegacyHdriProfile = true;
        [SerializeField] private int highRefreshRate = 120;
        [SerializeField] private int hdriResolution = 8192;
        [SerializeField] private Cubemap activeHdri;
        [SerializeField] private Material[] skyboxTargets;

        public void ApplyHdriProfile(int targetRefreshRate)
        {
            if (!lockLegacyHdriProfile)
            {
                return;
            }

            bool shouldForce8k = targetRefreshRate >= highRefreshRate;
            QualitySettings.globalTextureMipmapLimit = shouldForce8k ? 0 : 1;
            QualitySettings.masterTextureLimit = shouldForce8k ? 0 : 1;

            if (activeHdri == null || !shouldForce8k)
            {
                return;
            }

            for (int i = 0; i < skyboxTargets.Length; i++)
            {
                Material target = skyboxTargets[i];
                if (target == null || !target.HasProperty("_Tex"))
                {
                    continue;
                }

                target.SetTexture("_Tex", activeHdri);
                target.SetInt("_HdriResolution", hdriResolution);
            }
        }
    }
}
