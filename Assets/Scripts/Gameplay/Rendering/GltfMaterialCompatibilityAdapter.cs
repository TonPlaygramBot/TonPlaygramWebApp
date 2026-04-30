using UnityEngine;

namespace Aiming.Gameplay.Rendering
{
    /// <summary>
    /// Keeps imported GLB/GLTF character materials compatible with active render pipeline
    /// so original textures stay visible (BaseColor/Normal/Metallic/Occlusion/Emission).
    /// </summary>
    public class GltfMaterialCompatibilityAdapter : MonoBehaviour
    {
        [SerializeField] private Renderer[] targetRenderers;
        [SerializeField] private bool runOnAwake = true;
        [SerializeField] private bool forceUrpLitShader = true;
        [SerializeField] private Shader urpLitShader;
        [SerializeField] private Shader standardShader;

        private static readonly int BaseMapId = Shader.PropertyToID("_BaseMap");
        private static readonly int MainTexId = Shader.PropertyToID("_MainTex");
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int BumpMapId = Shader.PropertyToID("_BumpMap");
        private static readonly int MetallicGlossMapId = Shader.PropertyToID("_MetallicGlossMap");
        private static readonly int OcclusionMapId = Shader.PropertyToID("_OcclusionMap");
        private static readonly int EmissionMapId = Shader.PropertyToID("_EmissionMap");
        private static readonly int BaseMapStId = Shader.PropertyToID("_BaseMap_ST");
        private static readonly int MainTexStId = Shader.PropertyToID("_MainTex_ST");
        private static readonly int BaseColorMapId = Shader.PropertyToID("_BaseColorMap");
        private static readonly int BaseColorTextureId = Shader.PropertyToID("_BaseColorTexture");
        private static readonly int ColorMapId = Shader.PropertyToID("_ColorMap");

        void Awake()
        {
            if (runOnAwake)
            {
                ApplyCompatibilityPass();
            }
        }

        [ContextMenu("Apply GLTF Compatibility Pass")]
        public void ApplyCompatibilityPass()
        {
            Renderer[] renderers = ResolveRenderers();
            for (int r = 0; r < renderers.Length; r++)
            {
                Renderer renderer = renderers[r];
                if (renderer == null)
                {
                    continue;
                }

                Material[] materials = renderer.sharedMaterials;
                for (int i = 0; i < materials.Length; i++)
                {
                    Material mat = materials[i];
                    if (mat == null)
                    {
                        continue;
                    }

                    EnsureSupportedShader(mat);
                    CopyPbrMaps(mat);
                }
            }
        }

        private Renderer[] ResolveRenderers()
        {
            if (targetRenderers != null && targetRenderers.Length > 0)
            {
                return targetRenderers;
            }

            return GetComponentsInChildren<Renderer>(true);
        }

        private void EnsureSupportedShader(Material material)
        {
            if (material.shader != null && material.shader.isSupported)
            {
                return;
            }

            Shader selected = ResolveFallbackShader();
            if (selected != null)
            {
                material.shader = selected;
            }
        }

        private Shader ResolveFallbackShader()
        {
            if (forceUrpLitShader)
            {
                if (urpLitShader == null)
                {
                    urpLitShader = Shader.Find("Universal Render Pipeline/Lit");
                }

                if (urpLitShader != null)
                {
                    return urpLitShader;
                }
            }

            if (standardShader == null)
            {
                standardShader = Shader.Find("Standard");
            }

            return standardShader;
        }

