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
        [SerializeField] private bool upgradeGltfImportShaders = true;
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
        private static readonly int GltfBaseColorTextureId = Shader.PropertyToID("_BaseColorTexture");
        private static readonly int GltfBaseColorMapId = Shader.PropertyToID("baseColorTexture");
        private static readonly int GltfNormalTextureId = Shader.PropertyToID("_NormalTexture");
        private static readonly int GltfMetallicRoughnessTextureId = Shader.PropertyToID("_MetallicRoughnessTexture");
        private static readonly int GltfOcclusionTextureId = Shader.PropertyToID("_OcclusionTexture");
        private static readonly int GltfEmissiveTextureId = Shader.PropertyToID("_EmissiveTexture");
        private static readonly int GltfBaseColorFactorId = Shader.PropertyToID("_BaseColorFactor");

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

                    MaterialTextureSnapshot textureSnapshot = MaterialTextureSnapshot.Capture(mat);
                    EnsureSupportedShader(mat, textureSnapshot);
                    CopyPbrMaps(mat, textureSnapshot);
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

        private void EnsureSupportedShader(Material material, MaterialTextureSnapshot textureSnapshot)
        {
            bool needsFallbackShader = material.shader == null || !material.shader.isSupported;
            bool shouldUpgradeGltfShader = upgradeGltfImportShaders && textureSnapshot.HasGltfOnlyBaseTexture && ResolveFallbackShader() != null;
            if (!needsFallbackShader && !shouldUpgradeGltfShader)
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

        private static void CopyPbrMaps(Material material, MaterialTextureSnapshot textureSnapshot)
        {
            int sourceUvPropertyId;
            Texture baseTexture = FirstTexture(material, out sourceUvPropertyId, BaseMapId, MainTexId, GltfBaseColorTextureId, GltfBaseColorMapId);
            if (baseTexture == null)
            {
                baseTexture = textureSnapshot.BaseTexture;
                sourceUvPropertyId = textureSnapshot.BaseTexturePropertyId;
            }
            if (baseTexture != null)
            {
                TrySetTexture(material, BaseMapId, baseTexture);
                TrySetTexture(material, MainTexId, baseTexture);
                SyncTextureTransform(material, sourceUvPropertyId);
            }

            Color resolvedBaseColor = textureSnapshot.HasBaseColor ? textureSnapshot.BaseColor : Color.white;
            if (!textureSnapshot.HasBaseColor && material.HasProperty(BaseColorId))
            {
                resolvedBaseColor = material.GetColor(BaseColorId);
            }
            else if (!textureSnapshot.HasBaseColor && material.HasProperty(ColorId))
            {
                resolvedBaseColor = material.GetColor(ColorId);
            }

            if (material.HasProperty(BaseColorId))
            {
                material.SetColor(BaseColorId, resolvedBaseColor);
            }

            if (material.HasProperty(ColorId))
            {
                material.SetColor(ColorId, resolvedBaseColor);
            }

            Texture normal = FirstTexture(material, BumpMapId, GltfNormalTextureId);
            if (normal == null)
            {
                normal = textureSnapshot.NormalTexture;
            }
            if (normal != null)
            {
                TrySetTexture(material, BumpMapId, normal);
                material.EnableKeyword("_NORMALMAP");
            }

            Texture metallic = FirstTexture(material, MetallicGlossMapId, GltfMetallicRoughnessTextureId);
            if (metallic == null)
            {
                metallic = textureSnapshot.MetallicTexture;
            }
            if (metallic != null)
            {
                TrySetTexture(material, MetallicGlossMapId, metallic);
            }

            Texture occlusion = FirstTexture(material, OcclusionMapId, GltfOcclusionTextureId);
            if (occlusion == null)
            {
                occlusion = textureSnapshot.OcclusionTexture;
            }
            if (occlusion != null)
            {
                TrySetTexture(material, OcclusionMapId, occlusion);
            }

            Texture emission = FirstTexture(material, EmissionMapId, GltfEmissiveTextureId);
            if (emission == null)
            {
                emission = textureSnapshot.EmissionTexture;
            }
            if (emission != null)
            {
                TrySetTexture(material, EmissionMapId, emission);
                material.EnableKeyword("_EMISSION");
            }
        }

        private sealed class MaterialTextureSnapshot
        {
            public Texture BaseTexture;
            public int BaseTexturePropertyId = -1;
            public Texture NormalTexture;
            public Texture MetallicTexture;
            public Texture OcclusionTexture;
            public Texture EmissionTexture;
            public Color BaseColor = Color.white;
            public bool HasBaseColor;
            public bool HasGltfOnlyBaseTexture;

            public static MaterialTextureSnapshot Capture(Material material)
            {
                MaterialTextureSnapshot snapshot = new MaterialTextureSnapshot();
                snapshot.BaseTexture = FirstTexture(material, out snapshot.BaseTexturePropertyId, BaseMapId, MainTexId, GltfBaseColorTextureId, GltfBaseColorMapId);
                snapshot.HasGltfOnlyBaseTexture = snapshot.BaseTexture != null && snapshot.BaseTexturePropertyId != BaseMapId && snapshot.BaseTexturePropertyId != MainTexId;
                snapshot.NormalTexture = FirstTexture(material, BumpMapId, GltfNormalTextureId);
                snapshot.MetallicTexture = FirstTexture(material, MetallicGlossMapId, GltfMetallicRoughnessTextureId);
                snapshot.OcclusionTexture = FirstTexture(material, OcclusionMapId, GltfOcclusionTextureId);
                snapshot.EmissionTexture = FirstTexture(material, EmissionMapId, GltfEmissiveTextureId);

                if (material.HasProperty(BaseColorId))
                {
                    snapshot.BaseColor = material.GetColor(BaseColorId);
                    snapshot.HasBaseColor = true;
                }
                else if (material.HasProperty(ColorId))
                {
                    snapshot.BaseColor = material.GetColor(ColorId);
                    snapshot.HasBaseColor = true;
                }
                else if (material.HasProperty(GltfBaseColorFactorId))
                {
                    snapshot.BaseColor = material.GetColor(GltfBaseColorFactorId);
                    snapshot.HasBaseColor = true;
                }

                return snapshot;
            }
        }

        private static Texture FirstTexture(Material material, params int[] texturePropertyIds)
        {
            int ignored;
            return FirstTexture(material, out ignored, texturePropertyIds);
        }

        private static Texture FirstTexture(Material material, out int sourcePropertyId, params int[] texturePropertyIds)
        {
            sourcePropertyId = -1;
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
                    sourcePropertyId = propertyId;
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

        private static void SyncTextureTransform(Material material, int sourceUvPropertyId)
        {
            bool hasBase = material.HasProperty(BaseMapId);
            bool hasMain = material.HasProperty(MainTexId);
            if (!hasBase || !hasMain)
            {
                return;
            }

            int sourceProperty = sourceUvPropertyId == MainTexId ? MainTexId : BaseMapId;
            if (!material.HasProperty(sourceProperty))
            {
                sourceProperty = BaseMapId;
            }

            Vector2 scale = material.GetTextureScale(sourceProperty);
            Vector2 offset = material.GetTextureOffset(sourceProperty);

            material.SetTextureScale(MainTexId, scale);
            material.SetTextureOffset(MainTexId, offset);
            material.SetTextureScale(BaseMapId, scale);
            material.SetTextureOffset(BaseMapId, offset);

            if (material.HasProperty(BaseMapStId) && material.HasProperty(MainTexStId))
            {
                Vector4 st = new Vector4(scale.x, scale.y, offset.x, offset.y);
                material.SetVector(BaseMapStId, st);
                material.SetVector(MainTexStId, st);
            }
        }
    }
}
