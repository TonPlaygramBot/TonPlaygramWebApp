#if UNITY_5_3_OR_NEWER
using UnityEngine;

/// <summary>
/// Simple camera controller that keeps the camera above the table while
/// providing a slightly pulled back perspective. When the player drags the
/// camera down toward the rails the controller eases the view closer to the
/// cloth while ensuring the camera stays clear of the wooden frame. Pulling the
/// camera up gives a wider overview of the table.
/// </summary>
public class CameraController : MonoBehaviour
{
    // Y position of the top of the table in world space.
    public float tableTopY = 0f;
    // Height of the top of the wooden side rails in world space.  Slightly raised
    // to keep the camera from dipping too low relative to the table frame.
    public float railTopY = 0.33f;
    // Optional clearance so the camera can be kept slightly above the side rails
    // while still preventing it from dipping below their top surface.
    public float railClearance = 0.08f;
    // Extra clearance used when clamping the camera height so it always remains
    // above the cue stick and keeps the stick visible in frame.
    public float cueStickHeightClearance = 0.05f;
    // How far above the rails the camera is allowed to travel.
    public float maxHeightAboveTable = 1.9f;
    // Default distance of the camera from the table centre when fully raised to
    // provide a broad overview of the action.
    public float distanceFromCenter = 3.8f;
    // Minimum distance from the table centre allowed when the camera is pulled
    // down toward the rails for a closer look.
    public float minDistanceFromCenter = 2.15f;
    // Extra distance the camera is allowed to shed as it hugs the table so the
    // cue ball fills more of the view during low-angle aiming.
    public float lowHeightDistanceReduction = 0.45f;
    // Extra pullback applied when the camera is raised to its maximum height so
    // the player gets a slightly wider view while aiming.
    public float zoomOutWhenRaised = 0.25f;
    // Buffer that keeps the camera just outside the rails even at the closest
    // zoom level.
    public float railBuffer = 0.02f;
    // Slight height offset so the camera looks just above the table centre
    // to reduce the viewing angle and give a lower perspective.
    public float lookAtHeightOffset = 0.08f;
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
    // How strongly the camera should favour the player's position as it drops
    // toward the cloth.  A value of 1 makes the camera fully orbit the player at
    // the lowest angle while 0 keeps the orbit centred on the table.
    public float lowHeightPlayerFocus = 0.75f;

    private void LateUpdate()
    {
        // Clamp vertical movement so the camera never dips below the side rails
        // and doesn't fly too high above the table surface.
        Vector3 pos = transform.position;
        float minRailY = railTopY + Mathf.Max(0f, railClearance);
        float cueStickMinY = player != null
            ? player.position.y + Mathf.Max(0f, cueStickHeightClearance)
            : minRailY;
        float minY = Mathf.Max(minRailY, cueStickMinY);
        float maxY = tableTopY + maxHeightAboveTable;
        pos.y = Mathf.Clamp(pos.y, minY, maxY);

        // As the camera is pulled downward toward the rails gradually move it
        // closer to the table for an intimate view, while raising the camera
        // pushes it back a little so more of the table stays in frame.
        float heightBlend = Mathf.InverseLerp(maxY, minY, pos.y);

        float minAllowedDistance = Mathf.Max(minDistanceFromCenter, Mathf.Max(cornerXThreshold, cornerZThreshold) + railBuffer);
        float lowHeightDistance = Mathf.Max(minAllowedDistance - Mathf.Max(0f, lowHeightDistanceReduction), railBuffer + 0.1f);
        float raisedDistance = Mathf.Max(minAllowedDistance, distanceFromCenter + zoomOutWhenRaised);
        float currentDistance = Mathf.Lerp(raisedDistance, lowHeightDistance, heightBlend);

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

        Vector3 pivot = Vector3.zero;
        float focusBlend = 0f;
        if (player != null)
        {
            Vector3 playerFlat = new Vector3(player.position.x, 0f, player.position.z);
            focusBlend = Mathf.Clamp01(heightBlend * Mathf.Clamp01(lowHeightPlayerFocus));
            pivot = Vector3.Lerp(Vector3.zero, playerFlat, focusBlend);
        }

        Vector3 pivotFlat = new Vector3(pivot.x, 0f, pivot.z);
        Vector3 flatOffset = new Vector3(pos.x - pivotFlat.x, 0f, pos.z - pivotFlat.z);
        if (flatOffset.sqrMagnitude < 0.0001f)
        {
            Vector3 fallbackDir = new Vector3(transform.forward.x, 0f, transform.forward.z);
            if (fallbackDir.sqrMagnitude < 0.0001f)
            {
                fallbackDir = Vector3.forward;
            }

            flatOffset = -fallbackDir.normalized * currentDistance;
        }

        Vector3 flatDir = flatOffset.normalized;
        Vector3 desiredFlat = pivotFlat + flatDir * currentDistance;
        pos = new Vector3(desiredFlat.x, pos.y, desiredFlat.z);

        transform.position = pos;

        // Maintain a slightly lower viewing angle by looking just above the table
        // centre rather than straight down at it.
        Vector3 tableFocus = new Vector3(0f, tableTopY + lookAtHeightOffset, 0f);
        Vector3 lookTarget = tableFocus;
        if (player != null)
        {
            float focusHeight = Mathf.Max(tableTopY + lookAtHeightOffset, player.position.y + Mathf.Max(0f, cueStickHeightClearance));
            Vector3 playerFocus = new Vector3(player.position.x, focusHeight, player.position.z);
            lookTarget = Vector3.Lerp(tableFocus, playerFocus, focusBlend);
        }

        transform.LookAt(lookTarget);
    }
}
#endif