        private static void CopyPbrMaps(Material material)
        {
            Texture baseTexture = FirstTexture(material, BaseMapId, MainTexId, BaseColorMapId, BaseColorTextureId, ColorMapId);
            if (baseTexture != null)
            {
                TrySetTexture(material, BaseMapId, baseTexture);
                TrySetTexture(material, MainTexId, baseTexture);
                TrySetTexture(material, BaseColorMapId, baseTexture);
                TrySetTexture(material, BaseColorTextureId, baseTexture);
                TrySetTexture(material, ColorMapId, baseTexture);
                SyncTextureTransform(material);
            }

            if (material.HasProperty(BaseColorId) && material.HasProperty(ColorId))
            {
                Color baseColor = material.GetColor(BaseColorId);
                material.SetColor(ColorId, baseColor);
            }
            else if (material.HasProperty(ColorId) && material.HasProperty(BaseColorId))
            {
                Color mainColor = material.GetColor(ColorId);
                material.SetColor(BaseColorId, mainColor);
            }

            Texture normal = FirstTexture(material, BumpMapId);
            if (normal != null)
            {
                TrySetTexture(material, BumpMapId, normal);
                material.EnableKeyword("_NORMALMAP");
            }

            Texture metallic = FirstTexture(material, MetallicGlossMapId);
            if (metallic != null)
            {
                TrySetTexture(material, MetallicGlossMapId, metallic);
            }

            Texture occlusion = FirstTexture(material, OcclusionMapId);
            if (occlusion != null)
            {
                TrySetTexture(material, OcclusionMapId, occlusion);
            }

            Texture emission = FirstTexture(material, EmissionMapId);
            if (emission != null)
            {
                TrySetTexture(material, EmissionMapId, emission);
                material.EnableKeyword("_EMISSION");
            }
        }

        private static Texture FirstTexture(Material material, params int[] texturePropertyIds)
        {
            for (int i = 0; i < texturePropertyIds.Length; i++)
            {
                int propertyId = texturePropertyIds[i];
                if (!material.HasProperty(propertyId))
                {
                    continue;
                }

                Texture tex = material.GetTexture(propertyId);
                if (tex != null)
                {
                    return tex;
                }
            }

            return null;
        }

        private static void TrySetTexture(Material material, int propertyId, Texture texture)
        {
            if (material.HasProperty(propertyId))
            {
                material.SetTexture(propertyId, texture);
            }
        }


        private static Vector2 FirstTextureScale(Material material, params int[] texturePropertyIds)
        {
            for (int i = 0; i < texturePropertyIds.Length; i++)
            {
                int propertyId = texturePropertyIds[i];
                if (!material.HasProperty(propertyId))
                {
                    continue;
                }

                Vector2 scale = material.GetTextureScale(propertyId);
                if (scale != Vector2.zero)
                {
                    return scale;
                }
            }

            return Vector2.one;
        }

        private static Vector2 FirstTextureOffset(Material material, params int[] texturePropertyIds)
        {
            for (int i = 0; i < texturePropertyIds.Length; i++)
            {
                int propertyId = texturePropertyIds[i];
                if (!material.HasProperty(propertyId))
                {
                    continue;
                }

                return material.GetTextureOffset(propertyId);
            }

            return Vector2.zero;
        }
        private static void SyncTextureTransform(Material material)
        {
            bool hasBase = material.HasProperty(BaseMapId);
            bool hasMain = material.HasProperty(MainTexId);
            if (!hasBase || !hasMain)
            {
                return;
            }

            Vector2 scale = FirstTextureScale(material, BaseMapId, MainTexId, BaseColorMapId, BaseColorTextureId, ColorMapId);
            Vector2 offset = FirstTextureOffset(material, BaseMapId, MainTexId, BaseColorMapId, BaseColorTextureId, ColorMapId);

            material.SetTextureScale(MainTexId, scale);
            material.SetTextureOffset(MainTexId, offset);
            material.SetTextureScale(BaseMapId, scale);
            material.SetTextureOffset(BaseMapId, offset);
            if (material.HasProperty(BaseColorMapId))
            {
                material.SetTextureScale(BaseColorMapId, scale);
                material.SetTextureOffset(BaseColorMapId, offset);
            }

            if (material.HasProperty(BaseMapStId) && material.HasProperty(MainTexStId))
            {
                Vector4 st = new Vector4(scale.x, scale.y, offset.x, offset.y);
                material.SetVector(BaseMapStId, st);
                material.SetVector(MainTexStId, st);
            }
        }
    }
}
