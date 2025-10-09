#if UNITY_5_3_OR_NEWER
using UnityEngine;

/// <summary>
/// Broadcast-oriented cue camera that stays locked to the short rails. The
/// pre-shot framing hugs the cloth from the player's chosen end of the table
/// while the moment a shot is triggered the view automatically cuts to the
/// opposite short rail to follow the action. The framing keeps the cue ball and
/// target in view without showing a standing orbit or aiming guide.
/// </summary>
public class CueCamera : MonoBehaviour
{
    // Reference to the cue ball the camera should follow.
    public Transform CueBall;
    // Optional reference to the initially targeted ball for the shot so the camera
    // can immediately frame the action around it.
    public Transform TargetBall;

    // Distance behind the ball when preparing a shot from the cue view.
    public float cueAimDistance = 0.7f;
    // Height of the camera above the table surface while aiming.
    public float cueAimHeight = 0.36f;
    // Distance and height for the short-rail broadcast view used once a shot begins.
    public float broadcastDistance = 1.05f;
    public float broadcastHeight = 0.5f;
    // Minimum squared velocity to consider a ball as moving.
    public float velocityThreshold = 0.01f;
    // How quickly the camera aligns to the stored shot angle.
    public float shotSnapSpeed = 6f;
    // Speed used when easing between cue and broadcast framing while balls roll.
    public float returnSpeed = 3f;
    // Choose which short rail the player view should favour before a shot begins.
    public bool startLookingTowardPositiveZ = true;

    private float yaw;
    // Blend value retained for compatibility with existing animation logic.
    private float viewBlend = 1f;
    // The ball the camera is currently following.
    private Transform currentBall;
    private bool shotInProgress;
    private bool usingTargetCamera;
    private float targetViewYaw;
    private Vector3 targetViewFocus;
    private int defaultShortRailSign = 1;
    private int cueAimSideSign = 1;
    private int broadcastSideSign = -1;
    private bool nextShotIsAi;
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
        shotInProgress = true;
        usingTargetCamera = target != null;

        int aimSide = nextShotIsAi ? -defaultShortRailSign : defaultShortRailSign;
        cueAimSideSign = aimSide;
        broadcastSideSign = -aimSide;

        Vector3 focus = CueBall != null ? CueBall.position : Vector3.zero;
        if (target != null && target.gameObject.activeInHierarchy)
        {
            focus = target.position;
            currentBall = target;
        }

        targetViewFocus = focus;
        targetViewYaw = GetShortRailYaw(broadcastSideSign);
        yaw = targetViewYaw;
        viewBlend = 1f;

        nextShotIsAi = false;
    }

    private void Awake()
    {
        cachedCamera = GetComponent<Camera>();
        defaultShortRailSign = startLookingTowardPositiveZ ? 1 : -1;
        cueAimSideSign = defaultShortRailSign;
        broadcastSideSign = -cueAimSideSign;
        yaw = GetShortRailYaw(cueAimSideSign);
        targetViewYaw = GetShortRailYaw(broadcastSideSign);
        currentBall = CueBall;
        viewBlend = 1f;
    }

    private void LateUpdate()
    {
        if (CueBall == null)
        {
            return;
        }

        if (!shotInProgress)
        {
            UpdateCueAimCamera();
            return;
        }

        if (usingTargetCamera)
        {
            UpdateTargetCamera();
        }
        else
        {
            UpdateBroadcastCamera();
        }
    }

    private void UpdateCueAimCamera()
    {
        if (CueBall == null)
        {
            return;
        }

        int desiredSide = nextShotIsAi ? -defaultShortRailSign : defaultShortRailSign;
        if (cueAimSideSign != desiredSide)
        {
            cueAimSideSign = desiredSide;
        }

        float desiredYaw = GetShortRailYaw(cueAimSideSign);
        yaw = Mathf.LerpAngle(yaw, desiredYaw, Time.deltaTime * returnSpeed);
        viewBlend = 1f;
        currentBall = CueBall;
        ApplyShortRailCamera(CueBall.position, cueAimDistance, cueAimHeight);
    }

    private void UpdateBroadcastCamera()
    {
        currentBall = CueBall;
        yaw = Mathf.LerpAngle(yaw, targetViewYaw, Time.deltaTime * shotSnapSpeed);
        ApplyShortRailCamera(CueBall.position, broadcastDistance, broadcastHeight);

        bool cueMoving = IsMoving(CueBall);
        bool targetMoving = TargetBall != null && IsMoving(TargetBall);
        if (!cueMoving && !targetMoving)
        {
            EndShot();
            UpdateCueAimCamera();
        }
    }

    public void SetNextShooterIsAi(bool value)
    {
        nextShotIsAi = value;
        if (!shotInProgress)
        {
            cueAimSideSign = nextShotIsAi ? -defaultShortRailSign : defaultShortRailSign;
            yaw = GetShortRailYaw(cueAimSideSign);
            ApplyStandardCamera();
        }
    }

    private void UpdateTargetCamera()
    {
        if (TargetBall != null && TargetBall.gameObject.activeInHierarchy)
        {
            targetViewFocus = TargetBall.position;
            currentBall = TargetBall;
        }

        yaw = Mathf.LerpAngle(yaw, targetViewYaw, Time.deltaTime * shotSnapSpeed);

        ApplyShortRailCamera(targetViewFocus, broadcastDistance, broadcastHeight);

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
            UpdateCueAimCamera();
        }
    }

    private void ApplyStandardCamera()
    {
        if (CueBall == null)
        {
            return;
        }

        ApplyShortRailCamera(CueBall.position, cueAimDistance, cueAimHeight);
    }

    private void ApplyShortRailCamera(Vector3 focusPosition, float distance, float height)
    {
        ApplyCameraAt(focusPosition, distance, height);

        Vector3 pos = transform.position;
        pos.x = 0f;
        transform.position = pos;

        Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
        Vector3 forward = rotation * Vector3.forward;
        Vector3 lookTarget = focusPosition + forward * 5f;
        transform.LookAt(lookTarget);
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
        currentBall = CueBall;
        TargetBall = null;
        cueAimSideSign = nextShotIsAi ? -defaultShortRailSign : defaultShortRailSign;
        broadcastSideSign = -cueAimSideSign;
        yaw = GetShortRailYaw(cueAimSideSign);
        targetViewYaw = GetShortRailYaw(broadcastSideSign);
        viewBlend = 1f;
    }

    private static float GetShortRailYaw(int sideSign)
    {
        return sideSign >= 0 ? 0f : 180f;
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
