using System;
using UnityEngine;
using UnityEngine.Rendering;

namespace TonPlaygram.Settings
{
    /// <summary>
    /// Central mobile-first graphics settings manager.
    ///
    /// Responsibilities:
    /// - Persist and load the user-selected GraphicsPreset.
    /// - Resolve Auto into an internal tier via hardware heuristics.
    /// - Apply full-scene quality changes immediately (FPS + render scale + quality knobs).
    /// - Expose events so UI and gameplay systems can react without tight coupling.
    ///
    /// Resolution strategy:
    /// - URP: set renderScale on the active URP pipeline asset (reflection, no hard package dependency).
    /// - Non-URP fallback: use ScalableBufferManager.ResizeBuffers(scale, scale) to reduce internal
    ///   render buffer size while keeping display/UI resolution readable.
    /// </summary>
    public sealed class GraphicsSettingsManager : MonoBehaviour
    {
        private const string SavedPresetKey = "graphics_preset";
        private const string SavedAutoResolvedTierKey = "graphics_auto_resolved_tier";

        // Optional singleton convenience for simple projects.
        public static GraphicsSettingsManager Instance { get; private set; }

        public GraphicsPreset SelectedPreset { get; private set; } = GraphicsPreset.Auto;
        public GraphicsQualityTier AppliedTier { get; private set; } = GraphicsQualityTier.Medium;

        public event Action<GraphicsPreset, GraphicsQualityTier> OnGraphicsSettingsApplied;

        /// <summary>
        /// Optional hook for game-specific extras (e.g. post-processing volumes, particle managers)
        /// that are not globally controllable via QualitySettings alone.
        /// </summary>
        public event Action<GraphicsQualityTier> OnCustomQualityTierApplied;

        [Header("Render Scale (clamped at runtime)")]
        [SerializeField, Range(0.5f, 1.0f)] private float lowRenderScale = 0.70f;
        [SerializeField, Range(0.7f, 1.1f)] private float mediumRenderScale = 0.90f;
        [SerializeField, Range(0.9f, 1.4f)] private float highRenderScale = 1.10f;

        [Header("Frame Targets")]
        [SerializeField] private int lowTargetFps = 60;
        [SerializeField] private int mediumTargetFps = 90;
        [SerializeField] private int highTargetFps = 120;

        [Header("Optional UI Messages")]
        [SerializeField] private bool logFeedbackMessages = true;

        private static readonly string[] PresetDescriptions =
        {
            "Recommended. Automatically chooses the best graphics for your phone.",
            "Best for battery life and lower-end phones.",
            "Balanced visuals and smooth performance.",
            "Best visuals for powerful phones.",
        };

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            Application.targetFrameRate = -1;
            QualitySettings.vSyncCount = 0; // Mobile should use explicit frame cap.

            LoadAndApplyOnBoot();
        }

        public string GetDescription(GraphicsPreset preset)
        {
            return PresetDescriptions[(int)preset];
        }

        public void SetPreset(GraphicsPreset preset, bool showUserMessage = true)
        {
            SelectedPreset = preset;

            var resolvedTier = preset == GraphicsPreset.Auto
                ? ResolveAutoTierAndCache()
                : PresetToTier(preset);

            ApplyTierInternal(resolvedTier);
            SaveSelection();

            if (showUserMessage)
            {
                EmitUserFeedbackMessage(preset, resolvedTier);
            }

            OnGraphicsSettingsApplied?.Invoke(SelectedPreset, AppliedTier);
        }

        public GraphicsQualityTier GetResolvedTierForPreset(GraphicsPreset preset)
        {
            return preset == GraphicsPreset.Auto ? ResolveAutoTierNoSideEffects() : PresetToTier(preset);
        }

        private void LoadAndApplyOnBoot()
        {
            if (PlayerPrefs.HasKey(SavedPresetKey))
            {
                SelectedPreset = (GraphicsPreset)Mathf.Clamp(PlayerPrefs.GetInt(SavedPresetKey, 0), 0, 3);
            }
            else
            {
                // First launch: default to Auto for best out-of-box experience.
                SelectedPreset = GraphicsPreset.Auto;
                PlayerPrefs.SetInt(SavedPresetKey, (int)SelectedPreset);
                PlayerPrefs.Save();
            }

            var tier = SelectedPreset == GraphicsPreset.Auto
                ? ResolveAutoTierAndCache()
                : PresetToTier(SelectedPreset);

            ApplyTierInternal(tier);
            OnGraphicsSettingsApplied?.Invoke(SelectedPreset, AppliedTier);
        }

        private void SaveSelection()
        {
            PlayerPrefs.SetInt(SavedPresetKey, (int)SelectedPreset);
            PlayerPrefs.SetInt(SavedAutoResolvedTierKey, (int)AppliedTier);
            PlayerPrefs.Save();
        }

