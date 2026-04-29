using UnityEngine;

namespace Aiming
{
    /// <summary>
    /// Procedural snooker-style human pose driver ported from the verified Three.js behavior.
    /// Attach this to the human root object and wire the segment transforms in inspector.
    /// </summary>
    public class PoolHumanPoseDriver : MonoBehaviour
    {
        [Header("References")]
        public CueController cueController;

        [Header("Rig nodes")]
        public Transform root;
        public Transform pelvis;
        public Transform torso;
        public Transform chest;
        public Transform neck;
        public Transform head;
        public Transform leftUpperArm;
        public Transform leftLowerArm;
        public Transform rightUpperArm;
        public Transform rightLowerArm;
        public Transform leftUpperLeg;
        public Transform leftLowerLeg;
        public Transform rightUpperLeg;
        public Transform rightLowerLeg;
        public Transform bridgeHand;
        public Transform gripHand;
        public Transform leftFoot;
        public Transform rightFoot;

        [Header("Table sizing")]
        [Tooltip("Reference table length from source implementation.")]
        public float sourceTableLength = 3.6f;
        [Tooltip("Reference table width from source implementation.")]
        public float sourceTableWidth = 2f;
        public float edgeMargin = 0.3f;
        public float desiredShootDistance = 1.02f;
        [Tooltip("Optional helper waypoints around table sides (left, right, bottom, top) for Bilardo-style perimeter walking.")]
        public Transform[] sideWalkHelpers;
        [Tooltip("Uniform character size multiplier. Values above 1 make the player visually bigger and heavier.")]
        [Min(0.6f)] public float bodyScaleMultiplier = 1.12f;

        [Header("Smoothing")]
        public float poseLambda = 9f;
        public float moveLambda = 5.6f;
        public float rotLambda = 8.5f;
        [Tooltip("Lower values slow rail-to-rail side movement to feel heavier and more realistic.")]
        [Range(0.05f, 1f)] public float lateralResponse = 0.42f;
        [Min(0.1f)] public float walkPerimeterSpeed = 2.7f;

        [Header("Cue relation")]
        public float bridgeDist = 0.2f;
        public float gripRatio = 0.76f;
        public float stanceHeight = 0f;
        [Tooltip("How much closer to the table edge the chest/head moves while aiming.")]
        [Range(0f, 0.2f)] public float tableLeanDepth = 0.03f;
        [Tooltip("Extra right-hand pull distance, matching the live power slider pullback.")]
        [Range(0f, 0.4f)] public float gripPullRange = 0.3f;
        [Tooltip("Right hand grip point from cue root towards cue tip (meters).")]
        [Range(0.05f, 0.9f)] public float rightHandGripFromCueRoot = 0.18f;
        [Tooltip("Primary right hand grip distance measured backward from cue tip (meters). Keeps the hand behind the bridge like Bilardo stance.")]
        [Range(0.12f, 1.2f)] public float rightHandGripFromCueTip = 0.42f;
        [Tooltip("Minimum spacing between bridge hand and grip hand along cue axis.")]
        [Range(0.14f, 0.75f)] public float rightHandBackFromBridge = 0.34f;
        [Tooltip("Small right-hand vertical offset so fingers wrap the cue instead of intersecting it.")]
        [Range(-0.1f, 0.15f)] public float rightHandVerticalOffset = 0.025f;
        [Tooltip("Moves chest/head closer to cue line to mimic real snooker stance.")]
        [Range(0f, 0.18f)] public float chinToCueForwardBias = 0.06f;
        [Tooltip("Makes lead shoulder slightly lower for realistic bridge alignment.")]
        [Range(0f, 0.16f)] public float shoulderDrop = 0.055f;

        [Header("Visual fidelity")]
        [Tooltip("Renderers that should keep their original shared materials/textures (prevents accidental runtime overrides).")]
        public Renderer[] originalTextureRenderers;
        Material[][] _originalSharedMaterials;

