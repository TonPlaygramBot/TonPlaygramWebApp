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
        [SerializeField] private bool forceUrpLitShader = false;
        [SerializeField] private Shader urpLitShader;
        [SerializeField] private Shader standardShader;

        private static readonly int BaseMapId = Shader.PropertyToID("_BaseMap");
        private static readonly int MainTexId = Shader.PropertyToID("_MainTex");
        private static readonly int BaseColorTextureId = Shader.PropertyToID("_BaseColorTexture");
        private static readonly int NormalTextureId = Shader.PropertyToID("_NormalTexture");
        private static readonly int MetallicRoughnessTextureId = Shader.PropertyToID("_MetallicRoughnessTexture");
        private static readonly int OcclusionTextureId = Shader.PropertyToID("_OcclusionTexture");
        private static readonly int EmissiveTextureId = Shader.PropertyToID("_EmissiveTexture");
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int BumpMapId = Shader.PropertyToID("_BumpMap");
        private static readonly int MetallicGlossMapId = Shader.PropertyToID("_MetallicGlossMap");
        private static readonly int OcclusionMapId = Shader.PropertyToID("_OcclusionMap");
        private static readonly int EmissionMapId = Shader.PropertyToID("_EmissionMap");

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
            if (material.shader == null)
            {
                Shader selectedShader = ResolveFallbackShader();
                if (selectedShader != null)
                {
                    material.shader = selectedShader;
                }
                return;
            }

            if (material.shader.isSupported && !forceUrpLitShader)
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
            Texture baseTexture = FirstTexture(material, BaseMapId, MainTexId, BaseColorTextureId);
            if (baseTexture != null)
            {
                CopyTexture(material, baseTexture, BaseMapId);
                CopyTexture(material, baseTexture, MainTexId);
                CopyTexture(material, baseTexture, BaseColorTextureId);
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

            Texture normal = FirstTexture(material, BumpMapId, NormalTextureId);
            if (normal != null)
            {
                CopyTexture(material, normal, BumpMapId);
                CopyTexture(material, normal, NormalTextureId);
                material.EnableKeyword("_NORMALMAP");
            }

            Texture metallic = FirstTexture(material, MetallicGlossMapId, MetallicRoughnessTextureId);
            if (metallic != null)
            {
                CopyTexture(material, metallic, MetallicGlossMapId);
                CopyTexture(material, metallic, MetallicRoughnessTextureId);
            }

            Texture occlusion = FirstTexture(material, OcclusionMapId, OcclusionTextureId);
            if (occlusion != null)
            {
                CopyTexture(material, occlusion, OcclusionMapId);
                CopyTexture(material, occlusion, OcclusionTextureId);
            }

            Texture emission = FirstTexture(material, EmissionMapId, EmissiveTextureId);
            if (emission != null)
            {
                CopyTexture(material, emission, EmissionMapId);
                CopyTexture(material, emission, EmissiveTextureId);
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

        private static void CopyTexture(Material material, Texture texture, int targetPropertyId)
        {
            if (!material.HasProperty(targetPropertyId))
            {
                return;
            }

            material.SetTexture(targetPropertyId, texture);
            material.SetTextureScale(targetPropertyId, ResolveTextureScale(material, texture));
            material.SetTextureOffset(targetPropertyId, ResolveTextureOffset(material, texture));
        }

        private static Vector2 ResolveTextureScale(Material material, Texture texture)
        {
            int[] properties = { BaseMapId, MainTexId, BaseColorTextureId, BumpMapId, NormalTextureId, MetallicGlossMapId, MetallicRoughnessTextureId, OcclusionMapId, OcclusionTextureId, EmissionMapId, EmissiveTextureId };
            for (int i = 0; i < properties.Length; i++)
            {
                int propertyId = properties[i];
                if (!material.HasProperty(propertyId) || material.GetTexture(propertyId) != texture)
                {
                    continue;
                }

                return material.GetTextureScale(propertyId);
            }

            return Vector2.one;
        }

        private static Vector2 ResolveTextureOffset(Material material, Texture texture)
        {
            int[] properties = { BaseMapId, MainTexId, BaseColorTextureId, BumpMapId, NormalTextureId, MetallicGlossMapId, MetallicRoughnessTextureId, OcclusionMapId, OcclusionTextureId, EmissionMapId, EmissiveTextureId };
            for (int i = 0; i < properties.Length; i++)
            {
                int propertyId = properties[i];
                if (!material.HasProperty(propertyId) || material.GetTexture(propertyId) != texture)
                {
                    continue;
                }

                return material.GetTextureOffset(propertyId);
            }

            return Vector2.zero;
        }
    }
}
