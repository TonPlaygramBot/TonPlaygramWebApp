#if UNITY_5_3_OR_NEWER
using UnityEngine;

/// <summary>
/// Adapter that reuses the snooker cue camera logic for Pool Royale while
/// keeping the original distance-from-table and vertical travel limits.
/// </summary>
[RequireComponent(typeof(CueCamera))]
public class CameraController : MonoBehaviour
{
    [Header("Table setup")]
    [Tooltip("Y position of the top of the table in world space.")]
    public float tableTopY = 0f;

    [Tooltip("Height of the top of the wooden side rails in world space.")]
    public float railTopY = 0.33f;

    [Tooltip("Extra clearance to keep the camera slightly above the rails.")]
    public float railClearance = 0.08f;

    [Header("Legacy Pool Royale distances")]
    [Tooltip("Maximum height above the table the legacy camera allowed.")]
    public float maxHeightAboveTable = 1.9f;

    [Tooltip("Default distance of the camera from the table centre when fully raised.")]
    public float distanceFromCenter = 3.8f;

    [Tooltip("Closest distance from the table centre when the camera was pulled down.")]
    public float minDistanceFromCenter = 2.15f;

    private CueCamera cueCamera;

    private void Awake()
    {
        cueCamera = GetComponent<CueCamera>();
        ApplyOverrides();
    }

    private void OnValidate()
    {
        if (cueCamera == null)
        {
            cueCamera = GetComponent<CueCamera>();
        }

        ApplyOverrides();
    }

    /// <summary>
    /// Push the Pool Royale limits into the shared cue camera so the distance and
    /// vertical travel match the previous behaviour.
    /// </summary>
    private void ApplyOverrides()
    {
        if (cueCamera == null)
        {
            return;
        }

        // Ensure the cue camera respects the old vertical range by clamping the
        // raised height and maintaining a minimum clearance above the rails.
        float raisedHeight = tableTopY + Mathf.Max(0f, maxHeightAboveTable);
        float railHeight = Mathf.Max(railTopY, tableTopY);
        cueCamera.railHeight = railHeight;
        cueCamera.railClearance = Mathf.Max(0f, railClearance);
        cueCamera.cueRaisedHeight = raisedHeight;
        cueCamera.cueLoweredHeight = Mathf.Min(cueCamera.cueLoweredHeight, raisedHeight);

        // Preserve the legacy distancing by mapping the previous centre distances
        // onto the cue and broadcast framing ranges.
        float clampedMin = Mathf.Max(0.01f, minDistanceFromCenter);
        float clampedMax = Mathf.Max(clampedMin, distanceFromCenter);

        cueCamera.cueRaisedDistanceFromBall = clampedMax;
        cueCamera.cueLoweredDistanceFromBall = Mathf.Min(cueCamera.cueLoweredDistanceFromBall, clampedMax);
        cueCamera.broadcastDistance = distanceFromCenter;
        cueCamera.broadcastMinDistance = clampedMin;
        cueCamera.broadcastMaxDistance = Mathf.Max(cueCamera.broadcastMaxDistance, clampedMax);
    }
}
#endif