        float _poseT;
        float _walkT;
        float _yaw;
        float _lateralEdgeCoord;
        Vector3[] _railHelpers = new Vector3[4];
        Vector3 _perimeterRootTarget;
        bool _hasPerimeterTarget;
        bool _strikePoseLocked;
        Vector3 _lockedStrikeRootTarget;
        Vector3 _lockedStrikeBridgeTarget;
        Vector3 _lockedStrikeAimForward;

        void Awake()
        {
            CacheOriginalMaterials();
        }

        void LateUpdate()
        {
            if (cueController == null || cueController.cueBall == null || root == null)
            {
                return;
            }

            EnsureOriginalMaterials();

            float dt = Mathf.Max(0f, Time.deltaTime);
            float s = ComputeScaleFactor() * bodyScaleMultiplier;

            Vector3 cueBall = cueController.cueBall.position;
            Vector3 aimForward = cueController.CurrentAimDirection;
            if (aimForward.sqrMagnitude < 1e-6f)
            {
                aimForward = Vector3.forward;
            }
            aimForward.y = 0f;
            aimForward.Normalize();

            Vector3 aimSide = new Vector3(aimForward.z, 0f, -aimForward.x).normalized;
            Vector3 rootTarget = ChooseHumanEdgePosition(cueBall, aimForward, s, cueController.CurrentShotState);
            Vector3 navigatedRootTarget = NavigateAlongTablePerimeter(rootTarget, s, dt);
            CacheRailHelpers();

            BridgeMode bridgeMode = ResolveBridgeMode(cueBall);
            float bridgeDistance = bridgeDist * s;
            if (bridgeMode == BridgeMode.Rail)
            {
                bridgeDistance *= 0.88f;
            }
            else if (bridgeMode == BridgeMode.High)
            {
                bridgeDistance *= 1.07f;
            }
            Vector3 bridgeHandTarget = cueBall + (aimForward * -bridgeDistance) + (aimSide * (-0.018f * s));
            bridgeHandTarget.y = ResolveTableY(cueBall.y) + ResolveBridgeHeightOffset(bridgeMode, s);
            bridgeHandTarget += aimSide * ResolveBridgeSideOffset(bridgeMode, s);

            float handPull = cueController.CurrentPullNormalized * gripPullRange * s;
            Vector3 gripHandTarget = ResolveRightHandGripTarget(aimForward, aimSide, bridgeHandTarget, handPull, s);

            float standingYaw = YawFromForward(aimForward);
            Vector3 idleRightHandTarget = rootTarget + RotateAroundY(new Vector3(0.22f, 1.18f, 0.04f) * s, standingYaw);
            Vector3 idleLeftHandTarget = rootTarget + RotateAroundY(new Vector3(-0.16f, 1.1f, -0.02f) * s, standingYaw);
            ResolveStrikePoseLock(
                cueController.CurrentShotState,
                navigatedRootTarget,
                bridgeHandTarget,
                aimForward);

            if (_strikePoseLocked)
            {
                navigatedRootTarget = _lockedStrikeRootTarget;
                bridgeHandTarget = _lockedStrikeBridgeTarget;
                aimForward = _lockedStrikeAimForward;
            }

            bool shouldUseShootPose = cueController.CurrentShotState != CueController.ShotState.Idle ||
                                      cueController.IsCameraLowered ||
                                      cueController.CurrentPullNormalized > 0.001f;
            CueController.ShotState visualShotState = shouldUseShootPose
                ? CueController.ShotState.Dragging
                : CueController.ShotState.Idle;

            UpdateHumanPose(
                dt,
                visualShotState,
                navigatedRootTarget,
                aimForward,
                bridgeHandTarget,
                gripHandTarget,
                idleRightHandTarget,
                idleLeftHandTarget,
                bridgeMode,
                s);

            cueController.SetCameraLowered(cueController.CurrentShotState != CueController.ShotState.Idle);
        }

        float ComputeScaleFactor()
        {
            if (cueController == null)
            {
                return 1f;
            }

            float widthScale = cueController.tableBounds.size.x > 0.0001f
                ? cueController.tableBounds.size.x / Mathf.Max(0.0001f, sourceTableWidth)
                : 1f;
            float lengthScale = cueController.tableBounds.size.z > 0.0001f
                ? cueController.tableBounds.size.z / Mathf.Max(0.0001f, sourceTableLength)
                : 1f;
            return (widthScale + lengthScale) * 0.5f;
        }

