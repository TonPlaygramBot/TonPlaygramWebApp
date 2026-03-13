using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// Dedicated capture volume behind mouth. Independent from jaw collision response.
    /// </summary>
    public class PocketCaptureZone : MonoBehaviour
    {
        [Header("Capture thresholds")]
        [SerializeField, Min(0f)] private float captureThreshold = 0.012f;
        [SerializeField, Min(0f)] private float minimumCaptureDepth = 0.018f;
        [SerializeField, Range(0f, 90f)] private float rejectionAngleTolerance = 65f;
        [SerializeField, Min(0f)] private float cleanCaptureSpeedThreshold = 1.8f;
        [SerializeField] private bool commitOnCapture = true;

        [Header("Fallback tuning")]
        [SerializeField, Range(0f, 1f)] private float fastGlanceRejectionChance = 0.5f;

        public float CaptureThreshold => captureThreshold;
        public float MinimumCaptureDepth => minimumCaptureDepth;
        public float RejectionAngleTolerance => rejectionAngleTolerance;
        public float CleanCaptureSpeedThreshold => cleanCaptureSpeedThreshold;
        public bool CommitOnCapture => commitOnCapture;
        public float FastGlanceRejectionChance => fastGlanceRejectionChance;
    }
}
