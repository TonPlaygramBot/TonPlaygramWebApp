#if UNITY_5_3_OR_NEWER
using UnityEngine;

/// <summary>
/// Simple camera controller that keeps the camera above the table while
/// providing a slightly pulled back perspective. When the player drags the
/// camera down toward the rails the controller automatically increases the
/// distance from the table centre so that more of the playing surface remains
/// visible.
/// </summary>
public class CameraController : MonoBehaviour
{
    // Y position of the top of the table in world space.
    public float tableTopY = 0f;
    // Height of the top of the wooden side rails in world space.  Slightly raised
    // to keep the camera from dipping too low relative to the table frame.
    public float railTopY = 0.33f;
    // Small clearance so the camera always remains a little above the side rails.
    public float railClearance = 0.08f;
    // How far above the rails the camera is allowed to travel.
    public float maxHeightAboveTable = 2.2f;
    // Default distance of the camera from the table centre, pulled back slightly
    // for an improved overview.
    public float distanceFromCenter = 7f;
    // Additional pullback applied as the camera moves toward the rails.
    public float pullbackWhenLow = 0.8f;
    // Slight height offset so the camera looks just above the table centre
    // to reduce the viewing angle and give a lower perspective.
    public float lookAtHeightOffset = 0.05f;
    // When the camera moves close to the table corners pull back slightly so
    // the rails remain visible and aiming is easier.
    public float cornerXThreshold = 2.6f;
    public float cornerZThreshold = 1.3f;
    public float cornerPullback = 0.5f;
    // Range beyond the thresholds where the pullback gradually reaches the
    // maximum value.  This avoids a sudden jump in zoom when approaching a
    // corner and gives a smoother transition.
    public float cornerBlendRange = 0.4f;
    // Optional reference to the active player (usually the cue ball). When set,
    // corner pullback is based on the player's position instead of the camera
    // so that approaching a rail gives a better view of the shot.
    public Transform player;

    private void LateUpdate()
    {
        // Clamp vertical movement so the camera never dips below the side rails
        // and doesn't fly too high above the table surface.
        Vector3 pos = transform.position;
        float minY = railTopY + railClearance;
        float maxY = tableTopY + maxHeightAboveTable;
        pos.y = Mathf.Clamp(pos.y, minY, maxY);

        // Increase the viewing distance slightly as the camera is pulled down
        // to keep more of the table in view.
        float t = Mathf.InverseLerp(maxY, minY, pos.y);
        float currentDistance = distanceFromCenter + pullbackWhenLow * t;

        // If the player (or the camera if no player reference is set) moves
        // close to a corner, increase the distance a little to give a clearer
        // overview of the rails.
        Vector3 cornerPos = player != null ? player.position : pos;
        if (Mathf.Abs(cornerPos.x) > cornerXThreshold && Mathf.Abs(cornerPos.z) > cornerZThreshold)
        {
            float xFactor = Mathf.InverseLerp(cornerXThreshold, cornerXThreshold + cornerBlendRange, Mathf.Abs(cornerPos.x));
            float zFactor = Mathf.InverseLerp(cornerZThreshold, cornerZThreshold + cornerBlendRange, Mathf.Abs(cornerPos.z));
            float blend = Mathf.Min(xFactor, zFactor);
            currentDistance += cornerPullback * Mathf.Clamp01(blend);
        }

        // Keep the camera at a fixed distance from the origin (assumed table
        // centre) while applying the calculated zoom factor.
        Vector3 flatDir = new Vector3(pos.x, 0f, pos.z).normalized;
        pos = new Vector3(flatDir.x * currentDistance,
                          pos.y,
                          flatDir.z * currentDistance);

        transform.position = pos;

        // Maintain a slightly lower viewing angle by looking just above the table
        // centre rather than straight down at it.
        Vector3 lookTarget = new Vector3(0f, tableTopY + lookAtHeightOffset, 0f);
        transform.LookAt(lookTarget);
    }
}
#endif
