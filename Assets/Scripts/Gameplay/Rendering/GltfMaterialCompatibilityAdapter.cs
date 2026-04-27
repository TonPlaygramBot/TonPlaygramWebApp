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
        [SerializeField] private bool runOnEnable = true;
        [SerializeField] private bool forceUrpLitShader = true;
        [SerializeField] private bool forceSupportedShaderSwap = true;
        [SerializeField] private bool keepOpaqueByDefault = true;
        [SerializeField] private Shader urpLitShader;
        [SerializeField] private Shader standardShader;

        private static readonly int BaseMapId = Shader.PropertyToID("_BaseMap");
        private static readonly int BaseColorMapId = Shader.PropertyToID("_BaseColorMap");
        private static readonly int MainTexId = Shader.PropertyToID("_MainTex");
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int BumpMapId = Shader.PropertyToID("_BumpMap");
        private static readonly int NormalMapId = Shader.PropertyToID("_NormalMap");
        private static readonly int MetallicGlossMapId = Shader.PropertyToID("_MetallicGlossMap");
        private static readonly int MetallicMapId = Shader.PropertyToID("_MetallicMap");
        private static readonly int OcclusionMapId = Shader.PropertyToID("_OcclusionMap");
        private static readonly int EmissionMapId = Shader.PropertyToID("_EmissionMap");
        private static readonly int SurfaceId = Shader.PropertyToID("_Surface");
        private static readonly int SrcBlendId = Shader.PropertyToID("_SrcBlend");
        private static readonly int DstBlendId = Shader.PropertyToID("_DstBlend");
        private static readonly int ZWriteId = Shader.PropertyToID("_ZWrite");
        private static readonly int AlphaClipId = Shader.PropertyToID("_AlphaClip");

        void Awake()
        {
            if (runOnAwake)
            {
                ApplyCompatibilityPass();
            }
        }

        void OnEnable()
        {
            if (runOnEnable)
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
            if (!forceSupportedShaderSwap && material.shader != null && material.shader.isSupported)
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
            Texture baseTexture = FirstTexture(material, BaseMapId, BaseColorMapId, MainTexId);
            if (baseTexture != null)
            {
                TrySetTexture(material, BaseMapId, baseTexture);
                TrySetTexture(material, BaseColorMapId, baseTexture);
                TrySetTexture(material, MainTexId, baseTexture);
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

            Texture normal = FirstTexture(material, BumpMapId, NormalMapId);
            if (normal != null)
            {
                TrySetTexture(material, BumpMapId, normal);
                TrySetTexture(material, NormalMapId, normal);
                material.EnableKeyword("_NORMALMAP");
            }

            Texture metallic = FirstTexture(material, MetallicGlossMapId, MetallicMapId);
            if (metallic != null)
            {
                TrySetTexture(material, MetallicGlossMapId, metallic);
                TrySetTexture(material, MetallicMapId, metallic);
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

        void LateUpdate()
        {
            if (!keepOpaqueByDefault)
            {
                return;
            }

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

                    ForceOpaque(mat);
                }
            }
        }

        private static void ForceOpaque(Material material)
        {
            if (material.HasProperty(SurfaceId))
            {
                material.SetFloat(SurfaceId, 0f);
            }

            if (material.HasProperty(SrcBlendId))
            {
                material.SetFloat(SrcBlendId, (int)UnityEngine.Rendering.BlendMode.One);
            }

            if (material.HasProperty(DstBlendId))
            {
                material.SetFloat(DstBlendId, (int)UnityEngine.Rendering.BlendMode.Zero);
            }

            if (material.HasProperty(ZWriteId))
            {
                material.SetFloat(ZWriteId, 1f);
            }

            if (material.HasProperty(AlphaClipId))
            {
                material.SetFloat(AlphaClipId, 0f);
            }

            material.renderQueue = -1;
            material.DisableKeyword("_ALPHATEST_ON");
            material.DisableKeyword("_ALPHABLEND_ON");
            material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
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
    }
}
