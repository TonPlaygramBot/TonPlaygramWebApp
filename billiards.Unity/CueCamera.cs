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
    // Optional reference to the initially targeted ball for the shot so the camera
    // can immediately frame the action around it.
    public Transform TargetBall;

    // Distance behind the ball in the normal overview.
    public float normalDistance = 1.45f;
    // Height of the camera above the table surface in the normal overview.
    public float normalHeight = 0.48f;
    // Distance and height when pulling the camera down for a close-up view.
    public float closeDistance = 0.55f;
    public float closeHeight = 0.33f;
    // Additional offsets applied while the action camera is following a shot.
    public float actionDistanceOffset = 0.1f;
    public float actionHeightOffset = 0f;
    // Rotation speed in degrees per second for horizontal mouse movement.
    public float rotationSpeed = 90f;
    // Speed at which the view blends between normal and close-up when dragging vertically.
    public float zoomSpeed = 2f;
    // Minimum squared velocity to consider a ball as moving.
    public float velocityThreshold = 0.01f;

    [Header("Shot view settings")]
    // Distance and height used when cutting to the targeted ball camera.
    public float targetViewDistance = 1.8f;
    public float targetViewHeight = 0.35f;
    // How quickly the camera aligns to the stored shot angle.
    public float shotSnapSpeed = 6f;
    // Speed used when returning to the player's standing view.
    public float returnSpeed = 3f;

    private float yaw;
    // Blend value: 0 for normal view, 1 for close-up view.
    private float viewBlend;
    // The ball the camera is currently following.
    private Transform currentBall;
    private bool shotInProgress;
    private bool usingTargetCamera;
    private float preShotYaw;
    private float preShotViewBlend;
    private float targetViewYaw;
    private Vector3 targetViewFocus;
    [Header("Occlusion settings")]
    // Layers that should be considered when preventing the camera from getting
    // blocked by level geometry (walls, scoreboards, etc.). Defaults to all
    // layers so it works out of the box.
    public LayerMask occluderLayers = ~0;
    // Radius used when checking for obstacles between the focus point and the
    // desired camera position. Keeps a small buffer so the camera doesn't clip
    // into geometry.
    public float collisionRadius = 0.08f;
    // Extra distance from an obstacle surface to place the camera when a hit is
    // detected.
    public float collisionBuffer = 0.05f;
    // Minimum height the camera should maintain above the table focus even when
    // pushed forward by a wall. Prevents sudden drops that could look jarring.
    public float minimumHeightAboveFocus = 0.05f;

    private Camera cachedCamera;

    /// <summary>
    /// Call this when the player takes a shot so the camera can cut to the
    /// targeted ball angle and hold that framing until the shot resolves.
    /// </summary>
    public void BeginShot(Transform target)
    {
        TargetBall = target;
        currentBall = CueBall;
        preShotYaw = yaw;
        preShotViewBlend = viewBlend;
        shotInProgress = true;
        usingTargetCamera = target != null;

        Vector3 forward = Quaternion.Euler(0f, yaw, 0f) * Vector3.forward;
        if (CueBall != null)
        {
            targetViewFocus = CueBall.position;
        }

        if (target != null && CueBall != null)
        {
            Vector3 dir = target.position - CueBall.position;
            dir.y = 0f;
            if (dir.sqrMagnitude > 0.0001f)
            {
                dir.Normalize();
                forward = dir;
            }
            targetViewFocus = target.position;
        }

        targetViewYaw = Mathf.Atan2(forward.x, forward.z) * Mathf.Rad2Deg;
        yaw = targetViewYaw;
        currentBall = usingTargetCamera && target != null ? target : CueBall;
    }

    private void Awake()
    {
        cachedCamera = GetComponent<Camera>();
    }

    private void LateUpdate()
    {
        if (CueBall == null)
        {
            return;
        }

        if (!shotInProgress)
        {
            HandlePlayerInput();
            ApplyStandardCamera();
            return;
        }

        if (usingTargetCamera)
        {
            UpdateTargetCamera();
        }
        else
        {
            UpdateStandingCameraDuringShot();
        }
    }

    private void HandlePlayerInput()
    {
        // Normal orbiting around the cue ball under player control.
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

        currentBall = CueBall;
    }

    private void UpdateTargetCamera()
    {
        if (TargetBall != null && TargetBall.gameObject.activeInHierarchy)
        {
            targetViewFocus = TargetBall.position;
            currentBall = TargetBall;
        }

        yaw = Mathf.LerpAngle(yaw, targetViewYaw, Time.deltaTime * shotSnapSpeed);

        ApplyCameraAt(targetViewFocus, targetViewDistance, targetViewHeight);

        bool targetSettled = TargetBall == null || !TargetBall.gameObject.activeInHierarchy || !IsMoving(TargetBall);
        if (!targetSettled)
        {
            return;
        }

        if (!CueBallInView())
        {
            usingTargetCamera = false;
            currentBall = CueBall;
            return;
        }

        if (!IsMoving(CueBall))
        {
            EndShot();
            ApplyStandardCamera();
        }
    }

    private void UpdateStandingCameraDuringShot()
    {
        currentBall = CueBall;
        yaw = Mathf.LerpAngle(yaw, preShotYaw, Time.deltaTime * returnSpeed);
        viewBlend = Mathf.MoveTowards(viewBlend, preShotViewBlend, Time.deltaTime * returnSpeed);

        float distance = Mathf.Lerp(normalDistance, closeDistance, viewBlend) + actionDistanceOffset;
        float height = Mathf.Max(0.05f, Mathf.Lerp(normalHeight, closeHeight, viewBlend) + actionHeightOffset);

        ApplyCameraAt(CueBall.position, distance, height);

        bool cueMoving = IsMoving(CueBall);
        bool targetMoving = TargetBall != null && IsMoving(TargetBall);
        if (!cueMoving && !targetMoving)
        {
            EndShot();
            ApplyStandardCamera();
        }
    }

    private void ApplyStandardCamera()
    {
        Transform focus = currentBall != null ? currentBall : CueBall;
        if (focus == null)
        {
            return;
        }

        float distance = Mathf.Lerp(normalDistance, closeDistance, viewBlend);
        float height = Mathf.Lerp(normalHeight, closeHeight, viewBlend);
        ApplyCameraAt(focus.position, distance, height);
    }

    private void ApplyCameraAt(Vector3 focusPosition, float distance, float height)
    {
        Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
        Vector3 forward = rotation * Vector3.forward;
        Vector3 desiredPosition = focusPosition - forward * distance + Vector3.up * height;
        Vector3 lookTarget = focusPosition + forward * 5f;

        // Prevent the camera from getting stuck behind walls or decorations by
        // nudging it toward the table if something blocks the line of sight.
        Vector3 focusOrigin = focusPosition + Vector3.up * minimumHeightAboveFocus;
        Vector3 toCamera = desiredPosition - focusOrigin;
        float maxDistance = toCamera.magnitude;

        if (maxDistance > 0.001f)
        {
            Vector3 dir = toCamera / maxDistance;
            RaycastHit hit;
            // SphereCast gives us a bit of padding so the camera doesn't sit
            // directly inside the collider and jitter.
            if (Physics.SphereCast(focusOrigin, collisionRadius, dir, out hit, maxDistance, occluderLayers, QueryTriggerInteraction.Ignore))
            {
                Vector3 adjustedPosition = hit.point - dir * collisionBuffer;
                adjustedPosition.y = Mathf.Max(adjustedPosition.y, focusPosition.y + minimumHeightAboveFocus);
                desiredPosition = adjustedPosition;
            }
        }

        transform.position = desiredPosition;
        transform.LookAt(lookTarget);
    }

    private void EndShot()
    {
        shotInProgress = false;
        usingTargetCamera = false;
        yaw = preShotYaw;
        viewBlend = preShotViewBlend;
        currentBall = CueBall;
        TargetBall = null;
    }

    private bool CueBallInView()
    {
        if (CueBall == null)
        {
            return false;
        }

        if (cachedCamera == null)
        {
            cachedCamera = GetComponent<Camera>();
        }

        Camera cam = cachedCamera != null ? cachedCamera : Camera.main;
        if (cam == null)
        {
            return false;
        }

        Vector3 viewport = cam.WorldToViewportPoint(CueBall.position);
        return viewport.z > 0f && viewport.x >= 0f && viewport.x <= 1f && viewport.y >= 0f && viewport.y <= 1f;
    }

    private bool IsMoving(Transform ball)
    {
        if (ball == null || !ball.gameObject.activeInHierarchy)
        {
            return false;
        }
        Rigidbody rb = ball.GetComponent<Rigidbody>();
        return rb != null && rb.velocity.sqrMagnitude > velocityThreshold;
    }
}
#endif