        void CacheOriginalMaterials()
        {
            if (originalTextureRenderers == null || originalTextureRenderers.Length == 0)
            {
                return;
            }

            _originalSharedMaterials = new Material[originalTextureRenderers.Length][];
            for (int i = 0; i < originalTextureRenderers.Length; i++)
            {
                Renderer renderer = originalTextureRenderers[i];
                _originalSharedMaterials[i] = renderer != null ? renderer.sharedMaterials : null;
            }
        }

        void EnsureOriginalMaterials()
        {
            if (_originalSharedMaterials == null || originalTextureRenderers == null)
            {
                return;
            }

            int count = Mathf.Min(originalTextureRenderers.Length, _originalSharedMaterials.Length);
            for (int i = 0; i < count; i++)
            {
                Renderer renderer = originalTextureRenderers[i];
                Material[] cached = _originalSharedMaterials[i];
                if (renderer == null || cached == null || cached.Length == 0)
                {
                    continue;
                }

                Material[] current = renderer.sharedMaterials;
                bool different = current == null || current.Length != cached.Length;
                if (!different)
                {
                    for (int m = 0; m < current.Length; m++)
                    {
                        if (current[m] != cached[m])
                        {
                            different = true;
                            break;
                        }
                    }
                }

                if (different)
                {
                    renderer.sharedMaterials = cached;
                }
            }
        }

        float ResolveTableY(float cueBallY)
        {
            return cueBallY - cueController.ballRadius + stanceHeight;
        }

        Vector3 ChooseHumanEdgePosition(Vector3 cueBallWorld, Vector3 aimForward, float s, CueController.ShotState shotState)
        {
            float approachDistance = desiredShootDistance * s;
            if (shotState != CueController.ShotState.Idle)
            {
                approachDistance = Mathf.Max(0.08f, approachDistance - (tableLeanDepth * s));
            }

            Vector3 desired = cueBallWorld + (aimForward * -approachDistance);

            float halfW = cueController.tableBounds.size.x * 0.5f;
            float halfL = cueController.tableBounds.size.z * 0.5f;
            float xEdge = halfW + (edgeMargin * s);
            float zEdge = halfL + (edgeMargin * s);

            Vector3[] candidates =
            {
                new Vector3(-xEdge, 0f, Mathf.Clamp(desired.z, -zEdge, zEdge)),
                new Vector3(xEdge, 0f, Mathf.Clamp(desired.z, -zEdge, zEdge)),
                new Vector3(Mathf.Clamp(desired.x, -xEdge, xEdge), 0f, -zEdge),
                new Vector3(Mathf.Clamp(desired.x, -xEdge, xEdge), 0f, zEdge)
            };

            bool sideRail = Mathf.Abs(desired.x) > Mathf.Abs(desired.z);
            float targetEdgeCoord = sideRail ? desired.z : desired.x;
            _lateralEdgeCoord = DampScalar(_lateralEdgeCoord, targetEdgeCoord, lateralResponse * 9f, Mathf.Max(0f, Time.deltaTime));

            Vector3 best = candidates[0];
            float bestDist = (best - desired).sqrMagnitude;
            for (int i = 1; i < candidates.Length; i++)
            {
                float dist = (candidates[i] - desired).sqrMagnitude;
                if (dist < bestDist)
                {
                    best = candidates[i];
                    bestDist = dist;
                }
            }

            if (Mathf.Abs(best.x) >= xEdge - 0.0001f)
            {
                best.z = Mathf.Clamp(_lateralEdgeCoord, -zEdge, zEdge);
            }
            else if (Mathf.Abs(best.z) >= zEdge - 0.0001f)
            {
                best.x = Mathf.Clamp(_lateralEdgeCoord, -xEdge, xEdge);
            }

            best.y = stanceHeight;
            return best;
        }

