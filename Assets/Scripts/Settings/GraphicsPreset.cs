namespace TonPlaygram.Settings
{
    /// <summary>
    /// User-facing option selected from the settings menu.
    /// Auto is persisted as a choice, but can map to any applied quality tier.
    /// </summary>
    public enum GraphicsPreset
    {
        Auto = 0,
        Low = 1,
        Medium = 2,
        High = 3,
    }
}
