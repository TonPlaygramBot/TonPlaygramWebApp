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
    // Optional reference placed near the butt of the cue so the aiming view can
    // infer which way the stick is pointing.  When supplied the camera blends
    // toward that axis while staying in front of the plastic butt cap.
    public Transform CueButtReference;
    // Optional list of every ball on the table so the broadcast view keeps
    // the full rolling action inside the frame.
    public Transform[] Balls;

    [Header("Cue aim view")]
    // Distance from the cue ball when the camera is fully raised above the cue.
    public float cueRaisedDistanceFromBall = 0.74f;
    // Distance from the cue ball used for the lowest aiming view.  This keeps the
    // camera hovering over the mid–upper portion of the cue rather than slipping
    // all the way back to the plastic end.
    public float cueLoweredDistanceFromBall = 0.06f;
    // Additional pull-in applied to the cue camera so the portrait framing hugs
    // the cloth like a player leaning over the shot.
    public float cueDistancePullIn = 0.48f;
    // Minimum separation we allow once the pull-in is applied. Prevents the
    // camera from intersecting the cue or cloth when the player drops in tight.
    public float cueMinimumDistance = 0.02f;
    // Height the cue view should reach when the player lifts the camera.
    public float cueRaisedHeight = 0.92f;
    // Extra padding applied when the player lifts the camera so the frame has
    // a little more breathing room above the shaft while keeping the cue in
    // view.
    public float cueRaisedHeightPadding = 0.05f;
    // Minimum height maintained when the player drops the camera toward the cue.
    public float cueLoweredHeight = 0.3f;
    // Extra forward push applied as the player lowers the camera so the framing
    // stays tight on the cue ball and shaft instead of drifting backward.
    public float cueLoweredForwardPush = 0.08f;
    // Keep a small safety buffer from the butt of the cue so the camera never
    // retreats past the stick and always looks down the shaft.
    public float cueButtClearance = 0.12f;
    // Extra clearance to ensure the camera stays above the cue stick.
    public float cueHeightClearance = 0.05f;
    // Limit how far toward the butt end the camera can travel as it lowers.
    // Keeps the framing over the upper half of the cue rather than drifting to
    // the plastic cap.
    [Range(0.1f, 1f)]
    public float cueBackFraction = 0.32f;
    // When the camera is fully lowered we further tighten the clamp so that the
    // framing slides forward along the cue toward the cue ball instead of
    // lingering near the butt.
    [Range(0.05f, 1f)]
    public float cueLoweredBackFraction = 0.18f;
    // Radius of the cue ball so the aiming view can remain above the cloth while
    // gliding toward the shot.
    public float cueBallRadius = 0.028575f;
    // Slight vertical offset applied to the look target so the cue ball remains
    // comfortably framed in portrait view.
    public float cueBallLookOffset = 0.02f;
    // How quickly the aiming axis aligns to the current cue direction.
    public float cueAxisSmoothSpeed = 6f;
    // Field of view used when the camera is fully raised above the cue.
    public float cueRaisedFieldOfView = 60f;
    // Field of view target when the camera is fully lowered toward the cue.
    public float cueLoweredFieldOfView = 52f;
    // Speed applied when easing the cue zoom toward the desired field of view.
    public float cueAimZoomSmoothSpeed = 8f;
    // Default blend used when the camera is first enabled. 0 keeps the camera
    // high above the cue, 1 drops it to the closest permitted view.
    [Range(0f, 1f)]
    public float defaultCueAimLowering = 0.35f;

    [Header("Cue aim framing")]
    // Scale applied to the cue distance when the camera is raised. Values below
    // 1 slide the camera closer to the cloth even before the player lowers it.
    [Range(0.1f, 1f)]
    public float cueRaisedDistanceScale = 0.85f;
    // Scale applied once the camera is fully lowered toward the cue. Lower
    // values bring the framing tighter to the cue ball and aiming line.
    [Range(0.1f, 1f)]
    public float cueLoweredDistanceScale = 0.5f;
    // Bias used when lowering the camera to keep it hovering just above the cue
    // instead of drifting upward toward the player's face.
    [Range(0.1f, 1f)]
    public float cueHeightClothScale = 0.65f;
    // Weight controlling how much of the look target should favour the aiming
    // line (0) versus the cue butt (1). Lower values keep the focus locked on
    // the target ball.
    [Range(0f, 1f)]
    public float cueAimLineFocusWeight = 0.4f;
    // Base overshoot distance applied past the aim end so the guiding line stays
    // visible and centred when framing the shot.
    public float cueAimTargetOvershoot = 0.18f;
    // Look distance fraction used when the camera is fully raised. Keeps the
    // look target anchored closer to the object ball instead of the cue butt.
    [Range(0f, 1f)]
    public float cueAimLookFraction = 0.85f;
    // Height bias for the look target when the camera is raised. Larger values
    // lift the view toward the rails, smaller values hug the cloth.
    [Range(0f, 1f)]
    public float cueAimHeightFocus = 0.55f;

    [Header("Table & rails")]
    // Height of the wooden rails so we can clamp the camera above them.
    public float railHeight = 0.33f;
    // Extra clearance over the rails to avoid clipping.
    public float railClearance = 0.02f;

    [Header("Broadcast view")]
    // Distance and height for the short-rail broadcast view used once a shot begins.
    public float broadcastDistance = 0.97125f;
    public float broadcastHeight = 0.5f;
    // Bounds that encompass the full playing surface including rails and pockets.
    public Bounds tableBounds = new Bounds(new Vector3(0f, 0.36f, 0f), new Vector3(1.64465f, 0.72f, 3.301325f));
    // Keep a small margin inside the camera frame so the rails never touch the
    // edge of the screen during broadcast shots.
    [Range(0f, 0.25f)]
    public float broadcastSafeMargin = 0.05f;
    // Minimum and maximum camera offsets used while fitting the table inside the
    // broadcast frame. The solver expands toward the max until every corner is
    // visible.
    public float broadcastMinDistance = 1.11f;
    public float broadcastMaxDistance = 5.0875f;
    // Blend between the table centre and the active focus (cue ball or target)
    // when aiming the broadcast view. Keeps the play interesting while still
    // framing the entire table.
    [Range(0f, 1f)]
    public float broadcastFocusBias = 0.35f;
    // Additional height applied when the broadcast camera needs to rise to keep
    // the far short rail within frame.
    public float broadcastHeightPadding = 0.08f;
    // Minimum squared velocity to consider a ball as moving.
    public float velocityThreshold = 0.01f;
    // How quickly the camera aligns to the stored shot angle.
    public float shotSnapSpeed = 6f;
    // Speed used when easing between cue and broadcast framing while balls roll.
    public float returnSpeed = 3f;
    // Choose which short rail the player view should favour before a shot begins.
    public bool startLookingTowardPositiveZ = true;

    private float yaw;
    // Blend controlling how far the cue view slides toward the cue ball. 0 keeps
    // the camera raised, 1 hugs the cue for a tight aiming angle.
    private float cueAimLowering;
    private Vector3 cueAimForward = Vector3.forward;
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

    /// <summary>Adjust the cue aiming blend (0 = raised, 1 = closest view).</summary>
    public void SetCueAimLowering(float value)
    {
        cueAimLowering = Mathf.Clamp01(value);
    }

    private Vector3 GetInitialCueForward()
    {
        if (CueBall == null)
        {
            return Vector3.forward;
        }

        Vector3 axis = GetCueAxis();
        if (axis.sqrMagnitude < 0.0001f)
        {
            return Vector3.forward;
        }

        return axis.normalized;
    }

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

        Vector3 focus = CueBall != null ? CueBall.position : tableBounds.center;
        targetViewFocus = GetBroadcastFocus(focus);
        if (target != null && target.gameObject.activeInHierarchy)
        {
            currentBall = target;
            targetViewFocus = GetBroadcastFocus(target.position);
        }
        targetViewYaw = GetShortRailYaw(broadcastSideSign);
        yaw = targetViewYaw;

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
        cueAimLowering = Mathf.Clamp01(defaultCueAimLowering);
        cueAimForward = GetInitialCueForward();
        targetViewFocus = GetBroadcastFocus(CueBall != null ? CueBall.position : tableBounds.center);
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
        PositionCueAimCamera(Time.deltaTime, false);
    }

    private void PositionCueAimCamera(float deltaTime, bool immediate)
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

        Vector3 desiredForward = GetCueAxis();
        if (desiredForward.sqrMagnitude < 0.0001f)
        {
            Quaternion fallback = Quaternion.Euler(0f, GetShortRailYaw(cueAimSideSign), 0f);
            desiredForward = fallback * Vector3.forward;
        }

        desiredForward.y = 0f;
        if (desiredForward.sqrMagnitude < 0.0001f)
        {
            desiredForward = Vector3.forward;
        }
        desiredForward = desiredForward.normalized;

        if (immediate)
        {
            cueAimForward = desiredForward;
        }
        else
        {
            float smoothFactor = Mathf.Clamp01(deltaTime * Mathf.Max(0f, cueAxisSmoothSpeed));
            cueAimForward = Vector3.Slerp(cueAimForward, desiredForward, smoothFactor);
            if (cueAimForward.sqrMagnitude < 0.0001f)
            {
                cueAimForward = desiredForward;
            }
        }

        cueAimForward = cueAimForward.normalized;

        float blend = Mathf.Clamp01(cueAimLowering);
        float minimumDistanceLimit = Mathf.Max(0.0001f, cueMinimumDistance);
        float tipStopDistance = Mathf.Max(minimumDistanceLimit, cueBallRadius + cueMinimumDistance);
        float minDistance = Mathf.Max(minimumDistanceLimit, cueLoweredDistanceFromBall);
        if (blend > 0f)
        {
            minDistance = Mathf.Min(minDistance, tipStopDistance);
        }
        float maxDistance = Mathf.Max(minDistance, cueRaisedDistanceFromBall);

        Vector3 cueSamplePoint;
        float baseDistance = ResolveCueAimDistance(blend, cueAimForward, minDistance, maxDistance, out cueSamplePoint);

        float pullIn = Mathf.Max(0f, cueDistancePullIn);
        float minPulledDistance = Mathf.Max(minimumDistanceLimit, minDistance - pullIn);
        float distance = Mathf.Max(baseDistance - pullIn, minPulledDistance);

        if (blend > 0f)
        {
            distance = Mathf.Lerp(distance, tipStopDistance, blend);
            distance = Mathf.Max(distance, minPulledDistance);
        }

        float raisedScale = Mathf.Clamp(cueRaisedDistanceScale, 0.1f, 1f);
        float loweredScale = Mathf.Clamp(cueLoweredDistanceScale, 0.1f, raisedScale);
        float distanceScale = Mathf.Lerp(raisedScale, loweredScale, blend);
        distance = Mathf.Max(distance * distanceScale, minimumDistanceLimit);

        float forwardPush = Mathf.Lerp(0f, Mathf.Max(0f, cueLoweredForwardPush), blend);
        distance = Mathf.Max(distance - forwardPush, minimumDistanceLimit);

        cueSamplePoint = ComputeCueSamplePoint(distance, cueAimForward, cueSamplePoint);

        if (CueBall != null)
        {
            Vector3 tipAnchor = CueBall.position - cueAimForward * tipStopDistance;
            tipAnchor.y = cueSamplePoint.y;
            cueSamplePoint = Vector3.Lerp(cueSamplePoint, tipAnchor, blend);
        }

        if (CueBall != null)
        {
            float aimLineHeight = CueBall.position.y + cueBallRadius;
            cueSamplePoint.y = Mathf.Max(cueSamplePoint.y, aimLineHeight);
        }

        float cueSurfaceHeight = CueBall.position.y + cueBallRadius;
        float minimumCueHeight = cueSurfaceHeight + Mathf.Max(0f, cueHeightClearance);
        minimumCueHeight = Mathf.Max(minimumCueHeight, cueSamplePoint.y + Mathf.Max(0f, cueHeightClearance));

        float raisedHeight = Mathf.Max(minimumCueHeight, cueRaisedHeight + Mathf.Max(0f, cueRaisedHeightPadding));
        float loweredHeight = Mathf.Max(minimumCueHeight, cueLoweredHeight);
        float height = Mathf.Lerp(raisedHeight, loweredHeight, blend);
        float clothAnchorHeight = minimumCueHeight;
        float heightScale = Mathf.Lerp(1f, Mathf.Clamp(cueHeightClothScale, 0.1f, 1f), blend);
        height = clothAnchorHeight + (height - clothAnchorHeight) * heightScale;
        float minRailHeight = railHeight + Mathf.Max(0f, railClearance);
        height = Mathf.Max(height, minRailHeight);
        height = Mathf.Max(height, cueSurfaceHeight + Mathf.Max(0f, cueHeightClearance));

        Vector3 focus = CueBall.position;
        float minimumHeightOffset = Mathf.Max(minimumHeightAboveFocus, height - focus.y);
        Vector3 lookTarget = GetCueAimLookTarget(focus, cueAimForward);

        ApplyCueAimZoom(blend, deltaTime);
        ApplyCameraAt(focus, cueAimForward, distance, height, minimumHeightOffset, lookTarget);

        Vector3 flatForward = new Vector3(cueAimForward.x, 0f, cueAimForward.z);
        if (flatForward.sqrMagnitude > 0.0001f)
        {
            yaw = Mathf.Atan2(flatForward.x, flatForward.z) * Mathf.Rad2Deg;
        }

        currentBall = CueBall;
    }

    private Vector3 GetCueAxis()
    {
        if (CueBall == null)
        {
            return Vector3.forward;
        }

        if (CueButtReference != null)
        {
            Vector3 axis = CueBall.position - CueButtReference.position;
            axis.y = 0f;
            if (axis.sqrMagnitude > 0.0001f)
            {
                return axis;
            }
        }

        if (TargetBall != null && TargetBall.gameObject.activeInHierarchy)
        {
            Vector3 axis = CueBall.position - TargetBall.position;
            axis.y = 0f;
            if (axis.sqrMagnitude > 0.0001f)
            {
                return axis;
            }
        }

        Quaternion fallback = Quaternion.Euler(0f, GetShortRailYaw(cueAimSideSign), 0f);
        return fallback * Vector3.forward;
    }

    private float ResolveCueAimDistance(
        float blend,
        Vector3 forward,
        float minDistance,
        float maxDistance,
        out Vector3 cueSamplePoint)
    {
        float fractionBlend = Mathf.Clamp01(blend);
        float upperFraction = Mathf.Clamp01(cueBackFraction);
        float loweredFraction = Mathf.Clamp01(cueLoweredBackFraction);
        if (loweredFraction > upperFraction)
        {
            loweredFraction = upperFraction;
        }

        float distance = Mathf.Lerp(maxDistance, minDistance, fractionBlend);
        cueSamplePoint = CueBall != null ? CueBall.position : Vector3.zero;

        if (CueBall == null)
        {
            return distance;
        }

        Vector3 cuePoint = CueBall.position;

        if (CueButtReference != null)
        {
            Vector3 buttToBall = CueBall.position - CueButtReference.position;
            float projectedLength = Mathf.Abs(Vector3.Dot(buttToBall, forward));
            if (projectedLength > 0.0001f)
            {
                float buttClearance = Mathf.Max(0f, cueButtClearance);
                float usableLength = Mathf.Max(0f, projectedLength - buttClearance);
                float fraction = Mathf.Lerp(upperFraction, loweredFraction, fractionBlend);
                float limitDistance = Mathf.Lerp(usableLength, usableLength * fraction, fractionBlend);
                limitDistance = Mathf.Clamp(limitDistance, 0f, usableLength);

                float minClamp = usableLength >= minDistance ? Mathf.Min(minDistance, limitDistance) : 0f;
                float maxClamp = Mathf.Max(limitDistance, minClamp);
                distance = Mathf.Clamp(distance, minClamp, maxClamp);
                if (limitDistance < minClamp)
                {
                    distance = limitDistance;
                }
                else
                {
                    distance = Mathf.Min(distance, limitDistance);
                }

                float along = projectedLength > 0.0001f ? Mathf.Clamp01(distance / projectedLength) : 0f;
                cuePoint = Vector3.Lerp(CueBall.position, CueButtReference.position, along);

                cueSamplePoint = cuePoint;
                return Mathf.Max(distance, 0f);
            }
        }

        float fallbackLength = Mathf.Max(maxDistance, minDistance);
        float fallbackFraction = Mathf.Lerp(upperFraction, loweredFraction, fractionBlend);
        float fallbackLimit = Mathf.Lerp(fallbackLength, fallbackLength * fallbackFraction, fractionBlend);
        fallbackLimit = Mathf.Clamp(fallbackLimit, 0f, fallbackLength);
        float fallbackMin = Mathf.Min(minDistance, fallbackLimit);
        distance = Mathf.Clamp(distance, fallbackMin, Mathf.Max(fallbackLimit, fallbackMin));
        if (fallbackLimit < fallbackMin)
        {
            distance = fallbackLimit;
        }
        else
        {
            distance = Mathf.Min(distance, fallbackLimit);
        }

        cuePoint = CueBall.position - forward * Mathf.Max(distance, 0f);
        cuePoint.y = CueBall.position.y;
        cueSamplePoint = cuePoint;

        return Mathf.Max(distance, 0f);
    }

    private Vector3 ComputeCueSamplePoint(float distance, Vector3 forward, Vector3 fallback)
    {
        if (CueBall == null)
        {
            return fallback;
        }

        Vector3 sample = fallback;
        Vector3 cuePosition = CueBall.position;

        if (forward.sqrMagnitude < 0.0001f)
        {
            forward = Vector3.forward;
        }
        forward = forward.normalized;

        if (CueButtReference != null)
        {
            Vector3 buttToBall = cuePosition - CueButtReference.position;
            float projectedLength = Mathf.Abs(Vector3.Dot(buttToBall, forward));
            if (projectedLength > 0.0001f)
            {
                float along = Mathf.Clamp01(distance / projectedLength);
                sample = Vector3.Lerp(cuePosition, CueButtReference.position, along);
                sample.y = cuePosition.y;
                return sample;
            }
        }

        sample = cuePosition - forward * Mathf.Max(distance, 0f);
        sample.y = cuePosition.y;
        return sample;
    }

    private void ApplyCueAimZoom(float loweringBlend, float deltaTime)
    {
        if (cachedCamera == null)
        {
            cachedCamera = GetComponent<Camera>();
        }

        Camera cam = cachedCamera != null ? cachedCamera : Camera.main;
        if (cam == null)
        {
            return;
        }

        float raisedFov = Mathf.Clamp(cueRaisedFieldOfView, 10f, 120f);
        float targetFov = raisedFov;

        float smoothSpeed = Mathf.Max(0f, cueAimZoomSmoothSpeed);
        if (deltaTime <= 0f || smoothSpeed <= 0f)
        {
            cam.fieldOfView = targetFov;
            return;
        }

        float t = 1f - Mathf.Exp(-smoothSpeed * deltaTime);
        cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, targetFov, t);
    }

    private void UpdateBroadcastCamera()
    {
        currentBall = CueBall;
        yaw = Mathf.LerpAngle(yaw, targetViewYaw, Time.deltaTime * shotSnapSpeed);
        Vector3 focus = CueBall != null ? CueBall.position : tableBounds.center;
        ApplyBroadcastCamera(GetBroadcastFocus(focus));

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
            targetViewFocus = GetBroadcastFocus(TargetBall.position);
            currentBall = TargetBall;
        }

        yaw = Mathf.LerpAngle(yaw, targetViewYaw, Time.deltaTime * shotSnapSpeed);

        ApplyBroadcastCamera(targetViewFocus);

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

        PositionCueAimCamera(0f, true);
    }

    private Vector3 GetBroadcastFocus(Vector3 desired)
    {
        Vector3 centre = tableBounds.center;
        float bias = Mathf.Clamp01(broadcastFocusBias);
        desired.y = Mathf.Max(desired.y, centre.y);
        Vector3 focus = Vector3.Lerp(centre, desired, bias);
        focus.y = Mathf.Max(focus.y, centre.y);
        return focus;
    }

    private void ApplyBroadcastCamera(Vector3 focus)
    {
        Camera cam = cachedCamera != null ? cachedCamera : GetComponent<Camera>();
        if (cam == null)
        {
            cam = Camera.main;
            if (cam == null)
            {
                return;
            }
        }

        float minRailHeight = railHeight + Mathf.Max(0f, railClearance);
        float baseHeight = Mathf.Max(broadcastHeight, focus.y + minimumHeightAboveFocus);
        float height = Mathf.Max(baseHeight + Mathf.Max(0f, broadcastHeightPadding), minRailHeight);

        Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
        Vector3 forward = rotation * Vector3.forward;

        Bounds broadcastBounds = GetBroadcastBounds(focus);
        focus.x = 0f;
        focus.z = broadcastBounds.center.z;

        float distance = ComputeBroadcastDistance(focus, height, forward, cam, broadcastBounds);
        float minimumHeightOffset = Mathf.Max(minimumHeightAboveFocus, height - focus.y);
        Vector3 lookTarget = focus + Vector3.up * Mathf.Max(0f, broadcastHeightPadding);

        ApplyShortRailCamera(focus, forward, distance, height, minimumHeightOffset, lookTarget);
    }

    private Bounds GetBroadcastBounds(Vector3 focus)
    {
        float minHalfLength = tableBounds.extents.z * 0.5f;
        float zRange = Mathf.Max(0f, tableBounds.extents.z - minHalfLength);
        float clampedZ = Mathf.Clamp(focus.z, tableBounds.center.z - zRange, tableBounds.center.z + zRange);
        Bounds baseBounds = new Bounds(
            new Vector3(0f, tableBounds.center.y, clampedZ),
            new Vector3(tableBounds.size.x, tableBounds.size.y, minHalfLength * 2f)
        );

        Bounds movingBounds;
        if (!TryGetMovingBounds(out movingBounds))
        {
            return baseBounds;
        }

        float radius = Mathf.Max(0f, cueBallRadius);
        Vector3 extents = movingBounds.extents;
        extents.x = Mathf.Max(extents.x + radius, tableBounds.extents.x);
        extents.y = tableBounds.extents.y;
        extents.z = Mathf.Max(extents.z + radius, minHalfLength);

        float zLimit = Mathf.Max(0f, tableBounds.extents.z - extents.z);
        Vector3 centre = movingBounds.center;
        centre.x = 0f;
        centre.y = tableBounds.center.y;
        centre.z = Mathf.Clamp(centre.z, tableBounds.center.z - zLimit, tableBounds.center.z + zLimit);

        return new Bounds(centre, extents * 2f);
    }

    private bool TryGetMovingBounds(out Bounds bounds)
    {
        bounds = new Bounds();
        bool hasBounds = false;

        if (CueBall != null && CueBall.gameObject.activeInHierarchy && IsMoving(CueBall))
        {
            bounds = new Bounds(CueBall.position, Vector3.zero);
            hasBounds = true;
        }

        if (TargetBall != null && TargetBall.gameObject.activeInHierarchy && TargetBall != CueBall && IsMoving(TargetBall))
        {
            if (hasBounds)
            {
                bounds.Encapsulate(TargetBall.position);
            }
            else
            {
                bounds = new Bounds(TargetBall.position, Vector3.zero);
                hasBounds = true;
            }
        }

        if (Balls != null)
        {
            for (int i = 0; i < Balls.Length; i++)
            {
                Transform ball = Balls[i];
                if (ball == null || !ball.gameObject.activeInHierarchy || ball == CueBall || ball == TargetBall)
                {
                    continue;
                }

                if (!IsMoving(ball))
                {
                    continue;
                }

                if (hasBounds)
                {
                    bounds.Encapsulate(ball.position);
                }
                else
                {
                    bounds = new Bounds(ball.position, Vector3.zero);
                    hasBounds = true;
                }
            }
        }

        return hasBounds;
    }

    private float ComputeBroadcastDistance(Vector3 focus, float height, Vector3 forward, Camera cam, Bounds bounds)
    {
        float minDistance = Mathf.Max(0.1f, broadcastMinDistance);
        float maxDistance = Mathf.Max(minDistance + 0.01f, broadcastMaxDistance);

        float low = minDistance;
        float high = maxDistance;
        float best = maxDistance;

        Vector3 lookTarget = focus + Vector3.up * Mathf.Max(0f, broadcastHeightPadding);

        for (int i = 0; i < 24; i++)
        {
            float mid = 0.5f * (low + high);
            Vector3 cameraPos = focus - forward * mid + Vector3.up * height;
            if (TableFitsAt(cameraPos, lookTarget, cam, bounds))
            {
                best = mid;
                high = mid;
            }
            else
            {
                low = mid;
            }
        }

        best = Mathf.Clamp(best, minDistance, maxDistance);

        Vector3 finalPos = focus - forward * best + Vector3.up * height;
        if (!TableFitsAt(finalPos, lookTarget, cam, bounds))
        {
            best = maxDistance;
        }

        return Mathf.Clamp(best, minDistance, maxDistance);
    }

    private bool TableFitsAt(Vector3 cameraPosition, Vector3 lookTarget, Camera cam, Bounds bounds)
    {
        Vector3 forward = lookTarget - cameraPosition;
        if (forward.sqrMagnitude < 0.0001f)
        {
            forward = Vector3.forward;
            lookTarget = cameraPosition + forward;
        }

        Matrix4x4 view = Matrix4x4.LookAt(cameraPosition, lookTarget, Vector3.up);
        Matrix4x4 projection = Matrix4x4.Perspective(cam.fieldOfView, cam.aspect, cam.nearClipPlane, cam.farClipPlane);
        Matrix4x4 vp = projection * view;

        Vector3 centre = bounds.center;
        Vector3 extents = bounds.extents;
        float margin = Mathf.Clamp01(broadcastSafeMargin);

        for (int i = 0; i < 8; i++)
        {
            Vector3 corner = centre + new Vector3(
                ((i & 1) == 0 ? -extents.x : extents.x),
                ((i & 2) == 0 ? -extents.y : extents.y),
                ((i & 4) == 0 ? -extents.z : extents.z)
            );

            Vector4 clip = vp * new Vector4(corner.x, corner.y, corner.z, 1f);
            if (clip.w <= 0f)
            {
                return false;
            }

            Vector3 ndc = new Vector3(clip.x, clip.y, clip.z) / clip.w;
            float vx = 0.5f * (ndc.x + 1f);
            float vy = 0.5f * (ndc.y + 1f);

            if (vx < margin || vx > 1f - margin || vy < margin || vy > 1f - margin)
            {
                return false;
            }

            if (ndc.z < 0f || ndc.z > 1f)
            {
                return false;
            }
        }

        return true;
    }

    private void ApplyShortRailCamera(Vector3 focusPosition, float distance, float height)
    {
        Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
        Vector3 forward = rotation * Vector3.forward;
        Vector3 lookTarget = focusPosition + forward * 5f;
        ApplyShortRailCamera(focusPosition, forward, distance, height, minimumHeightAboveFocus, lookTarget);
    }

    private void ApplyShortRailCamera(
        Vector3 focusPosition,
        float distance,
        float height,
        float minimumHeightOffset
    )
    {
        Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
        Vector3 forward = rotation * Vector3.forward;
        Vector3 lookTarget = focusPosition + forward * 5f;
        ApplyShortRailCamera(focusPosition, forward, distance, height, minimumHeightOffset, lookTarget);
    }

    private void ApplyShortRailCamera(
        Vector3 focusPosition,
        Vector3 forward,
        float distance,
        float height,
        float minimumHeightOffset,
        Vector3 lookTarget
    )
    {
        ApplyCameraAt(focusPosition, forward, distance, height, minimumHeightOffset, lookTarget);

        Vector3 pos = transform.position;
        pos.x = 0f;
        transform.position = pos;
    }

    private void ApplyCameraAt(
        Vector3 focusPosition,
        Vector3 forward,
        float distance,
        float height,
        float minimumHeightOffset,
        Vector3 lookTarget
    )
    {
        if (forward.sqrMagnitude < 0.0001f)
        {
            forward = Vector3.forward;
        }
        forward = forward.normalized;

        Vector3 desiredPosition = focusPosition - forward * distance + Vector3.up * height;

        float minimumHeight = focusPosition.y + Mathf.Max(minimumHeightAboveFocus, minimumHeightOffset);
        float minRailHeight = railHeight + Mathf.Max(0f, railClearance);
        minimumHeight = Mathf.Max(minimumHeight, minRailHeight);

        // Prevent the camera from getting stuck behind walls or decorations by
        // nudging it toward the table if something blocks the line of sight.
        Vector3 focusOrigin = focusPosition + Vector3.up * (minimumHeight - focusPosition.y);
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
                adjustedPosition.y = Mathf.Max(adjustedPosition.y, minimumHeight);
                desiredPosition = adjustedPosition;
            }
        }

        desiredPosition.y = Mathf.Max(desiredPosition.y, minimumHeight);
        desiredPosition.y = Mathf.Max(desiredPosition.y, minRailHeight);
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

    private Vector3 GetCueAimLookTarget(Vector3 focus, Vector3 forward)
    {
        Vector3 defaultTarget = focus + Vector3.up * cueBallLookOffset;

        if (CueBall == null)
        {
            return defaultTarget;
        }

        Vector3 aimEnd;
        if (!TryGetAimLineEndPoint(forward, out aimEnd))
        {
            return defaultTarget;
        }

        Vector3 flatForward = new Vector3(forward.x, 0f, forward.z);
        if (flatForward.sqrMagnitude < 0.0001f)
        {
            return defaultTarget;
        }

        flatForward = flatForward.normalized;

        float lowering = Mathf.Clamp01(cueAimLowering);

        Vector3 aimVector = aimEnd - focus;
        aimVector.y = 0f;
        float aimDistance = aimVector.magnitude;
        if (aimDistance < 0.0001f)
        {
            return defaultTarget;
        }

        Vector3 aimDirection = aimVector / aimDistance;

        float overshootBase = Mathf.Max(0f, cueAimTargetOvershoot);
        float overshoot = Mathf.Lerp(overshootBase, overshootBase * 0.5f, Mathf.Clamp01(lowering));
        Vector3 extendedAim = aimEnd + aimDirection * overshoot;
        extendedAim = tableBounds.ClosestPoint(extendedAim);

        float baseLookFraction = Mathf.Clamp01(cueAimLookFraction);
        float lookFraction = Mathf.Lerp(baseLookFraction, 1f, Mathf.Clamp01(lowering));
        float lookDistance = Mathf.Clamp(aimDistance * lookFraction, 0f, aimDistance);
        Vector3 aimLockedLook = focus + aimDirection * lookDistance;

        float aimLineWeight = Mathf.Clamp01(cueAimLineFocusWeight);
        Vector3 lookPoint = Vector3.Lerp(extendedAim, aimLockedLook, aimLineWeight);

        float railTop = railHeight + Mathf.Max(0f, railClearance);
        float minimumLookHeight = focus.y + cueBallLookOffset;
        float railLookHeight = Mathf.Max(railTop, aimEnd.y) + cueBallLookOffset;
        float heightBias = Mathf.Clamp01(cueAimHeightFocus);
        float heightBlend = Mathf.Lerp(heightBias, 0.85f, Mathf.Clamp01(lowering));
        float desiredHeight = Mathf.Lerp(minimumLookHeight, railLookHeight, heightBlend);
        float aimPlaneHeight = aimEnd.y + cueBallLookOffset;
        float leveledHeight = Mathf.Lerp(desiredHeight, aimPlaneHeight, lowering);
        lookPoint.y = Mathf.Max(leveledHeight, minimumLookHeight);

        return lookPoint;
    }

    private bool TryGetAimLineEndPoint(Vector3 forward, out Vector3 aimEnd)
    {
        aimEnd = CueBall != null ? CueBall.position : Vector3.zero;

        if (CueBall == null)
        {
            return false;
        }

        if (TargetBall != null && TargetBall.gameObject.activeInHierarchy)
        {
            aimEnd = TargetBall.position;
            return true;
        }

        Vector3 flatForward = new Vector3(forward.x, 0f, forward.z);
        if (flatForward.sqrMagnitude < 0.0001f)
        {
            return false;
        }

        flatForward = flatForward.normalized;

        Bounds bounds = tableBounds;
        Vector3 min = bounds.min;
        Vector3 max = bounds.max;
        Vector3 start = CueBall.position;

        float t = float.PositiveInfinity;
        const float epsilon = 0.0001f;
        float margin = Mathf.Max(0f, cueBallRadius);

        if (Mathf.Abs(flatForward.x) > epsilon)
        {
            float limitX = flatForward.x > 0f ? max.x - margin : min.x + margin;
            float tx = (limitX - start.x) / flatForward.x;
            if (tx > 0f)
            {
                t = Mathf.Min(t, tx);
            }
        }

        if (Mathf.Abs(flatForward.z) > epsilon)
        {
            float limitZ = flatForward.z > 0f ? max.z - margin : min.z + margin;
            float tz = (limitZ - start.z) / flatForward.z;
            if (tz > 0f)
            {
                t = Mathf.Min(t, tz);
            }
        }

        if (float.IsPositiveInfinity(t))
        {
            return false;
        }

        aimEnd = start + flatForward * Mathf.Max(t, 0f);
        aimEnd.y = start.y;
        return true;
    }
}
#endif