        Vector3 NavigateAlongTablePerimeter(Vector3 desiredTarget, float s, float dt)
        {
            if (!_hasPerimeterTarget)
            {
                _perimeterRootTarget = root != null ? root.position : desiredTarget;
                _hasPerimeterTarget = true;
            }

            Vector3 currentPerimeter = ClosestPerimeterPoint(_perimeterRootTarget, s);
            Vector3 targetPerimeter = ClosestPerimeterPoint(desiredTarget, s);
            _perimeterRootTarget = MovePerimeterPoint(
                currentPerimeter,
                targetPerimeter,
                walkPerimeterSpeed * Mathf.Max(0f, dt),
                s);
            _perimeterRootTarget.y = stanceHeight;
            return _perimeterRootTarget;
        }

        Vector3 ClosestPerimeterPoint(Vector3 point, float s)
        {
            if (sideWalkHelpers != null && sideWalkHelpers.Length > 0)
            {
                Vector3 best = point;
                float bestDist = float.PositiveInfinity;
                for (int i = 0; i < sideWalkHelpers.Length; i++)
                {
                    if (sideWalkHelpers[i] == null)
                    {
                        continue;
                    }

                    Vector3 helperPoint = sideWalkHelpers[i].position;
                    float d = (helperPoint - point).sqrMagnitude;
                    if (d < bestDist)
                    {
                        best = helperPoint;
                        bestDist = d;
                    }
                }

                best.y = stanceHeight;
                return best;
            }

            float halfW = cueController.tableBounds.size.x * 0.5f;
            float halfL = cueController.tableBounds.size.z * 0.5f;
            float xEdge = halfW + (edgeMargin * s);
            float zEdge = halfL + (edgeMargin * s);
            return new Vector3(
                Mathf.Clamp(point.x, -xEdge, xEdge),
                stanceHeight,
                Mathf.Clamp(point.z, -zEdge, zEdge));
        }

        Vector3 MovePerimeterPoint(Vector3 current, Vector3 target, float step, float s)
        {
            if (step <= 0f)
            {
                return current;
            }

            float halfW = cueController.tableBounds.size.x * 0.5f;
            float halfL = cueController.tableBounds.size.z * 0.5f;
            float xEdge = halfW + (edgeMargin * s);
            float zEdge = halfL + (edgeMargin * s);
            float perimeter = (xEdge + zEdge) * 4f;
            if (perimeter < 0.0001f)
            {
                return target;
            }

            float uCurrent = PointToPerimeterU(current, xEdge, zEdge);
            float uTarget = PointToPerimeterU(target, xEdge, zEdge);
            float cw = Mathf.Repeat(uTarget - uCurrent, perimeter);
            float ccw = cw - perimeter;
            float delta = Mathf.Abs(cw) <= Mathf.Abs(ccw) ? cw : ccw;
            float travel = Mathf.Clamp(delta, -step, step);
            float uNext = Mathf.Repeat(uCurrent + travel, perimeter);
            return PerimeterUToPoint(uNext, xEdge, zEdge);
        }

        static float PointToPerimeterU(Vector3 p, float xEdge, float zEdge)
        {
            float width = xEdge * 2f;
            float length = zEdge * 2f;
            float px = Mathf.Clamp(p.x, -xEdge, xEdge);
            float pz = Mathf.Clamp(p.z, -zEdge, zEdge);
            float dx = Mathf.Min(Mathf.Abs(px + xEdge), Mathf.Abs(px - xEdge));
            float dz = Mathf.Min(Mathf.Abs(pz + zEdge), Mathf.Abs(pz - zEdge));

            if (dz <= dx)
            {
                return pz < 0f ? (px + xEdge) : (width + length + (xEdge - px));
            }

            return px > 0f ? (width + (pz + zEdge)) : (width + length + width + (zEdge - pz));
        }

        static Vector3 PerimeterUToPoint(float u, float xEdge, float zEdge)
        {
            float width = xEdge * 2f;
            float length = zEdge * 2f;
            float perimeter = (xEdge + zEdge) * 4f;
            u = Mathf.Repeat(u, perimeter);

            if (u < width)
            {
                return new Vector3(-xEdge + u, 0f, -zEdge);
            }

            u -= width;
            if (u < length)
            {
                return new Vector3(xEdge, 0f, -zEdge + u);
            }

            u -= length;
            if (u < width)
            {
                return new Vector3(xEdge - u, 0f, zEdge);
            }

            u -= width;
            return new Vector3(-xEdge, 0f, zEdge - u);
        }

