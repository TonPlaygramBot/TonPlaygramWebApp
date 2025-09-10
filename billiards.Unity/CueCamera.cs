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

    private float yaw;

    private void LateUpdate()
    {
        if (CueBall == null)
        {
            return;
        }

        // Accumulate horizontal mouse movement to orbit around the cue ball.
        yaw += Input.GetAxis("Mouse X") * rotationSpeed * Time.deltaTime;
        Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
        Vector3 offset = rotation * (Vector3.back * distance) + Vector3.up * height;
        transform.position = CueBall.position + offset;
        transform.LookAt(CueBall.position);
    }
}
#endif

