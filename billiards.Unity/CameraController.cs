#if UNITY_5_3_OR_NEWER
using UnityEngine;

/// <summary>
/// Simple camera controller clamping the camera to stay above the table
/// and limiting how high it can travel.  The camera is also kept a fixed
/// distance from the table centre so it sits a little closer to the action.
/// </summary>
public class CameraController : MonoBehaviour
{
    // Y position of the top of the table in world space.
    public float tableTopY = 0f;
    // Height of the top of the wooden side rails in world space.  Slightly raised
    // to keep the camera from dipping too low relative to the table frame.
    public float railTopY = 0.33f;
    // Small clearance so the camera always remains a little above the side rails.
    // Increased slightly so the camera stops a bit sooner when moving down.
    public float railClearance = 0.08f;
    // How far above the rails the camera is allowed to travel.
    public float maxHeightAboveTable = 2.2f;
    // The closest distance the camera can zoom towards the centre.  Reduced
    // to allow a touch more zoom when the user pulls the camera down.
    public float minDistanceFromCenter = 5.2f;
    // Desired default distance of the camera from the table centre.
    public float distanceFromCenter = 6.5f;
    // Slight height offset so the camera looks just above the table centre
    // to reduce the viewing angle and give a lower perspective.
    public float lookAtHeightOffset = 0.05f;
    // When the camera moves close to the table corners pull back slightly so
    // the rails remain visible and aiming is easier.
    public float cornerXThreshold = 2.6f;
    public float cornerZThreshold = 1.3f;
    public float cornerPullback = 0.5f;

    private void LateUpdate()
    {
        // Clamp vertical movement so the camera never dips below the side rails
        // and doesn't fly too high above the table surface.
        Vector3 pos = transform.position;
        float minY = railTopY + railClearance;
        float maxY = tableTopY + maxHeightAboveTable;
        pos.y = Mathf.Clamp(pos.y, minY, maxY);

        // Determine how close the camera should zoom based on height.  When the
        // camera is pulled down towards the rails it gradually moves closer to
        // the centre, revealing the rails at the bottom of the screen.
        float t = Mathf.InverseLerp(maxY, minY, pos.y);
        float currentDistance = Mathf.Lerp(distanceFromCenter, minDistanceFromCenter, t);

        // If the camera is near a corner, increase the distance a little to
        // give the player a better view of the shot.
        if (Mathf.Abs(pos.x) > cornerXThreshold && Mathf.Abs(pos.z) > cornerZThreshold)
        {
            currentDistance += cornerPullback;
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