        void UpdateHumanPose(
            float dt,
            CueController.ShotState shotState,
            Vector3 rootTarget,
            Vector3 aimForward,
            Vector3 bridgeHandTarget,
            Vector3 gripHandTarget,
            Vector3 idleRightHandTarget,
            Vector3 idleLeftHandTarget,
            BridgeMode bridgeMode,
            float s)
        {
            float targetPose = shotState == CueController.ShotState.Idle ? 0f : 1f;
            _poseT = DampScalar(_poseT, targetPose, poseLambda, dt);
            root.position = DampVector(root.position, rootTarget, moveLambda, dt);

            float moveAmount = Vector3.Distance(root.position, rootTarget);
            _walkT += dt * (2f + Mathf.Min(7f, moveAmount * 10f));

            float desiredYaw = YawFromForward(aimForward);
            _yaw = DampScalar(_yaw, desiredYaw, rotLambda, dt);

            float t = EaseInOut(_poseT);
            float walk = Mathf.Sin(_walkT * 6.2f) * Mathf.Min(1f, moveAmount * 12f);
            Vector3 forward = RotateAroundY(Vector3.back, _yaw).normalized;
            Vector3 side = new Vector3(forward.z, 0f, -forward.x).normalized;

            Vector3 LocalToWorld(Vector3 v) => RotateAroundY(v, _yaw) + root.position;

            Vector3 hipCenterWorld = LocalToWorld(new Vector3(0f, Lerp(1.02f, 1f, t), Lerp(0f, 0.01f, t)) * s);
            Vector3 torsoCenterWorld = LocalToWorld(new Vector3(0f, Lerp(1.28f, 1.18f, t), Lerp(0f, -0.12f, t)) * s);
            Vector3 chestCenterWorld = LocalToWorld(new Vector3(0f, Lerp(1.5f, 1.26f, t), Lerp(0.01f, -0.34f, t)) * s) + (forward * (chinToCueForwardBias * 0.72f * t * s));
            Vector3 neckWorld = LocalToWorld(new Vector3(0f, Lerp(1.66f, 1.3f, t), Lerp(0.02f, -0.53f, t)) * s) + (forward * (chinToCueForwardBias * 0.9f * t * s));
            Vector3 headCenterWorld = LocalToWorld(new Vector3(0f, Lerp(1.82f, 1.35f, t), Lerp(0.04f, -0.61f, t)) * s) + (forward * (chinToCueForwardBias * t * s));

            Vector3 leftShoulderWorld = LocalToWorld(new Vector3(-0.22f, Lerp(1.57f, 1.34f, t), Lerp(0f, -0.42f, t)) * s) + (Vector3.down * (shoulderDrop * t * s));
            Vector3 rightShoulderWorld = LocalToWorld(new Vector3(0.22f, Lerp(1.57f, 1.34f, t), Lerp(0f, -0.35f, t)) * s);
            Vector3 leftHipWorld = LocalToWorld(new Vector3(-0.12f, 0.93f, 0.02f) * s);
            Vector3 rightHipWorld = LocalToWorld(new Vector3(0.12f, 0.93f, 0.02f) * s);

            Vector3 leftFootStand = new Vector3(-0.13f, 0.035f, 0.03f + (walk * 0.03f)) * s;
            Vector3 rightFootStand = new Vector3(0.13f, 0.035f, -0.03f - (walk * 0.03f)) * s;
            Vector3 frontFootShoot = new Vector3(-0.16f, 0.035f, -0.33f) * s;
            Vector3 rearFootShoot = new Vector3(0.18f, 0.035f, 0.31f) * s;
            Vector3 leftFootWorld = LocalToWorld(Vector3.Lerp(leftFootStand, frontFootShoot, t));
            Vector3 rightFootWorld = LocalToWorld(Vector3.Lerp(rightFootStand, rearFootShoot, t));

            Vector3 leftHandWorld = Vector3.Lerp(idleLeftHandTarget, bridgeHandTarget, t);
            Vector3 rightHandWorld = Vector3.Lerp(idleRightHandTarget, gripHandTarget, t);

            Vector3 leftElbow = Vector3.Lerp(leftShoulderWorld, leftHandWorld, 0.53f) +
                                (Vector3.up * (0.035f * t * s)) +
                                (side * (-0.025f * t * s));

            Vector3 rightElbow = rightHandWorld +
                                 (Vector3.up * Lerp(0.19f, 0.4f, t) * s) +
                                 (side * Lerp(0.03f, 0.07f, t) * s) +
                                 (forward * Lerp(-0.03f, 0.01f, t) * s);

            Vector3 leftKnee = Vector3.Lerp(leftHipWorld, leftFootWorld, 0.53f) +
                               (Vector3.up * Lerp(0.18f, 0.11f, t) * s) +
                               (forward * (0.04f * t * s));
            Vector3 rightKnee = Vector3.Lerp(rightHipWorld, rightFootWorld, 0.52f) +
                                (Vector3.up * Lerp(0.18f, 0.08f, t) * s) +
                                (forward * (-0.03f * t * s));

            if (bridgeMode == BridgeMode.High)
            {
                leftElbow += Vector3.up * (0.025f * s);
                rightElbow += Vector3.up * (0.02f * s);
            }
            else if (bridgeMode == BridgeMode.Rail)
            {
                leftElbow += side * (-0.015f * s);
            }

            SetNodePose(pelvis, hipCenterWorld, side, forward, new Vector3(Lerp(0f, -0.08f, t), 0f, 0f));
            SetNodePose(torso, torsoCenterWorld, side, forward, new Vector3(Lerp(0f, -0.28f, t), 0f, 0f));
            SetNodePose(chest, chestCenterWorld, side, forward, new Vector3(Lerp(0f, -0.62f, t), 0f, 0f));

            SetSegment(neck, neckWorld + (Vector3.down * 0.06f * s), neckWorld + (Vector3.up * 0.06f * s));
            SetNodePose(head, headCenterWorld, side, forward, new Vector3(Lerp(0f, -0.2f, t), 0f, 0f));

            SetSegment(leftUpperArm, leftShoulderWorld, leftElbow);
            SetSegment(leftLowerArm, leftElbow, leftHandWorld);
            SetSegment(rightUpperArm, rightShoulderWorld, rightElbow);
            SetSegment(rightLowerArm, rightElbow, rightHandWorld);

            SetSegment(leftUpperLeg, leftHipWorld, leftKnee);
            SetSegment(leftLowerLeg, leftKnee, leftFootWorld);
            SetSegment(rightUpperLeg, rightHipWorld, rightKnee);
            SetSegment(rightLowerLeg, rightKnee, rightFootWorld);

            OrientFlatObject(bridgeHand, leftHandWorld, aimForward, side, Vector3.zero);
            OrientFlatObject(gripHand, rightHandWorld, aimForward, side, new Vector3(Lerp(0.3f, 1.2f, t), 0f, 0f));

            SetNodePose(leftFoot, leftFootWorld + new Vector3(0f, -0.02f * s, 0f), side, forward, new Vector3(0f, -0.24f * t, 0f));
            SetNodePose(rightFoot, rightFootWorld + new Vector3(0f, -0.02f * s, 0f), side, forward, new Vector3(0f, 0.16f * t, 0f));
        }

