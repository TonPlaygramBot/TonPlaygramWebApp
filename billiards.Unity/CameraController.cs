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
    // Maximum height the camera is allowed to move above the table.
    public float maxHeightAboveTable = 3f;
    // Desired distance of the camera from the table centre.
    public float distanceFromCenter = 8f;

    private void LateUpdate()
    {
        // Clamp vertical movement so the camera never goes below the table
        // and doesn't fly too high above it.
        Vector3 pos = transform.position;
        float minY = tableTopY;
        float maxY = tableTopY + maxHeightAboveTable;
        pos.y = Mathf.Clamp(pos.y, minY, maxY);

        // Pull the camera slightly closer to the table by keeping it at a
        // fixed distance from the origin (assumed table centre).
        Vector3 flatDir = new Vector3(pos.x, 0f, pos.z).normalized;
        pos = new Vector3(flatDir.x * distanceFromCenter,
                          pos.y,
                          flatDir.z * distanceFromCenter);

        transform.position = pos;
    }
}
#endif
