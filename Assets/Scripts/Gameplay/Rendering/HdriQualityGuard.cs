using UnityEngine;

namespace Aiming.Gameplay.Rendering
{
    /// <summary>
    /// Applies HDRI resolution profiles based on the selected refresh rate and device type.
    /// </summary>
    public class HdriQualityGuard : MonoBehaviour
    {
        [SerializeField] private bool lockLegacyHdriProfile = true;
        [SerializeField] private int refreshRate60Hz = 60;
        [SerializeField] private int refreshRate90Hz = 90;
        [SerializeField] private int refreshRate120Hz = 120;

        [Header("Desktop HDRI Maps")]
        [SerializeField] private Cubemap desktopHdri2K;
        [SerializeField] private Cubemap desktopHdri4K;
        [SerializeField] private Cubemap desktopHdri8K;

        [Header("Mobile HDRI Maps")]
        [SerializeField] private Cubemap mobileHdri2K;
        [SerializeField] private Cubemap mobileHdri4K;

        [SerializeField] private Material[] skyboxTargets;

        public void ApplyHdriProfile(int targetRefreshRate)
        {
            if (!lockLegacyHdriProfile)
            {
                return;
            }

            bool isMobileDevice = SystemInfo.deviceType == DeviceType.Handheld;
            HdriProfile profile = ResolveProfile(targetRefreshRate, isMobileDevice);
            ApplyTextureQuality(profile.primaryResolution, profile.fallbackResolution);

            for (int i = 0; i < skyboxTargets.Length; i++)
            {
                Material target = skyboxTargets[i];
                if (target == null || !target.HasProperty("_Tex"))
                {
                    continue;
                }

                Cubemap selectedHdri = profile.primaryHdri != null ? profile.primaryHdri : profile.fallbackHdri;
                if (selectedHdri != null)
                {
                    target.SetTexture("_Tex", selectedHdri);
                }

                target.SetInt("_HdriResolution", profile.primaryResolution);
                target.SetInt("_HdriFallbackResolution", profile.fallbackResolution);
            }
        }

        private HdriProfile ResolveProfile(int targetRefreshRate, bool isMobileDevice)
        {
            if (targetRefreshRate >= refreshRate120Hz)
            {
                if (isMobileDevice)
                {
                    return new HdriProfile(mobileHdri4K, mobileHdri2K, 4096, 2048);
                }

                return new HdriProfile(desktopHdri8K, desktopHdri4K, 8192, 4096);
            }

            if (targetRefreshRate >= refreshRate90Hz)
            {
                Cubemap primaryHdri = isMobileDevice ? mobileHdri4K : desktopHdri4K;
                Cubemap fallbackHdri = isMobileDevice ? mobileHdri2K : desktopHdri2K;
                return new HdriProfile(primaryHdri, fallbackHdri, 4096, 2048);
            }

            Cubemap lowRefreshPrimary = isMobileDevice ? mobileHdri2K : desktopHdri2K;
            return new HdriProfile(lowRefreshPrimary, null, 2048, 1024);
        }

        private static void ApplyTextureQuality(int primaryResolution, int fallbackResolution)
        {
            int maxResolution = Mathf.Max(primaryResolution, fallbackResolution);
            if (maxResolution >= 8192)
            {
                QualitySettings.globalTextureMipmapLimit = 0;
                QualitySettings.masterTextureLimit = 0;
                return;
            }

            if (maxResolution >= 4096)
            {
                QualitySettings.globalTextureMipmapLimit = 1;
                QualitySettings.masterTextureLimit = 1;
                return;
            }

            QualitySettings.globalTextureMipmapLimit = 2;
            QualitySettings.masterTextureLimit = 2;
        }

        private readonly struct HdriProfile
        {
            public readonly Cubemap primaryHdri;
            public readonly Cubemap fallbackHdri;
            public readonly int primaryResolution;
            public readonly int fallbackResolution;

            public HdriProfile(Cubemap primaryHdri, Cubemap fallbackHdri, int primaryResolution, int fallbackResolution)
            {
                this.primaryHdri = primaryHdri;
                this.fallbackHdri = fallbackHdri;
                this.primaryResolution = primaryResolution;
                this.fallbackResolution = fallbackResolution;
            }
        }
    }
}
