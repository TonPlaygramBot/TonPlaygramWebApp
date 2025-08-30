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
