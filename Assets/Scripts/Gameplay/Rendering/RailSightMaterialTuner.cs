using UnityEngine;

namespace Gameplay.Rendering
{
    /// <summary>
    /// Tunes rail sight chrome/gold finish by smoothing edge response and extending texture mapping downward.
    /// Intended for GLTF/GLB imported rail sight meshes.
    /// </summary>
    public sealed class RailSightMaterialTuner : MonoBehaviour
    {
        [SerializeField] private Renderer[] railSightRenderers;
        [SerializeField, Min(0.1f)] private float verticalTextureScaleMultiplier = 1.28f;
        [SerializeField, Range(0f, 1f)] private float smoothness = 0.92f;
        [SerializeField, Range(0f, 1f)] private float metallic = 0.88f;

        private static readonly int MainTex = Shader.PropertyToID("_MainTex");
        private static readonly int BaseMap = Shader.PropertyToID("_BaseMap");
        private static readonly int Smoothness = Shader.PropertyToID("_Smoothness");
        private static readonly int Glossiness = Shader.PropertyToID("_Glossiness");
        private static readonly int Metallic = Shader.PropertyToID("_Metallic");

        [ContextMenu("Apply Rail Sight Tuning")]
        public void Apply()
        {
            for (int i = 0; i < railSightRenderers.Length; i++)
            {
                Renderer r = railSightRenderers[i];
                if (r == null) continue;

                Material[] materials = r.materials;
                for (int m = 0; m < materials.Length; m++)
                {
                    Material material = materials[m];
                    if (material == null) continue;

                    ExpandTextureDownward(material, MainTex);
                    ExpandTextureDownward(material, BaseMap);

                    if (material.HasProperty(Smoothness)) material.SetFloat(Smoothness, smoothness);
                    if (material.HasProperty(Glossiness)) material.SetFloat(Glossiness, smoothness);
                    if (material.HasProperty(Metallic)) material.SetFloat(Metallic, metallic);
                }
            }
        }

        private void OnValidate() => Apply();

        private void ExpandTextureDownward(Material material, int texProperty)
        {
            if (!material.HasProperty(texProperty)) return;
            Vector2 scale = material.GetTextureScale(texProperty);
            Vector2 offset = material.GetTextureOffset(texProperty);
            float nextY = Mathf.Max(0.01f, scale.y / verticalTextureScaleMultiplier);
            float deltaY = scale.y - nextY;
            material.SetTextureScale(texProperty, new Vector2(scale.x, nextY));
            material.SetTextureOffset(texProperty, new Vector2(offset.x, offset.y - deltaY * 0.5f));
        }
    }
}
