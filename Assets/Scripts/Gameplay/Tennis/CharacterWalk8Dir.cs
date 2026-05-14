using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(CharacterController))]
    public class CharacterWalk8Dir : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField] private float walkSpeed = 4.5f;
        [SerializeField] private float acceleration = 18f;
        [SerializeField] private Transform cameraForwardSource;
        [SerializeField] private Transform incomingBall;
        [SerializeField] private bool faceIncomingBall = true;
        [SerializeField, Min(0.01f)] private float rotationSharpness = 14f;
        [SerializeField] private Animator animator;

        [Header("Soldier-Style Procedural Walk")]
        [SerializeField] private bool useProceduralSoldierWalk = true;
        [SerializeField] private Transform proceduralHipRoot;
        [SerializeField] private Transform leftUpperLeg;
        [SerializeField] private Transform rightUpperLeg;
        [SerializeField] private Transform leftLowerLeg;
        [SerializeField] private Transform rightLowerLeg;
        [SerializeField] private Transform leftFoot;
        [SerializeField] private Transform rightFoot;
        [SerializeField, Min(0.1f)] private float strideFrequency = 4.6f;
        [SerializeField, Range(0f, 45f)] private float thighSwingDegrees = 18f;
        [SerializeField, Range(0f, 60f)] private float kneeBendDegrees = 24f;
        [SerializeField, Range(0f, 35f)] private float footRollDegrees = 12f;
        [SerializeField, Range(0f, 15f)] private float hipBobCentimeters = 2.5f;

        private CharacterController _controller;
        private Vector3 _velocity;
        private float _walkCycle;
        private Vector3 _hipInitialLocalPosition;
        private Quaternion _leftUpperLegBase;
        private Quaternion _rightUpperLegBase;
        private Quaternion _leftLowerLegBase;
        private Quaternion _rightLowerLegBase;
        private Quaternion _leftFootBase;
        private Quaternion _rightFootBase;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            if (proceduralHipRoot != null) _hipInitialLocalPosition = proceduralHipRoot.localPosition;
            CacheBoneBases();
        }

        private void OnEnable() => CacheBoneBases();

        private void Update()
        {
            float x = Input.GetAxis("Horizontal");
            float y = Input.GetAxis("Vertical");

            Vector3 forward = cameraForwardSource != null ? cameraForwardSource.forward : Vector3.forward;
            Vector3 right = cameraForwardSource != null ? cameraForwardSource.right : Vector3.right;
            forward.y = 0f;
            right.y = 0f;
            forward.Normalize();
            right.Normalize();

            Vector3 desiredMove = right * x + forward * y;
            if (desiredMove.sqrMagnitude > 1f) desiredMove.Normalize();

            _velocity = Vector3.MoveTowards(_velocity, desiredMove * walkSpeed, acceleration * Time.deltaTime);
            _controller.Move(_velocity * Time.deltaTime);

            UpdateFacing(desiredMove);
            UpdateAnimator(x, y, desiredMove.magnitude);
            UpdateSoldierWalk(desiredMove.magnitude);
        }

        private void UpdateFacing(Vector3 desiredMove)
        {
            Vector3 lookDirection = Vector3.zero;
            if (faceIncomingBall && incomingBall != null)
            {
                lookDirection = incomingBall.position - transform.position;
                lookDirection.y = 0f;
            }

            if (lookDirection.sqrMagnitude < 0.001f && desiredMove.sqrMagnitude > 0.001f)
            {
                lookDirection = desiredMove;
            }

            if (lookDirection.sqrMagnitude < 0.001f) return;

            Quaternion targetRotation = Quaternion.LookRotation(lookDirection.normalized, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, 1f - Mathf.Exp(-rotationSharpness * Time.deltaTime));
        }

        private void UpdateAnimator(float x, float y, float speed01)
        {
            if (animator == null) return;

            animator.SetFloat("MoveX", x);
            animator.SetFloat("MoveY", y);
            animator.SetFloat("Speed", speed01);
            animator.SetBool("IsWalking", speed01 > 0.05f);
        }

        private void CacheBoneBases()
        {
            if (leftUpperLeg != null) _leftUpperLegBase = leftUpperLeg.localRotation;
            if (rightUpperLeg != null) _rightUpperLegBase = rightUpperLeg.localRotation;
            if (leftLowerLeg != null) _leftLowerLegBase = leftLowerLeg.localRotation;
            if (rightLowerLeg != null) _rightLowerLegBase = rightLowerLeg.localRotation;
            if (leftFoot != null) _leftFootBase = leftFoot.localRotation;
            if (rightFoot != null) _rightFootBase = rightFoot.localRotation;
        }

        private void UpdateSoldierWalk(float speed01)
        {
            if (!useProceduralSoldierWalk) return;

            float normalizedSpeed = Mathf.Clamp01(speed01);
            if (normalizedSpeed > 0.02f) _walkCycle += Time.deltaTime * strideFrequency * Mathf.Lerp(0.65f, 1.2f, normalizedSpeed);

            float leftPhase = Mathf.Sin(_walkCycle);
            float rightPhase = -leftPhase;
            float leftPlant = Mathf.Max(0f, -leftPhase);
            float rightPlant = Mathf.Max(0f, -rightPhase);
            float swing = thighSwingDegrees * normalizedSpeed;
            float knee = kneeBendDegrees * normalizedSpeed;
            float roll = footRollDegrees * normalizedSpeed;

            ApplyLegPose(leftUpperLeg, _leftUpperLegBase, leftPhase * swing);
            ApplyLegPose(rightUpperLeg, _rightUpperLegBase, rightPhase * swing);
            ApplyLegPose(leftLowerLeg, _leftLowerLegBase, leftPlant * knee);
            ApplyLegPose(rightLowerLeg, _rightLowerLegBase, rightPlant * knee);
            ApplyFootPose(leftFoot, _leftFootBase, -leftPhase * roll);
            ApplyFootPose(rightFoot, _rightFootBase, -rightPhase * roll);

            if (proceduralHipRoot != null)
            {
                Vector3 localPosition = _hipInitialLocalPosition;
                localPosition.y += Mathf.Abs(Mathf.Sin(_walkCycle * 2f)) * (hipBobCentimeters * 0.01f) * normalizedSpeed;
                proceduralHipRoot.localPosition = localPosition;
            }
        }

        private static void ApplyLegPose(Transform bone, Quaternion baseRotation, float degrees)
        {
            if (bone == null) return;
            bone.localRotation = baseRotation * Quaternion.Euler(degrees, 0f, 0f);
        }

        private static void ApplyFootPose(Transform bone, Quaternion baseRotation, float degrees)
        {
            if (bone == null) return;
            bone.localRotation = baseRotation * Quaternion.Euler(degrees, 0f, 0f);
        }
    }
}
