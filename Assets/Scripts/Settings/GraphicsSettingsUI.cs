using System;
using UnityEngine;
using UnityEngine.UI;

namespace TonPlaygram.Settings
{
    /// <summary>
    /// UI adapter for graphics setting buttons and labels.
    ///
    /// Assign button + text references in inspector.
    /// The script keeps selection highlighting in sync and forwards user taps to manager.
    /// </summary>
    public sealed class GraphicsSettingsUI : MonoBehaviour
    {
        [Serializable]
        public sealed class PresetOptionView
        {
            public GraphicsPreset preset;
            public Button button;
            public Text titleText;
            public Text descriptionText;
            public Graphic[] highlightTargets;
        }

        [Header("Dependencies")]
        [SerializeField] private GraphicsSettingsManager manager;

        [Header("Preset Options")]
        [SerializeField] private PresetOptionView[] options;

        [Header("Style")]
        [SerializeField] private Color selectedColor = new Color(0.15f, 0.7f, 0.3f, 1f);
        [SerializeField] private Color unselectedColor = new Color(0.2f, 0.2f, 0.2f, 1f);
        [SerializeField] private Color selectedTextColor = Color.white;
        [SerializeField] private Color unselectedTextColor = new Color(0.9f, 0.9f, 0.9f, 1f);

        [Header("Optional Feedback")]
        [SerializeField] private Text feedbackText;
        [SerializeField] private float feedbackDuration = 2f;

        private float feedbackHideTime;

        private void Awake()
        {
            if (manager == null)
            {
                manager = GraphicsSettingsManager.Instance;
            }

            WireButtons();
            FillDescriptions();
        }

        private void OnEnable()
        {
            if (manager == null)
            {
                manager = GraphicsSettingsManager.Instance;
            }

            if (manager != null)
            {
                manager.OnGraphicsSettingsApplied += HandleSettingsApplied;
                HandleSettingsApplied(manager.SelectedPreset, manager.AppliedTier);
            }
        }

        private void OnDisable()
        {
            if (manager != null)
            {
                manager.OnGraphicsSettingsApplied -= HandleSettingsApplied;
            }
        }

        private void Update()
        {
            if (feedbackText != null && feedbackText.gameObject.activeSelf && Time.unscaledTime >= feedbackHideTime)
            {
                feedbackText.gameObject.SetActive(false);
            }
        }

        private void WireButtons()
        {
            if (options == null)
            {
                return;
            }

            for (var i = 0; i < options.Length; i++)
            {
                var option = options[i];
                if (option == null || option.button == null)
                {
                    continue;
                }

                var capturedPreset = option.preset;
                option.button.onClick.RemoveAllListeners();
                option.button.onClick.AddListener(() => OnPresetClicked(capturedPreset));
            }
        }

        private void FillDescriptions()
        {
            if (manager == null || options == null)
            {
                return;
            }

            for (var i = 0; i < options.Length; i++)
            {
                var option = options[i];
                if (option == null)
                {
                    continue;
                }

                if (option.titleText != null)
                {
                    option.titleText.text = option.preset.ToString();
                }

                if (option.descriptionText != null)
                {
                    option.descriptionText.text = manager.GetDescription(option.preset);
                }
            }
        }

        private void OnPresetClicked(GraphicsPreset preset)
        {
            if (manager == null)
            {
                Debug.LogWarning("[GraphicsUI] GraphicsSettingsManager not found.");
                return;
            }

            var previous = manager.SelectedPreset;
            manager.SetPreset(preset, showUserMessage: true);

            if (feedbackText == null)
            {
                return;
            }

            if (preset == GraphicsPreset.Auto)
            {
                feedbackText.text = "Auto selected the best settings for your device.";
            }
            else
            {
                feedbackText.text = "Graphics quality updated.";
                if (preset == GraphicsPreset.High && manager.GetResolvedTierForPreset(GraphicsPreset.Auto) != GraphicsQualityTier.High)
                {
                    feedbackText.text = "High graphics may reduce performance on some devices.";
                }
            }

            if (previous != preset || preset == GraphicsPreset.Auto)
            {
                feedbackText.gameObject.SetActive(true);
                feedbackHideTime = Time.unscaledTime + Mathf.Max(0.75f, feedbackDuration);
            }
        }

        private void HandleSettingsApplied(GraphicsPreset selectedPreset, GraphicsQualityTier resolvedTier)
        {
            if (options == null)
            {
                return;
            }

            for (var i = 0; i < options.Length; i++)
            {
                var option = options[i];
                if (option == null)
                {
                    continue;
                }

                var isSelected = option.preset == selectedPreset;
                var bgColor = isSelected ? selectedColor : unselectedColor;
                var txtColor = isSelected ? selectedTextColor : unselectedTextColor;

                if (option.highlightTargets != null)
                {
                    for (var h = 0; h < option.highlightTargets.Length; h++)
                    {
                        var g = option.highlightTargets[h];
                        if (g != null)
                        {
                            g.color = bgColor;
                        }
                    }
                }

                if (option.titleText != null)
                {
                    option.titleText.color = txtColor;
                }

                if (option.descriptionText != null)
                {
                    option.descriptionText.color = txtColor;

                    if (selectedPreset == GraphicsPreset.Auto && option.preset == GraphicsPreset.Auto)
                    {
                        option.descriptionText.text =
                            $"{manager.GetDescription(GraphicsPreset.Auto)}\nActive tier: {resolvedTier}.";
                    }
                    else
                    {
                        option.descriptionText.text = manager.GetDescription(option.preset);
                    }
                }
            }
        }
    }
}
