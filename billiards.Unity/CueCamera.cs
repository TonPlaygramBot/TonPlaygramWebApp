#if UNITY_5_3_OR_NEWER
using UnityEngine;

/// <summary>
/// Simple orbital camera that stays behind the cue ball. Horizontal drag
/// rotates the camera around the ball so the player can aim by moving the
/// camera rather than the aiming line.  Pulling the view downward blends to a
/// close‑up shot of the cue ball, while dragging upward restores the normal
/// overview.  The camera always looks along the aiming line so it follows the
/// shot direction wherever the ball is on the table.
/// </summary>
public class CueCamera : MonoBehaviour
{
    // Reference to the cue ball the camera should follow.
    public Transform CueBall;
    // Distance behind the cue ball in the normal overview.
    public float normalDistance = 2f;
    // Height of the camera above the table surface in the normal overview.
    public float normalHeight = 0.5f;
    // Distance and height when pulling the camera down for a close-up view.
    public float closeDistance = 0.7f;
    public float closeHeight = 0.15f;
    // Rotation speed in degrees per second for horizontal mouse movement.
    public float rotationSpeed = 90f;
    // Speed at which the view blends between normal and close-up when dragging vertically.
    public float zoomSpeed = 2f;

    private float yaw;
    // Blend value: 0 for normal view, 1 for close-up view.
    private float viewBlend;

    private void LateUpdate()
    {
        if (CueBall == null)
        {
            return;
        }

        bool dragging = Input.GetMouseButton(0);

        // Support both mouse dragging and single‑finger touch.
        if (Input.touchCount == 1)
        {
            Touch t = Input.GetTouch(0);
            if (t.phase == TouchPhase.Moved)
            {
                Vector2 d = t.deltaPosition;
                yaw += d.x * rotationSpeed * Time.deltaTime * 0.1f;
                viewBlend = Mathf.Clamp01(viewBlend - d.y * zoomSpeed * Time.deltaTime * 0.01f);
            }
        }
        else if (dragging)
        {
            // Accumulate horizontal movement to orbit around the cue ball.
            yaw += Input.GetAxis("Mouse X") * rotationSpeed * Time.deltaTime;

            // Vertical dragging blends between the normal overview and a close‑up
            // shot.  Dragging down increases the blend; dragging up restores the
            // default view.
            float yInput = Input.GetAxis("Mouse Y");
            viewBlend = Mathf.Clamp01(viewBlend - yInput * zoomSpeed * Time.deltaTime);
        }

        float distance = Mathf.Lerp(normalDistance, closeDistance, viewBlend);
        float height = Mathf.Lerp(normalHeight, closeHeight, viewBlend);

        Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
        Vector3 forward = rotation * Vector3.forward;
        transform.position = CueBall.position - forward * distance + Vector3.up * height;
        // Look down the aiming line so the camera follows the shot direction.
        transform.LookAt(CueBall.position + forward * 5f);
    }
}
#endif

