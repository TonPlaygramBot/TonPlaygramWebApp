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
    // Radius of the cue ball so the camera can stay above the top surface of
    // the cue stick as it rests on the cloth.
    public float cueBallRadius = 0.028575f;
    // Minimum distance the camera should maintain when hugging the table so the
    // framing ends up closer to the cue ball without drifting toward the butt of
    // the cue stick.
    public float minimumCueViewDistance = 1.34125f;
    // How far above the rails the camera is allowed to travel.
    public float maxHeightAboveTable = 2.05f;
    // Default distance of the camera from the table centre when fully raised to
    // provide a broad overview of the action.
    public float distanceFromCenter = 3.18f;
    // Minimum distance from the table centre allowed when the camera is pulled
    // down toward the rails for a closer look.
    public float minDistanceFromCenter = 1.85f;
    // Extra distance the camera is allowed to shed as it hugs the table so the
    // cue ball fills more of the view during low-angle aiming.
    public float lowHeightDistanceReduction = 0.465f;
    // Extra pullback applied when the camera is raised to its maximum height so
    // the player gets a slightly wider view while aiming.
    public float zoomOutWhenRaised = 0.23125f;
    // Buffer that keeps the camera just outside the rails even at the closest
    // zoom level.
    public float railBuffer = 0.0185f;
    // Slight height offset so the camera looks just above the table centre
    // to reduce the viewing angle and give a lower perspective.
    public float lookAtHeightOffset = 0.11f;
    // Extra upward offset applied to the camera's look target when the camera is
    // pulled down close to the cloth so the player can still see more of the
    // table surface instead of just the rails.
    public float lowHeightLookUpOffset = 0.12f;
    // When the camera moves close to the table corners pull back slightly so
    // the rails remain visible and aiming is easier.
    public float cornerXThreshold = 2.405f;
    public float cornerZThreshold = 1.2025f;
    public float cornerPullback = 0.4625f;
    // Range beyond the thresholds where the pullback gradually reaches the
    // maximum value.  This avoids a sudden jump in zoom when approaching a
    // corner and gives a smoother transition.
    public float cornerBlendRange = 0.37f;
    // Optional reference to the active player (usually the cue ball). When set,
    // corner pullback is based on the player's position instead of the camera
    // so that approaching a rail gives a better view of the shot.
    public Transform player;
    // How strongly the camera should favour the player's position as it drops
    // toward the cloth.  A value of 1 makes the camera fully orbit the player at
    // the lowest angle while 0 keeps the orbit centred on the table.
    public float lowHeightPlayerFocus = 0.75f;
    // Maximum fraction of the cue stick distance the camera is allowed to slide
    // toward the butt when hugging the table.  Keeping this below 1 ensures the
    // view settles closer to the middle of the cue instead of drifting all the
    // way to the plastic cap at the end of the stick.
    [Range(0f, 1f)]
    public float cueViewMaxCueDistanceRatio = 0.65f;

    private void LateUpdate()
    {
        // Clamp vertical movement so the camera never dips below the side rails
        // and doesn't fly too high above the table surface.
        Vector3 pos = transform.position;
        float minRailY = railTopY + Mathf.Max(0f, railClearance);
        float cueTopClearance = Mathf.Max(0f, cueStickHeightClearance);
        float cueRadius = Mathf.Max(0f, cueBallRadius);
        float cueStickMinY = player != null
            ? player.position.y + cueRadius + cueTopClearance
            : minRailY;
        float tableCueMinY = tableTopY + cueRadius + cueTopClearance;
        float minY = Mathf.Max(minRailY, cueStickMinY, tableCueMinY);
        float maxY = tableTopY + maxHeightAboveTable;
        pos.y = Mathf.Clamp(pos.y, minY, maxY);

        // As the camera is pulled downward toward the rails gradually move it
        // closer to the table for an intimate view, while raising the camera
        // pushes it back a little so more of the table stays in frame.
        float heightBlend = Mathf.InverseLerp(maxY, minY, pos.y);

        float minAllowedDistance = Mathf.Max(minDistanceFromCenter, Mathf.Max(cornerXThreshold, cornerZThreshold) + railBuffer);
        float cueViewDistance = Mathf.Max(minAllowedDistance - Mathf.Max(0f, lowHeightDistanceReduction), minimumCueViewDistance);
        float raisedDistance = Mathf.Max(minAllowedDistance, distanceFromCenter + zoomOutWhenRaised);
        float closeViewBlend = Mathf.SmoothStep(0f, 1f, heightBlend);
        float currentDistance = Mathf.Lerp(raisedDistance, cueViewDistance, closeViewBlend);

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
            float desiredFocus = Mathf.Clamp01(lowHeightPlayerFocus);
            float cueFocusBias = Mathf.SmoothStep(0f, 1f, heightBlend);
            focusBlend = Mathf.Clamp01(Mathf.Lerp(0f, desiredFocus, cueFocusBias));
            focusBlend = Mathf.Lerp(focusBlend, 1f, cueFocusBias);
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
        if (player != null)
        {
            Vector3 playerFlat = new Vector3(player.position.x, 0f, player.position.z);
            Vector3 cueAxis = pivotFlat - playerFlat;
            float cueSlide = Mathf.SmoothStep(0f, 1f, heightBlend);
            if (cueAxis.sqrMagnitude > 0.0001f && cueSlide > 0f)
            {
                Vector3 cueDir = cueAxis.normalized;
                float maxCueViewDistance = currentDistance;
                if (cueViewMaxCueDistanceRatio < 1f)
                {
                    float limitedDistance = Mathf.Lerp(
                        currentDistance,
                        currentDistance * Mathf.Max(0f, cueViewMaxCueDistanceRatio),
                        cueSlide);
                    maxCueViewDistance = Mathf.Min(maxCueViewDistance, limitedDistance);
                }
                Vector3 cueViewPos = playerFlat + cueDir * maxCueViewDistance;
                desiredFlat = Vector3.Lerp(desiredFlat, cueViewPos, cueSlide);
            }
        }
        pos = new Vector3(desiredFlat.x, pos.y, desiredFlat.z);

        transform.position = pos;

        // Maintain a slightly lower viewing angle by looking just above the table
        // centre rather than straight down at it. When the camera gets close to
        // the cloth subtly nudge the look target upward to keep more of the
        // playing field visible.
        float lookUpBias = Mathf.SmoothStep(0f, 1f, heightBlend);
        float extraLookUp = Mathf.Lerp(0f, Mathf.Max(0f, lowHeightLookUpOffset), lookUpBias);
        Vector3 tableFocus = new Vector3(0f, tableTopY + lookAtHeightOffset + extraLookUp, 0f);
        Vector3 lookTarget = tableFocus;
        if (player != null)
        {
            float focusHeight = Mathf.Max(
                tableTopY + lookAtHeightOffset,
                player.position.y + cueRadius + cueTopClearance);
            Vector3 playerFocus = new Vector3(
                player.position.x,
                focusHeight + extraLookUp,
                player.position.z);
            lookTarget = Vector3.Lerp(tableFocus, playerFocus, focusBlend);
        }

        transform.LookAt(lookTarget);
    }
}
#endif