        Vector3 ResolveRightHandGripTarget(Vector3 aimForward, Vector3 aimSide, Vector3 bridgeHandTarget, float handPull, float s)
        {
            if (cueController != null && cueController.cueTip != null)
            {
                Transform cueRoot = cueController.transform;
                Vector3 cueTipPos = cueController.cueTip.position;
                Vector3 cueRootPos = cueRoot.position;
                Vector3 cueVector = cueTipPos - cueRootPos;
                if (cueVector.sqrMagnitude > 1e-6f)
                {
                    Vector3 cueDir = cueVector.normalized;
                    float cueLength = cueVector.magnitude;
                    float minBridgeSpacing = Mathf.Clamp(rightHandBackFromBridge, 0.1f, cueLength - 0.03f) * s;
                    float gripFromTip = Mathf.Clamp(rightHandGripFromCueTip * s, minBridgeSpacing, cueLength - 0.03f);
                    float gripFromRoot = Mathf.Clamp(rightHandGripFromCueRoot * s, 0.05f, cueLength - 0.03f);

                    Vector3 tipBasedGrip = cueTipPos - (cueDir * gripFromTip);
                    Vector3 rootBasedGrip = cueRootPos + (cueDir * gripFromRoot);
                    Vector3 grip = Vector3.Lerp(rootBasedGrip, tipBasedGrip, 0.75f);
                    grip += (cueDir * -handPull);

                    float alongFromBridge = Vector3.Dot(grip - bridgeHandTarget, cueDir);
                    if (alongFromBridge > -minBridgeSpacing)
                    {
                        grip = bridgeHandTarget - (cueDir * minBridgeSpacing);
                    }

                    grip += (Vector3.up * (rightHandVerticalOffset * s));
                    grip += (aimSide * (0.018f * s));
                    return grip;
                }
            }

            return bridgeHandTarget +
                   (aimForward * (-(rightHandBackFromBridge * s) - handPull)) +
                   (Vector3.up * (rightHandVerticalOffset * s)) +
                   (aimSide * (0.022f * s));
        }