        private GraphicsQualityTier PresetToTier(GraphicsPreset preset)
        {
            switch (preset)
            {
                case GraphicsPreset.Low:
                    return GraphicsQualityTier.Low;
                case GraphicsPreset.Medium:
                    return GraphicsQualityTier.Medium;
                case GraphicsPreset.High:
                    return GraphicsQualityTier.High;
                default:
                    return GraphicsQualityTier.Medium;
            }
        }

        private GraphicsQualityTier ResolveAutoTierNoSideEffects()
        {
            return ScoreDeviceAndPickTier();
        }

        private GraphicsQualityTier ResolveAutoTierAndCache()
        {
            var tier = ScoreDeviceAndPickTier();
            PlayerPrefs.SetInt(SavedAutoResolvedTierKey, (int)tier);
            return tier;
        }

        private GraphicsQualityTier ScoreDeviceAndPickTier()
        {
            // Heuristic scoring. Conservative by design for thermal stability.
            // Unity does not expose reliable universal thermal APIs across all Android/iOS versions,
            // so we infer risk via battery state + power-saving hints + hardware headroom.

            var score = 0;

            var refreshRate = GetScreenRefreshRate();
            if (refreshRate >= 120) score += 25;
            else if (refreshRate >= 90) score += 15;
            else if (refreshRate >= 60) score += 8;
            else score += 2;

            var ramMb = SystemInfo.systemMemorySize;
            if (ramMb >= 12000) score += 25;
            else if (ramMb >= 8000) score += 18;
            else if (ramMb >= 5000) score += 10;
            else if (ramMb >= 3000) score += 4;

            var cpuCores = SystemInfo.processorCount;
            if (cpuCores >= 8) score += 18;
            else if (cpuCores >= 6) score += 12;
            else if (cpuCores >= 4) score += 6;

            var cpuFreq = SystemInfo.processorFrequency;
            if (cpuFreq >= 2800) score += 10;
            else if (cpuFreq >= 2200) score += 6;
            else if (cpuFreq >= 1600) score += 3;

            score += ScoreGpuLevel();
            score += ScoreGraphicsApiSupport();

            // Resolution pressure: very high internal pixel count increases GPU cost.
            var pixelCount = Screen.width * Screen.height;
            if (pixelCount >= 3000000) score -= 8;      // ~1440p+
            else if (pixelCount >= 2073600) score -= 4; // ~1080p+

            // Conservative battery sensitivity. If unplugged + low battery, step down.
            // (No direct universal thermal signal in Unity runtime APIs.)
            if (SystemInfo.batteryStatus == BatteryStatus.Discharging)
            {
                if (SystemInfo.batteryLevel >= 0f && SystemInfo.batteryLevel <= 0.15f)
                {
                    score -= 18;
                }
                else if (SystemInfo.batteryLevel <= 0.30f)
                {
                    score -= 8;
                }
            }

            // Safety fallback when key detection data is missing.
            if (ramMb <= 0 || cpuCores <= 0)
            {
                score = Mathf.Min(score, 50);
            }

            if (score >= 70) return GraphicsQualityTier.High;
            if (score >= 42) return GraphicsQualityTier.Medium;
            return GraphicsQualityTier.Low;
        }

        private int ScoreGpuLevel()
        {
            // Practical heuristic based on GPU model strings available in Unity.
            var gpuName = SystemInfo.graphicsDeviceName;
            if (string.IsNullOrEmpty(gpuName)) return 0;

            gpuName = gpuName.ToLowerInvariant();

            // High-end families
            if (gpuName.Contains("adreno 7") || gpuName.Contains("adreno 8") ||
                gpuName.Contains("mali-g7") || gpuName.Contains("mali-g8") ||
                gpuName.Contains("apple a17") || gpuName.Contains("apple a18") ||
                gpuName.Contains("apple m1") || gpuName.Contains("apple m2"))
            {
                return 18;
            }

            // Mid-tier families
            if (gpuName.Contains("adreno 6") || gpuName.Contains("mali-g5") || gpuName.Contains("mali-g6") ||
                gpuName.Contains("apple a14") || gpuName.Contains("apple a15") || gpuName.Contains("apple a16"))
            {
                return 10;
            }

            // Entry-level/older
            if (gpuName.Contains("adreno 5") || gpuName.Contains("mali-t") || gpuName.Contains("powervr"))
            {
                return 3;
            }

            return 6;
        }

        private int ScoreGraphicsApiSupport()
        {
            var api = SystemInfo.graphicsDeviceType;
            switch (api)
            {
                case GraphicsDeviceType.Vulkan:
                case GraphicsDeviceType.Metal:
                    return 8;
                case GraphicsDeviceType.OpenGLES3:
                    return 4;
                default:
                    return 1;
            }
        }

