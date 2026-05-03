using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Tunes lane visuals to match the mobile camera framing and HDRI ground.
    /// </summary>
    public class BowlingLaneVisualTuner : MonoBehaviour
    {
        [Header("Hide unwanted side geometry / lights")]
        [SerializeField] private Renderer[] sideRenderersToHide;
        [SerializeField] private Light[] lightsToDisable;

        [Header("Lane height")]
        [SerializeField] private Transform laneRoot;
        [SerializeField] private Transform hdriGroundReference;
        [SerializeField] private float laneGroundOffset = 0f;

        [Header("HDRI texture quality")]
        [SerializeField] private Texture hdriTexture;
        [SerializeField] private int targetHdriSize = 4096;
        [SerializeField] private int anisotropicLevel = 8;

        [ContextMenu("Apply Lane Visual Tune")]
        public void Apply()
        {
            HideMarkedSidesAndLights();
            AlignLaneToHdriGround();
            ApplyHdriResolutionQuality();
        }

        private void HideMarkedSidesAndLights()
        {
            for (int i = 0; i < sideRenderersToHide.Length; i++)
            {
                if (sideRenderersToHide[i] != null)
                {
                    sideRenderersToHide[i].enabled = false;
                }
            }

            for (int i = 0; i < lightsToDisable.Length; i++)
            {
                if (lightsToDisable[i] != null)
                {
                    lightsToDisable[i].enabled = false;
                }
            }
        }

        private void AlignLaneToHdriGround()
        {
            if (laneRoot == null || hdriGroundReference == null)
            {
                return;
            }

            Vector3 lanePosition = laneRoot.position;
            lanePosition.y = hdriGroundReference.position.y + laneGroundOffset;
            laneRoot.position = lanePosition;
        }

        private void ApplyHdriResolutionQuality()
        {
            if (hdriTexture == null)
            {
                return;
            }

            hdriTexture.anisoLevel = Mathf.Clamp(anisotropicLevel, 1, 16);
            hdriTexture.mipMapBias = -0.5f;
            QualitySettings.masterTextureLimit = targetHdriSize >= 4096 ? 0 : 1;
            QualitySettings.globalTextureMipmapLimit = targetHdriSize >= 4096 ? 0 : 1;
        }
    }
}