        void CacheRailHelpers()
        {
            if (cueController == null)
            {
                return;
            }

            Bounds bounds = cueController.tableBounds;
            Vector3 c = bounds.center;
            Vector3 e = bounds.extents;
            float y = stanceHeight;
            _railHelpers[0] = new Vector3(c.x, y, c.z - e.z); // short near
            _railHelpers[1] = new Vector3(c.x, y, c.z + e.z); // short far
            _railHelpers[2] = new Vector3(c.x - e.x, y, c.z); // long left
            _railHelpers[3] = new Vector3(c.x + e.x, y, c.z); // long right
        }

        void OnDrawGizmosSelected()
        {
            if (cueController == null)
            {
                return;
            }

            CacheRailHelpers();
            Gizmos.color = new Color(0.1f, 0.8f, 0.95f, 0.85f);
            Bounds b = cueController.tableBounds;
            Gizmos.DrawWireCube(b.center, b.size);

            Gizmos.color = new Color(1f, 0.78f, 0.15f, 0.92f);
            for (int i = 0; i < _railHelpers.Length; i++)
            {
                Gizmos.DrawSphere(_railHelpers[i], 0.045f);
            }

            if (root != null)
            {
                Gizmos.color = new Color(0.4f, 1f, 0.45f, 0.9f);
                Gizmos.DrawSphere(root.position, 0.055f);
                for (int i = 0; i < _railHelpers.Length; i++)
                {
                    Gizmos.DrawLine(root.position, _railHelpers[i]);
                }
            }
        }

        enum BridgeMode
        {
            Standard,
            Closed,
            Rail,
            High
        }

        BridgeMode ResolveBridgeMode(Vector3 cueBall)
        {
            float halfW = cueController.tableBounds.extents.x;
            float halfL = cueController.tableBounds.extents.z;
            float distRail = Mathf.Min(
                halfW - Mathf.Abs(cueBall.x - cueController.tableBounds.center.x),
                halfL - Mathf.Abs(cueBall.z - cueController.tableBounds.center.z));

            if (distRail <= cueController.ballRadius * 1.7f)
            {
                return BridgeMode.Rail;
            }

            bool elevatedStroke = cueController.CurrentShotState == CueController.ShotState.Striking && cueController.spinInput.y > 0.45f;
            if (elevatedStroke)
            {
                return BridgeMode.High;
            }

            bool closedBridge = cueController.CurrentPullNormalized > 0.65f || cueController.CurrentShotState == CueController.ShotState.Striking;
            return closedBridge ? BridgeMode.Closed : BridgeMode.Standard;
        }

