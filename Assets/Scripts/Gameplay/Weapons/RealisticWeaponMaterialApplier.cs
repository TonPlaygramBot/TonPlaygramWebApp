using System;
using UnityEngine;

namespace TonPlaygram.Gameplay.Weapons
{
    public enum WeaponMaterialSlotRole
    {
        BlackMetal,
        Wood,
        Original,
        Accent
    }

    [Serializable]
    public sealed class WeaponMaterialSlotRule
    {
        public WeaponMaterialSlotRole role = WeaponMaterialSlotRole.BlackMetal;
        public string rendererNameContains;
        public string materialNameContains;
        public Material replacementMaterial;
        public Vector2 textureScale = Vector2.one;
        public Vector2 textureOffset;
    }

    /// <summary>
    /// Replaces flat imported weapon materials with PBR materials while keeping the original GLTF mesh,
    /// UV mapping, material slot count, and renderer hierarchy intact.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class RealisticWeaponMaterialApplier : MonoBehaviour
    {
        [Header("Source texture credits")]
        [SerializeField] private string blackMetalTextureSource = "Poly Haven open-source dark/painted metal PBR texture";
        [SerializeField] private string woodTextureSource = "Poly Haven or other CC0/open-source wood PBR texture";

        [Header("Material defaults")]
        [SerializeField] private Material blackMetalMaterial;
        [SerializeField] private Material woodMaterial;
        [SerializeField] private Material accentMaterial;
        [SerializeField] private bool includeInactiveRenderers = true;
        [SerializeField] private bool applyOnAwake = true;
        [SerializeField] private WeaponMaterialSlotRule[] slotRules = Array.Empty<WeaponMaterialSlotRule>();

        private void Awake()
        {
            if (applyOnAwake)
            {
                ApplyRealisticMaterials();
            }
        }

        [ContextMenu("Apply Realistic Weapon Materials")]
        public void ApplyRealisticMaterials()
        {
            Renderer[] renderers = GetComponentsInChildren<Renderer>(includeInactiveRenderers);
            for (int rendererIndex = 0; rendererIndex < renderers.Length; rendererIndex++)
            {
                ApplyRendererMaterials(renderers[rendererIndex]);
            }
        }

        private void ApplyRendererMaterials(Renderer targetRenderer)
        {
            if (targetRenderer == null)
            {
                return;
            }

            Material[] materials = targetRenderer.sharedMaterials;
            bool changed = false;

            for (int materialIndex = 0; materialIndex < materials.Length; materialIndex++)
            {
                Material current = materials[materialIndex];
                WeaponMaterialSlotRule rule = FindRule(targetRenderer, current);
                Material replacement = ResolveMaterial(rule, targetRenderer, current);
                if (replacement == null || replacement == current)
                {
                    continue;
                }

                materials[materialIndex] = replacement;
                ApplyTextureTransform(replacement, rule);
                changed = true;
            }

            if (changed)
            {
                targetRenderer.sharedMaterials = materials;
            }
        }

        private WeaponMaterialSlotRule FindRule(Renderer targetRenderer, Material currentMaterial)
        {
            string rendererName = targetRenderer != null ? targetRenderer.name : string.Empty;
            string materialName = currentMaterial != null ? currentMaterial.name : string.Empty;

            for (int i = 0; i < slotRules.Length; i++)
            {
                WeaponMaterialSlotRule rule = slotRules[i];
                if (rule == null)
                {
                    continue;
                }

                bool rendererMatches = string.IsNullOrWhiteSpace(rule.rendererNameContains) || rendererName.IndexOf(rule.rendererNameContains, StringComparison.OrdinalIgnoreCase) >= 0;
                bool materialMatches = string.IsNullOrWhiteSpace(rule.materialNameContains) || materialName.IndexOf(rule.materialNameContains, StringComparison.OrdinalIgnoreCase) >= 0;
                if (rendererMatches && materialMatches)
                {
                    return rule;
                }
            }

            return null;
        }

        private Material ResolveMaterial(WeaponMaterialSlotRule rule, Renderer targetRenderer, Material currentMaterial)
        {
            if (rule != null && rule.replacementMaterial != null)
            {
                return rule.replacementMaterial;
            }

            WeaponMaterialSlotRole role = rule != null ? rule.role : GuessRole(targetRenderer, currentMaterial);
            switch (role)
            {
                case WeaponMaterialSlotRole.Wood:
                    return woodMaterial;
                case WeaponMaterialSlotRole.Accent:
                    return accentMaterial != null ? accentMaterial : blackMetalMaterial;
                case WeaponMaterialSlotRole.Original:
                    return currentMaterial;
                case WeaponMaterialSlotRole.BlackMetal:
                default:
                    return blackMetalMaterial;
            }
        }

        private static WeaponMaterialSlotRole GuessRole(Renderer targetRenderer, Material currentMaterial)
        {
            string combinedName = string.Concat(targetRenderer != null ? targetRenderer.name : string.Empty, " ", currentMaterial != null ? currentMaterial.name : string.Empty);
            if (combinedName.IndexOf("wood", StringComparison.OrdinalIgnoreCase) >= 0 ||
                combinedName.IndexOf("stock", StringComparison.OrdinalIgnoreCase) >= 0 ||
                combinedName.IndexOf("grip", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return WeaponMaterialSlotRole.Wood;
            }

            if (combinedName.IndexOf("scope", StringComparison.OrdinalIgnoreCase) >= 0 ||
                combinedName.IndexOf("sight", StringComparison.OrdinalIgnoreCase) >= 0 ||
                combinedName.IndexOf("glass", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return WeaponMaterialSlotRole.Accent;
            }

            return WeaponMaterialSlotRole.BlackMetal;
        }

        private static void ApplyTextureTransform(Material material, WeaponMaterialSlotRule rule)
        {
            if (material == null || rule == null)
            {
                return;
            }

            if (material.HasProperty("_BaseMap"))
            {
                material.SetTextureScale("_BaseMap", rule.textureScale);
                material.SetTextureOffset("_BaseMap", rule.textureOffset);
            }

            if (material.HasProperty("_MainTex"))
            {
                material.SetTextureScale("_MainTex", rule.textureScale);
                material.SetTextureOffset("_MainTex", rule.textureOffset);
            }
        }
    }
}