        private int GetScreenRefreshRate()
        {
#if UNITY_2021_2_OR_NEWER
            var ratio = Screen.currentResolution.refreshRateRatio;
            return Mathf.RoundToInt((float)ratio.value);
#else
            return Screen.currentResolution.refreshRate;
#endif
        }

        private void ApplyTierInternal(GraphicsQualityTier tier)
        {
            AppliedTier = tier;

            switch (tier)
            {
                case GraphicsQualityTier.Low:
                    ApplyGlobalQuality(lowTargetFps, lowRenderScale, lodBias: 0.6f, textureLimit: 1,
                        shadows: ShadowQuality.Disable, shadowDistance: 0f, softParticles: false, anisotropic: AnisotropicFiltering.Disable,
                        antiAliasing: 0, particleRaycastBudget: 32);
                    break;

                case GraphicsQualityTier.Medium:
                    ApplyGlobalQuality(mediumTargetFps, mediumRenderScale, lodBias: 1.0f, textureLimit: 0,
                        shadows: ShadowQuality.HardOnly, shadowDistance: 22f, softParticles: false, anisotropic: AnisotropicFiltering.Enable,
                        antiAliasing: 2, particleRaycastBudget: 96);
                    break;

                case GraphicsQualityTier.High:
                    var safeHighFps = GetHighestSafeHighRefreshTarget();
                    ApplyGlobalQuality(safeHighFps, highRenderScale, lodBias: 1.5f, textureLimit: 0,
                        shadows: ShadowQuality.All, shadowDistance: 40f, softParticles: true, anisotropic: AnisotropicFiltering.ForceEnable,
                        antiAliasing: 4, particleRaycastBudget: 256);
                    break;
            }

            OnCustomQualityTierApplied?.Invoke(tier);
        }

        private int GetHighestSafeHighRefreshTarget()
        {
            var refresh = GetScreenRefreshRate();
            if (refresh >= 144) return 144;
            if (refresh >= highTargetFps) return highTargetFps;
            if (refresh >= 120) return 120;
            if (refresh >= 90) return 90;
            return 60;
        }

        private void ApplyGlobalQuality(
            int targetFps,
            float internalRenderScale,
            float lodBias,
            int textureLimit,
            ShadowQuality shadows,
            float shadowDistance,
            bool softParticles,
            AnisotropicFiltering anisotropic,
            int antiAliasing,
            int particleRaycastBudget)
        {
            Application.targetFrameRate = Mathf.Clamp(targetFps, 30, 144);

            QualitySettings.lodBias = lodBias;
            QualitySettings.masterTextureLimit = Mathf.Clamp(textureLimit, 0, 3);
            QualitySettings.shadows = shadows;
            QualitySettings.shadowDistance = shadowDistance;
            QualitySettings.softParticles = softParticles;
            QualitySettings.anisotropicFiltering = anisotropic;
            QualitySettings.antiAliasing = antiAliasing;
            QualitySettings.particleRaycastBudget = particleRaycastBudget;

            ApplyInternalResolutionScale(internalRenderScale);
        }

        private void ApplyInternalResolutionScale(float requestedScale)
        {
            // Clamp range for safety and to avoid invalid render targets.
            var clampedScale = Mathf.Clamp(requestedScale, 0.6f, 1.25f);

            if (TrySetUrpRenderScale(clampedScale))
            {
                return;
            }

            // Non-URP fallback:
            // Scales render buffers, producing a softer/sharper full-scene image while the display
            // resolution and UI canvas stay readable. Good default for mobile pipelines.
            ScalableBufferManager.ResizeBuffers(clampedScale, clampedScale);
        }

        private bool TrySetUrpRenderScale(float scale)
        {
            var pipelineAsset = GraphicsSettings.currentRenderPipeline;
            if (pipelineAsset == null)
            {
                return false;
            }

            // Reflection keeps this script compilable even when URP package is not installed.
            var pipelineType = pipelineAsset.GetType();
            var property = pipelineType.GetProperty("renderScale");
            if (property == null || !property.CanWrite)
            {
                return false;
            }

            var min = 0.5f;
            var max = 2.0f;
            var clamped = Mathf.Clamp(scale, min, max);
            property.SetValue(pipelineAsset, clamped, null);
            return true;
        }

        private void EmitUserFeedbackMessage(GraphicsPreset selectedPreset, GraphicsQualityTier resolvedTier)
        {
            if (!logFeedbackMessages)
            {
                return;
            }

            if (selectedPreset == GraphicsPreset.Auto)
            {
                Debug.Log($"[Graphics] Auto selected the best settings for your device ({resolvedTier}).");
                return;
            }

            Debug.Log("[Graphics] Graphics quality updated.");

            if (selectedPreset == GraphicsPreset.High)
            {
                var autoTier = ResolveAutoTierNoSideEffects();
                if (autoTier != GraphicsQualityTier.High)
                {
                    Debug.LogWarning("[Graphics] High graphics may reduce performance on some devices.");
                }
            }
        }
    }
}
