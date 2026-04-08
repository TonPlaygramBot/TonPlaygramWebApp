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
        [Tooltip("Rejects candidate aims where cue-to-contact line is significantly blocked.")]
        public float cuePathClearanceRadiusScale = 0.92f;
        [Tooltip("Penalty weight for harder cut angles so easier pots are preferred.")]
        public float cutAnglePenalty = 0.55f;
        [Tooltip("Penalty weight for long cue-ball travel.")]
        public float distancePenalty = 0.2f;

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
