using UnityEngine;

namespace Aiming.Gameplay.Cue
{
    /// <summary>
    /// Prevents cue overlap with balls/cushions/chalk and keeps helper visuals aligned.
    /// </summary>
    public class CueTableClearanceGuard : MonoBehaviour
    {
        [SerializeField] private Transform cueRoot;
        [SerializeField] private Transform[] protectedBalls;
        [SerializeField] private Transform[] ballHelpers;
        [SerializeField] private Renderer[] ballShadowRenderers;
        [SerializeField] private LayerMask blockerMask;
        [SerializeField, Min(0f)] private float cueRadius = 0.012f;
        [SerializeField, Min(0f)] private float ballLift = 0.0015f;
        [SerializeField, Min(0f)] private float helperClearance = 0.001f;
        [SerializeField, Min(0f)] private float shadowScaleMultiplier = 1f;

        [Header("Cloth material parity")]
        [SerializeField] private Renderer[] clothRenderers;
        [SerializeField] private Material texasHoldemClothMaterial;
        [Header("Cloth color tuning")]
        [SerializeField] private bool brightenClothColors = true;
        [SerializeField, Range(0f, 1f)] private float colorBlend = 0.45f;
        [SerializeField] private Color brighterGreen = new Color(0.16f, 0.56f, 0.26f, 1f);
        [SerializeField] private Color brighterBeige = new Color(0.82f, 0.75f, 0.62f, 1f);
        private readonly MaterialPropertyBlock clothPropertyBlock = new MaterialPropertyBlock();

        void LateUpdate()
        {
            KeepCueClear();
            LiftBallsAndHelpers();
            MatchShadowRadius();
            ApplyTexasHoldemCloth();
            TuneClothColor();
        }

        private void KeepCueClear()
        {
            if (cueRoot == null)
            {
                return;
            }

            Vector3 start = cueRoot.position;
            Vector3 end = cueRoot.position + cueRoot.forward * 1.4f;
            if (!Physics.CheckCapsule(start, end, cueRadius, blockerMask, QueryTriggerInteraction.Ignore))
            {
                return;
            }

            Vector3 retreat = cueRoot.forward * -0.01f;
            cueRoot.position += retreat;
        }

        private void LiftBallsAndHelpers()
        {
            for (int i = 0; i < protectedBalls.Length; i++)
            {
                Transform ball = protectedBalls[i];
                if (ball == null)
                {
                    continue;
                }

                Vector3 pos = ball.position;
                ball.position = new Vector3(pos.x, Mathf.Max(pos.y, ballLift), pos.z);
            }

            for (int i = 0; i < ballHelpers.Length; i++)
            {
                Transform helper = ballHelpers[i];
                if (helper == null)
                {
                    continue;
                }

                Vector3 helperPos = helper.position;
                helper.position = new Vector3(helperPos.x, helperPos.y + helperClearance, helperPos.z);
            }
        }

        private void MatchShadowRadius()
        {
            foreach (Renderer shadowRenderer in ballShadowRenderers)
            {
                if (shadowRenderer == null)
                {
                    continue;
                }

                Vector3 scale = shadowRenderer.transform.localScale;
                float radiusScale = Mathf.Max(scale.x, scale.z) * shadowScaleMultiplier;
                shadowRenderer.transform.localScale = new Vector3(radiusScale, scale.y, radiusScale);
            }
        }

        private void ApplyTexasHoldemCloth()
        {
            if (texasHoldemClothMaterial == null)
            {
                return;
            }

            foreach (Renderer clothRenderer in clothRenderers)
            {
                if (clothRenderer == null)
                {
                    continue;
                }

                if (clothRenderer.sharedMaterial != texasHoldemClothMaterial)
                {
                    clothRenderer.sharedMaterial = texasHoldemClothMaterial;
                }
            }
        }

        private void TuneClothColor()
        {
            if (!brightenClothColors)
            {
                return;
            }

            foreach (Renderer clothRenderer in clothRenderers)
            {
                if (clothRenderer == null)
                {
                    continue;
                }

                Material shared = clothRenderer.sharedMaterial;
                if (shared == null)
                {
                    continue;
                }

                bool hasBaseColor = shared.HasProperty("_BaseColor");
                bool hasColor = shared.HasProperty("_Color");
                if (!hasBaseColor && !hasColor)
                {
                    continue;
                }

                Color sourceColor = hasBaseColor ? shared.GetColor("_BaseColor") : shared.GetColor("_Color");
                Color targetColor = ResolveTargetClothColor(sourceColor, clothRenderer.name);
                Color adjusted = Color.Lerp(sourceColor, targetColor, colorBlend);

                clothRenderer.GetPropertyBlock(clothPropertyBlock);
                if (hasBaseColor)
                {
                    clothPropertyBlock.SetColor("_BaseColor", adjusted);
                }

                if (hasColor)
                {
                    clothPropertyBlock.SetColor("_Color", adjusted);
                }

                clothRenderer.SetPropertyBlock(clothPropertyBlock);
            }
        }

        private Color ResolveTargetClothColor(Color sourceColor, string rendererName)
        {
            string lowerName = string.IsNullOrEmpty(rendererName) ? string.Empty : rendererName.ToLowerInvariant();
            if (lowerName.Contains("beige"))
            {
                return brighterBeige;
            }

            if (lowerName.Contains("green"))
            {
                return brighterGreen;
            }

            Color.RGBToHSV(sourceColor, out float hue, out float saturation, out _);
            bool looksGreen = hue >= 0.22f && hue <= 0.45f && saturation >= 0.2f;
            bool looksBeige = hue >= 0.08f && hue <= 0.16f && saturation <= 0.35f;
            if (looksGreen)
            {
                return brighterGreen;
            }

            return looksBeige ? brighterBeige : sourceColor;
        }
    }
}
