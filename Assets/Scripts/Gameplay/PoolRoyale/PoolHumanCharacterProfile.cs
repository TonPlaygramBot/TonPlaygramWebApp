using UnityEngine;

namespace Aiming
{
    public enum PoolHumanCharacterId
    {
        MurlanRoyalPro = 0,
        ArtaGhostBall = 1,
        DardanFractional = 2,
        LiraContactPoint = 3,
        BesnikCtePivot = 4
    }

    public enum PoolHumanAimStyle
    {
        GhostBall,
        Fractional,
        ContactPoint,
        CtePivot,
        MonteCarloPattern
    }

    [System.Serializable]
    public struct PoolHumanCharacterProfile
    {
        public PoolHumanCharacterId id;
        public string displayName;
        public PoolHumanAimStyle aimStyle;
        [Range(0f, 1f)] public float skill01;
        [Range(0f, 1f)] public float aggressiveness01;
        [Range(0f, 1f)] public float positionPlay01;
        [Range(0f, 1f)] public float spinComfort01;
        [Range(0f, 1f)] public float safetyBias01;
        [Tooltip("Small realistic aim variation in degrees. Lower values behave like professional players.")]
        public float aimJitterDeg;
        [Tooltip("Negative values favor slight over-cutting on hard cut shots; positive values favor fuller hits.")]
        public float cutCompensation;
        [Tooltip("Pocket target lateral adjustment multiplier. Used to cheat the pocket like real players.")]
        public float pocketCheat01;
        [Tooltip("How long this character visually settles into stance before striking.")]
        public float preShotSettleSeconds;

        public static PoolHumanCharacterProfile GetPreset(PoolHumanCharacterId id)
        {
            switch (id)
            {
                case PoolHumanCharacterId.ArtaGhostBall:
                    return new PoolHumanCharacterProfile
                    {
                        id = id,
                        displayName = "Arta · Ghost Ball Pro",
                        aimStyle = PoolHumanAimStyle.GhostBall,
                        skill01 = 0.94f,
                        aggressiveness01 = 0.74f,
                        positionPlay01 = 0.82f,
                        spinComfort01 = 0.78f,
                        safetyBias01 = 0.24f,
                        aimJitterDeg = 0.38f,
                        cutCompensation = -0.16f,
                        pocketCheat01 = 0.84f,
                        preShotSettleSeconds = 0.56f
                    };
                case PoolHumanCharacterId.DardanFractional:
                    return new PoolHumanCharacterProfile
                    {
                        id = id,
                        displayName = "Dardan · Fractional Feel",
                        aimStyle = PoolHumanAimStyle.Fractional,
                        skill01 = 0.89f,
                        aggressiveness01 = 0.66f,
                        positionPlay01 = 0.76f,
                        spinComfort01 = 0.62f,
                        safetyBias01 = 0.34f,
                        aimJitterDeg = 0.55f,
                        cutCompensation = -0.08f,
                        pocketCheat01 = 0.66f,
                        preShotSettleSeconds = 0.64f
                    };
                case PoolHumanCharacterId.LiraContactPoint:
                    return new PoolHumanCharacterProfile
                    {
                        id = id,
                        displayName = "Lira · Contact Point",
                        aimStyle = PoolHumanAimStyle.ContactPoint,
                        skill01 = 0.86f,
                        aggressiveness01 = 0.48f,
                        positionPlay01 = 0.88f,
                        spinComfort01 = 0.56f,
                        safetyBias01 = 0.56f,
                        aimJitterDeg = 0.68f,
                        cutCompensation = 0.06f,
                        pocketCheat01 = 0.54f,
                        preShotSettleSeconds = 0.72f
                    };
                case PoolHumanCharacterId.BesnikCtePivot:
                    return new PoolHumanCharacterProfile
                    {
                        id = id,
                        displayName = "Besnik · CTE Pivot",
                        aimStyle = PoolHumanAimStyle.CtePivot,
                        skill01 = 0.9f,
                        aggressiveness01 = 0.7f,
                        positionPlay01 = 0.7f,
                        spinComfort01 = 0.68f,
                        safetyBias01 = 0.28f,
                        aimJitterDeg = 0.5f,
                        cutCompensation = -0.12f,
                        pocketCheat01 = 0.72f,
                        preShotSettleSeconds = 0.48f
                    };
                default:
                    return new PoolHumanCharacterProfile
                    {
                        id = PoolHumanCharacterId.MurlanRoyalPro,
                        displayName = "Murlan · Royal Pattern Pro",
                        aimStyle = PoolHumanAimStyle.MonteCarloPattern,
                        skill01 = 0.97f,
                        aggressiveness01 = 0.82f,
                        positionPlay01 = 0.94f,
                        spinComfort01 = 0.9f,
                        safetyBias01 = 0.18f,
                        aimJitterDeg = 0.25f,
                        cutCompensation = -0.2f,
                        pocketCheat01 = 0.95f,
                        preShotSettleSeconds = 0.52f
                    };
            }
        }

        public static PoolHumanCharacterProfile[] GetAllPresets()
        {
            return new[]
            {
                GetPreset(PoolHumanCharacterId.MurlanRoyalPro),
                GetPreset(PoolHumanCharacterId.ArtaGhostBall),
                GetPreset(PoolHumanCharacterId.DardanFractional),
                GetPreset(PoolHumanCharacterId.LiraContactPoint),
                GetPreset(PoolHumanCharacterId.BesnikCtePivot)
            };
        }
    }
}