        float ResolveBridgeHeightOffset(BridgeMode mode, float s)
        {
            switch (mode)
            {
                case BridgeMode.Rail:
                    return 0.028f * s;
                case BridgeMode.High:
                    return 0.04f * s;
                case BridgeMode.Closed:
                    return 0.024f * s;
                default:
                    return 0.02f * s;
            }
        }

        float ResolveBridgeSideOffset(BridgeMode mode, float s)
        {
            switch (mode)
            {
                case BridgeMode.Rail:
                    return -0.012f * s;
                case BridgeMode.High:
                    return 0.006f * s;
                case BridgeMode.Closed:
                    return -0.006f * s;
                default:
                    return 0f;
            }
        }

        void ResolveStrikePoseLock(
            CueController.ShotState shotState,
            Vector3 rootTarget,
            Vector3 bridgeTarget,
            Vector3 aimForward)
        {
            if (shotState == CueController.ShotState.Striking)
            {
                if (!_strikePoseLocked)
                {
                    _strikePoseLocked = true;
                    _lockedStrikeRootTarget = rootTarget;
                    _lockedStrikeBridgeTarget = bridgeTarget;
                    _lockedStrikeAimForward = aimForward;
                }

                return;
            }

            _strikePoseLocked = false;
        }

        static float DampScalar(float current, float target, float lambda, float dt)
        {
            return Mathf.Lerp(current, target, 1f - Mathf.Exp(-lambda * dt));
        }

        static Vector3 DampVector(Vector3 current, Vector3 target, float lambda, float dt)
        {
            return Vector3.Lerp(current, target, 1f - Mathf.Exp(-lambda * dt));
        }

        static float YawFromForward(Vector3 forward)
        {
            return Mathf.Atan2(-forward.x, -forward.z);
        }

        static Vector3 RotateAroundY(Vector3 value, float radians)
        {
            return Quaternion.AngleAxis(radians * Mathf.Rad2Deg, Vector3.up) * value;
        }

        static float Lerp(float a, float b, float t) => a + ((b - a) * t);

        static float EaseInOut(float t)
        {
            t = Mathf.Clamp01(t);
            return t * t * (3f - (2f * t));
        }

        static Quaternion MakeBasisQuaternion(Vector3 side, Vector3 up, Vector3 forward)
        {
            Vector3 f = forward.sqrMagnitude > 1e-6f ? forward.normalized : Vector3.forward;
            Vector3 u = up.sqrMagnitude > 1e-6f ? up.normalized : Vector3.up;
            Vector3 s = side.sqrMagnitude > 1e-6f ? side.normalized : Vector3.right;

            Matrix4x4 m = Matrix4x4.identity;
            m.SetColumn(0, new Vector4(s.x, s.y, s.z, 0f));
            m.SetColumn(1, new Vector4(u.x, u.y, u.z, 0f));
            m.SetColumn(2, new Vector4(f.x, f.y, f.z, 0f));
            return m.rotation;
        }

        static void SetNodePose(Transform node, Vector3 position, Vector3 side, Vector3 forward, Vector3 eulerOffset)
        {
            if (node == null)
            {
                return;
            }

            node.position = position;
            node.rotation = MakeBasisQuaternion(side, Vector3.up, forward) * Quaternion.Euler(eulerOffset * Mathf.Rad2Deg);
        }

        static void OrientFlatObject(Transform node, Vector3 position, Vector3 forward, Vector3 side, Vector3 eulerOffset)
        {
            if (node == null)
            {
                return;
            }

            node.position = position;
            node.rotation = MakeBasisQuaternion(side, Vector3.up, forward) * Quaternion.Euler(eulerOffset * Mathf.Rad2Deg);
        }

        static void SetSegment(Transform segment, Vector3 a, Vector3 b)
        {
            if (segment == null)
            {
                return;
            }

            Vector3 dir = b - a;
            float len = Mathf.Max(0.0001f, dir.magnitude);
            segment.position = a + (dir * 0.5f);
            segment.rotation = Quaternion.FromToRotation(Vector3.up, dir.normalized);

            Vector3 localScale = segment.localScale;
            localScale.y = len;
            segment.localScale = localScale;
        }
    }
}
