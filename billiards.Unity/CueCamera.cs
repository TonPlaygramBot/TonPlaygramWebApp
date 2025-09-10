#if UNITY_5_3_OR_NEWER
using UnityEngine;

/// <summary>
/// Simple orbital camera that stays behind the cue ball. Horizontal mouse
/// movement rotates the camera around the ball so the player can aim by moving
/// the camera rather than the aiming line.
/// </summary>
public class CueCamera : MonoBehaviour
{
    // Reference to the cue ball the camera should follow.
    public Transform CueBall;
    // Distance behind the cue ball.
    public float distance = 2f;
    // Height of the camera above the table surface.
    public float height = 0.5f;
    // Rotation speed in degrees per second for horizontal mouse movement.
    public float rotationSpeed = 90f;
    // Speed at which the camera zooms in/out when dragging vertically.
    public float zoomSpeed = 2f;
    // Minimum and maximum distance from the cue ball.
    public float minDistance = 1.5f;
    public float maxDistance = 3f;

    private float yaw;

    private void LateUpdate()
    {
        if (CueBall == null)
        {
            return;
        }

        // Accumulate horizontal mouse movement to orbit around the cue ball.
        yaw += Input.GetAxis("Mouse X") * rotationSpeed * Time.deltaTime;

        // Adjust distance based on vertical movement to provide a small zoom.
        float zoom = Input.GetAxis("Mouse Y") * zoomSpeed * Time.deltaTime;
        distance = Mathf.Clamp(distance + zoom, minDistance, maxDistance);

        Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
        Vector3 forward = rotation * Vector3.forward;
        transform.position = CueBall.position - forward * distance + Vector3.up * height;
        transform.LookAt(CueBall.position + forward * 5f);
    }
}
#endif

