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
        private static readonly int BaseColorTextureId = Shader.PropertyToID("_BaseColorTexture");
        private static readonly int MetallicRoughnessMapId = Shader.PropertyToID("_MetallicRoughnessMap");
        private static readonly int NormalTextureId = Shader.PropertyToID("_NormalTexture");
        private static readonly int EmissiveTextureId = Shader.PropertyToID("_EmissiveTexture");
        private static readonly int OcclusionTextureId = Shader.PropertyToID("_OcclusionTexture");

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
            if (TryCopyTexture(material, BaseMapId, BaseColorTextureId, MainTexId))
            {
                CopyTextureTransform(material, BaseMapId, MainTexId);
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

            if (TryCopyTexture(material, BumpMapId, NormalTextureId))
            {
                CopyTextureTransform(material, BumpMapId, NormalTextureId);
                material.EnableKeyword("_NORMALMAP");
            }

            if (TryCopyTexture(material, MetallicGlossMapId, MetallicRoughnessMapId))
            {
                CopyTextureTransform(material, MetallicGlossMapId, MetallicRoughnessMapId);
            }

            if (TryCopyTexture(material, OcclusionMapId, OcclusionTextureId))
            {
                CopyTextureTransform(material, OcclusionMapId, OcclusionTextureId);
            }

            if (TryCopyTexture(material, EmissionMapId, EmissiveTextureId))
            {
                CopyTextureTransform(material, EmissionMapId, EmissiveTextureId);
                material.EnableKeyword("_EMISSION");
            }
        }

        private static bool TryCopyTexture(Material material, int destinationProperty, params int[] sourceProperties)
        {
            int sourceProperty;
            Texture texture = FirstTextureWithProperty(material, sourceProperties, out sourceProperty);
            if (texture == null)
            {
                return false;
            }

            TrySetTexture(material, destinationProperty, texture);
            if (material.HasProperty(MainTexId) && destinationProperty == BaseMapId)
            {
                TrySetTexture(material, MainTexId, texture);
            }

            if (sourceProperty >= 0)
            {
                CopyTextureTransform(material, sourceProperty, destinationProperty);
            }

            return true;
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

        private static Texture FirstTextureWithProperty(Material material, int[] texturePropertyIds, out int selectedPropertyId)
        {
            selectedPropertyId = -1;
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
                    selectedPropertyId = propertyId;
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

        private static void CopyTextureTransform(Material material, int sourcePropertyId, int destinationPropertyId)
        {
            if (!material.HasProperty(sourcePropertyId) || !material.HasProperty(destinationPropertyId))
            {
                return;
            }

            material.SetTextureScale(destinationPropertyId, material.GetTextureScale(sourcePropertyId));
            material.SetTextureOffset(destinationPropertyId, material.GetTextureOffset(sourcePropertyId));
        }
    }
}
