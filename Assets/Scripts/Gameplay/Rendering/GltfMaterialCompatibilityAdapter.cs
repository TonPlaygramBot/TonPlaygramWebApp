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
        [SerializeField] private bool preserveSourceTextureTransforms = true;
        [Tooltip("Keeps UV orientation from imported GLTF source. Enable only if your importer flipped textures vertically.")]
        [SerializeField] private bool invertMainTextureY = false;

        private static readonly int BaseMapId = Shader.PropertyToID("_BaseMap");
        private static readonly int MainTexId = Shader.PropertyToID("_MainTex");
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

        private void CopyPbrMaps(Material material)
        {
            Texture baseTexture = FirstTexture(material, BaseMapId, MainTexId);
            if (baseTexture != null)
            {
                TrySetTexture(material, BaseMapId, baseTexture);
                TrySetTexture(material, MainTexId, baseTexture);
                if (preserveSourceTextureTransforms)
                {
                    CopyTextureTransform(material, BaseMapId, MainTexId);
                    if (invertMainTextureY)
                    {
                        FlipTextureY(material, BaseMapId);
                        FlipTextureY(material, MainTexId);
                    }
                }
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
                if (preserveSourceTextureTransforms)
                {
                    CopyTextureTransform(material, BumpMapId, BaseMapId);
                }
            }

            Texture metallic = FirstTexture(material, MetallicGlossMapId);
            if (metallic != null)
            {
                TrySetTexture(material, MetallicGlossMapId, metallic);
                if (preserveSourceTextureTransforms)
                {
                    CopyTextureTransform(material, MetallicGlossMapId, BaseMapId);
                }
            }

            Texture occlusion = FirstTexture(material, OcclusionMapId);
            if (occlusion != null)
            {
                TrySetTexture(material, OcclusionMapId, occlusion);
                if (preserveSourceTextureTransforms)
                {
                    CopyTextureTransform(material, OcclusionMapId, BaseMapId);
                }
            }

            Texture emission = FirstTexture(material, EmissionMapId);
            if (emission != null)
            {
                TrySetTexture(material, EmissionMapId, emission);
                material.EnableKeyword("_EMISSION");
                if (preserveSourceTextureTransforms)
                {
                    CopyTextureTransform(material, EmissionMapId, BaseMapId);
                }
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

        private static void CopyTextureTransform(Material material, int destinationPropertyId, int sourcePropertyId)
        {
            if (!material.HasProperty(destinationPropertyId) || !material.HasProperty(sourcePropertyId))
            {
                return;
            }

            Vector2 srcScale = material.GetTextureScale(sourcePropertyId);
            Vector2 srcOffset = material.GetTextureOffset(sourcePropertyId);
            material.SetTextureScale(destinationPropertyId, srcScale);
            material.SetTextureOffset(destinationPropertyId, srcOffset);
        }

        private static void FlipTextureY(Material material, int propertyId)
        {
            if (!material.HasProperty(propertyId))
            {
                return;
            }

            Vector2 scale = material.GetTextureScale(propertyId);
            Vector2 offset = material.GetTextureOffset(propertyId);
            scale.y *= -1f;
            offset.y = 1f - offset.y;
            material.SetTextureScale(propertyId, scale);
            material.SetTextureOffset(propertyId, offset);
        }
    }
}
