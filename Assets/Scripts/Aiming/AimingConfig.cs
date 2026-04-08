using UnityEngine;

namespace Aiming
{
    [CreateAssetMenu(fileName = "AimingConfig", menuName = "Aiming/Config")]
    public class AimingConfig : ScriptableObject
    {
        [Header("Angles (deg)")]
        public float straightAngleDeg = 5f;
        public float ctePivotDeg = 3f;

        [Header("Distances (m)")]
        public float shortDist = 0.8f;
        public float mediumDist = 1.6f;

        [Header("AI competitiveness")]
        [Tooltip("Offsets pocket targeting away from jaw collisions by aiming slightly inside the pocket entrance.")]
        public float pocketApproachDepth = 0.12f;
        [Tooltip("Cut-angle threshold that keeps the pocket target centered (straight pots).")]
        public float straightPocketCenterAngleDeg = 7f;
        [Tooltip("Cut-angle where jaw-guided targeting starts blending in.")]
        public float jawGuideStartAngleDeg = 12f;
        [Tooltip("Cut-angle where jaw-guided targeting reaches full lateral offset.")]
        public float jawGuideMaxAngleDeg = 50f;
        [Tooltip("Minimum lateral offset from pocket-center target used when jaw guidance is active.")]
        public float jawGuideOffsetMin = 0.01f;
        [Tooltip("Maximum lateral offset from pocket-center target used when jaw guidance is active.")]
        public float jawGuideOffsetMax = 0.028f;
        [Tooltip("Additional inward depth at steep cuts so the object ball line points deeper into the mouth entrance.")]
        public float pocketApproachExtraDepthMax = 0.02f;
        [Tooltip("Estimated half-width of a pocket mouth at the table entrance used for AI target clamping.")]
        public float pocketMouthHalfWidth = 0.06f;
        [Tooltip("Safety scale for ball radius when checking if there is enough entrance gap for a jaw-guided target.")]
        public float pocketBallClearanceRadiusScale = 1.08f;
        [Tooltip("Bias toward aiming at the far jaw side (away from first jaw impact) on cut shots.")]
        [Range(0f, 1f)] public float jawFarSideBias = 0.8f;
        [Tooltip("High-cut shots automatically increase far-jaw preference to avoid clipping the first jaw cut.")]
        [Range(0f, 1f)] public float jawFarSideAutoBias = 0.85f;
        [Tooltip("Keeps jaw-guided targets away from the first-jaw side by reserving part of the pocket mouth as a dead zone.")]
        [Range(0f, 0.95f)] public float jawNearSideDeadZoneRatio = 0.3f;
        [Tooltip("For corner pockets, minimum directional component toward each adjacent cushion axis; higher values avoid cushion-first lines.")]
        [Range(0f, 0.8f)] public float cornerPocketAxisTowardMin = 0.14f;
        [Tooltip("How strongly corner-pocket correction blends targets back toward center/deeper pocket when cushion-first risk is detected.")]
        [Range(0f, 1f)] public float cornerPocketSafetyBlend = 0.72f;
        [Tooltip("Rejects candidate aims where cue-to-contact line is significantly blocked.")]
        public float cuePathClearanceRadiusScale = 0.92f;
        [Tooltip("Penalty weight for harder cut angles so easier pots are preferred.")]
        public float cutAnglePenalty = 0.55f;
        [Tooltip("Penalty weight for long cue-ball travel.")]
        public float distancePenalty = 0.2f;
        [Tooltip("Enables Monte Carlo rollouts so AI picks aim lines with the best expected pot probability under noise.")]
        public bool enableMonteCarlo = true;
        [Tooltip("How many stochastic rollouts are simulated per candidate shot.")]
        [Range(8, 256)] public int monteCarloRollouts = 48;
        [Tooltip("Angular jitter in degrees used for Monte Carlo rollout perturbations.")]
        [Range(0f, 8f)] public float monteCarloAimJitterDeg = 1.35f;
        [Tooltip("Power jitter used for Monte Carlo rollout perturbations.")]
        [Range(0f, 0.4f)] public float monteCarloPowerJitter = 0.12f;
        [Tooltip("Blend between deterministic score (0) and Monte Carlo expected cost (1).")]
        [Range(0f, 1f)] public float monteCarloBlend = 0.7f;

        [Header("Spin")]
        public float sideSpinAmount = 0.35f;
        public float verticalSpinAmount = 0.35f;
        public float tipOffsetMax = 0.85f;
        public float elevationForPower = 4f;

        [Header("Debug")]
        public bool showDebugDefault = true;
        public Color lineColor = new Color(0.1f, 0.9f, 0.9f, 0.9f);
        public float lineWidth = 0.01f;

        [Header("Physics")]
        public LayerMask collisionMask;
    }
}
