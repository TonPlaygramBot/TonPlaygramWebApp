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
        public float edgeMargin = 0.58f;
        public float desiredShootDistance = 1.06f;
        [Tooltip("Optional helper waypoints around table sides (left, right, bottom, top).")]
        public Transform[] sideWalkHelpers;

        [Header("Smoothing")]
        public float poseLambda = 9f;
        public float moveLambda = 5.6f;
        public float rotLambda = 8.5f;
        [Min(0.1f)] public float walkPerimeterSpeed = 2.7f;

        [Header("Cue relation")]
        public float bridgeDist = 0.24f;
        public float gripRatio = 0.76f;
        public float stanceHeight = 0f;

        float _poseT;
        float _walkT;
        float _yaw;
        Vector3 _perimeterRootTarget;
        bool _hasPerimeterTarget;

        void LateUpdate()
        {
            if (cueController == null || cueController.cueBall == null || root == null)
            {
                return;
            }

            float dt = Mathf.Max(0f, Time.deltaTime);
            float s = ComputeScaleFactor();

            Vector3 cueBall = cueController.cueBall.position;
            Vector3 aimForward = cueController.CurrentAimDirection;
            if (aimForward.sqrMagnitude < 1e-6f)
            {
                aimForward = Vector3.forward;
            }
            aimForward.y = 0f;
            aimForward.Normalize();

            Vector3 aimSide = new Vector3(aimForward.z, 0f, -aimForward.x).normalized;
            Vector3 rootTarget = ChooseHumanEdgePosition(cueBall, aimForward, s);
            Vector3 navigatedRootTarget = NavigateAlongTablePerimeter(rootTarget, s, dt);

            float bridgeDistance = bridgeDist * s;
            Vector3 bridgeHandTarget = cueBall + (aimForward * -bridgeDistance) + (aimSide * (-0.018f * s));
            bridgeHandTarget.y = ResolveTableY(cueBall.y) + (0.02f * s);

            Vector3 cueTip = cueController.cueTip != null ? cueController.cueTip.position : cueBall;
            Vector3 cueBase = cueController.transform.position;
            Vector3 gripHandTarget = Vector3.Lerp(cueTip, cueBase, gripRatio);

            float standingYaw = YawFromForward(aimForward);
            Vector3 idleRightHandTarget = rootTarget + RotateAroundY(new Vector3(0.22f, 1.18f, 0.04f) * s, standingYaw);
            Vector3 idleLeftHandTarget = rootTarget + RotateAroundY(new Vector3(-0.16f, 1.1f, -0.02f) * s, standingYaw);

            UpdateHumanPose(
                dt,
                cueController.CurrentShotState,
                navigatedRootTarget,
                aimForward,
                bridgeHandTarget,
                gripHandTarget,
                idleRightHandTarget,
                idleLeftHandTarget,
                s);
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

        float ResolveTableY(float cueBallY)
        {
            return cueBallY - cueController.ballRadius + stanceHeight;
        }

        Vector3 ChooseHumanEdgePosition(Vector3 cueBallWorld, Vector3 aimForward, float s)
        {
            Vector3 desired = cueBallWorld + (aimForward * (-desiredShootDistance * s));

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

            best.y = stanceHeight;
            return best;
        }

        Vector3 NavigateAlongTablePerimeter(Vector3 desiredTarget, float s, float dt)
        {
            if (!_hasPerimeterTarget)
            {
                _perimeterRootTarget = root.position;
                _hasPerimeterTarget = true;
            }

            Vector3 currentPerimeter = ClosestPerimeterPoint(_perimeterRootTarget, s);
            Vector3 targetPerimeter = ClosestPerimeterPoint(desiredTarget, s);
            _perimeterRootTarget = MovePerimeterPoint(currentPerimeter, targetPerimeter, walkPerimeterSpeed * Mathf.Max(0f, dt), s);
            _perimeterRootTarget.y = stanceHeight;
            return _perimeterRootTarget;
        }

        Vector3 ClosestPerimeterPoint(Vector3 point, float s)
        {
            Vector3[] helpers = sideWalkHelpers;
            if (helpers != null && helpers.Length > 0)
            {
                Vector3 best = helpers[0] != null ? helpers[0].position : point;
                float bestDist = (best - point).sqrMagnitude;
                for (int i = 1; i < helpers.Length; i++)
                {
                    if (helpers[i] == null)
                    {
                        continue;
                    }

                    float d = (helpers[i].position - point).sqrMagnitude;
                    if (d < bestDist)
                    {
                        best = helpers[i].position;
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
            float perimeter = (xEdge + zEdge) * 4f;
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

            Vector3 hipCenterWorld = LocalToWorld(new Vector3(0f, Lerp(1.02f, 0.98f, t), Lerp(0f, 0.02f, t)) * s);
            Vector3 torsoCenterWorld = LocalToWorld(new Vector3(0f, Lerp(1.28f, 1.13f, t), Lerp(0f, -0.16f, t)) * s);
            Vector3 chestCenterWorld = LocalToWorld(new Vector3(0f, Lerp(1.5f, 1.22f, t), Lerp(0.01f, -0.38f, t)) * s);
            Vector3 neckWorld = LocalToWorld(new Vector3(0f, Lerp(1.66f, 1.22f, t), Lerp(0.02f, -0.61f, t)) * s);
            Vector3 headCenterWorld = LocalToWorld(new Vector3(0f, Lerp(1.82f, 1.27f, t), Lerp(0.04f, -0.71f, t)) * s);

            Vector3 leftShoulderWorld = LocalToWorld(new Vector3(-0.22f, Lerp(1.57f, 1.34f, t), Lerp(0f, -0.42f, t)) * s);
            Vector3 rightShoulderWorld = LocalToWorld(new Vector3(0.22f, Lerp(1.57f, 1.34f, t), Lerp(0f, -0.35f, t)) * s);
            Vector3 leftHipWorld = LocalToWorld(new Vector3(-0.12f, 0.93f, 0.02f) * s);
            Vector3 rightHipWorld = LocalToWorld(new Vector3(0.12f, 0.93f, 0.02f) * s);

            Vector3 leftFootStand = new Vector3(-0.13f, 0.035f, 0.03f + (walk * 0.03f)) * s;
            Vector3 rightFootStand = new Vector3(0.13f, 0.035f, -0.03f - (walk * 0.03f)) * s;
            Vector3 frontFootShoot = new Vector3(-0.22f, 0.035f, -0.34f) * s;
            Vector3 rearFootShoot = new Vector3(0.26f, 0.035f, 0.34f) * s;
            Vector3 leftFootWorld = LocalToWorld(Vector3.Lerp(leftFootStand, frontFootShoot, t));
            Vector3 rightFootWorld = LocalToWorld(Vector3.Lerp(rightFootStand, rearFootShoot, t));

            Vector3 leftHandWorld = Vector3.Lerp(idleLeftHandTarget, bridgeHandTarget, t);
            Vector3 rightHandWorld = Vector3.Lerp(idleRightHandTarget, gripHandTarget, t);

            Vector3 leftElbow = Vector3.Lerp(leftShoulderWorld, leftHandWorld, 0.53f) +
                                (Vector3.up * (0.035f * t * s)) +
                                (side * (-0.025f * t * s));

            Vector3 rightElbow = rightHandWorld +
                                 (Vector3.up * Lerp(0.19f, 0.43f, t) * s) +
                                 (side * Lerp(0.03f, 0.06f, t) * s) +
                                 (forward * Lerp(-0.03f, 0.02f, t) * s);

            Vector3 leftKnee = Vector3.Lerp(leftHipWorld, leftFootWorld, 0.53f) +
                               (Vector3.up * Lerp(0.18f, 0.11f, t) * s) +
                               (forward * (0.04f * t * s));
            Vector3 rightKnee = Vector3.Lerp(rightHipWorld, rightFootWorld, 0.52f) +
                                (Vector3.up * Lerp(0.18f, 0.08f, t) * s) +
                                (forward * (-0.03f * t * s));

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
