using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Drives a deterministic bowling character sequence:
    /// rack -> pick ball -> approach -> throw -> celebrate.
    /// Designed so animation clips can be replaced with higher fidelity mocap later.
    /// </summary>
    public class BowlingCharacterSequenceController : MonoBehaviour
    {
        public enum BowlingPhase
        {
            IdleAtRack,
            WalkToRack,
            PickBall,
            TurnToLane,
            WalkToApproach,
            ThrowPose,
            Release,
            FollowThrough,
            Celebrate,
        }

        [Header("References")]
        [SerializeField] private Animator animator;
        [SerializeField] private Transform rackPoint;
        [SerializeField] private Transform approachPoint;
        [SerializeField] private Transform releasePoint;
        [SerializeField] private Transform laneLookTarget;

        [Header("Tuning")]
        [SerializeField] private float walkSpeed = 1.65f;
        [SerializeField] private float turnSpeed = 480f;
        [SerializeField] private float arrivalDistance = 0.07f;
        [SerializeField] private float pickBallDuration = 0.8f;
        [SerializeField] private float throwSetupDuration = 0.5f;
        [SerializeField] private float releaseDuration = 0.2f;
        [SerializeField] private float followThroughDuration = 0.6f;

        [Header("Animator Keys")]
        [SerializeField] private string locomotionSpeedKey = "LocomotionSpeed";
        [SerializeField] private string phaseKey = "BowlingPhase";

        private BowlingPhase _phase = BowlingPhase.IdleAtRack;
        private float _phaseTimer;

        public BowlingPhase Phase => _phase;

        public void BeginShotSequence()
        {
            if (_phase != BowlingPhase.IdleAtRack && _phase != BowlingPhase.Celebrate)
            {
                return;
            }

            SetPhase(BowlingPhase.WalkToRack);
        }

        public void OnStrike()
        {
            SetPhase(BowlingPhase.Celebrate);
        }

        private void Update()
        {
            _phaseTimer += Time.deltaTime;
            switch (_phase)
            {
                case BowlingPhase.WalkToRack:
                    UpdateWalkTo(rackPoint, BowlingPhase.PickBall);
                    break;
                case BowlingPhase.PickBall:
                    if (_phaseTimer >= pickBallDuration) SetPhase(BowlingPhase.TurnToLane);
                    break;
                case BowlingPhase.TurnToLane:
                    if (FaceTarget(laneLookTarget != null ? laneLookTarget.position : transform.position + transform.forward))
                    {
                        SetPhase(BowlingPhase.WalkToApproach);
                    }
                    break;
                case BowlingPhase.WalkToApproach:
                    UpdateWalkTo(approachPoint, BowlingPhase.ThrowPose);
                    break;
                case BowlingPhase.ThrowPose:
                    if (_phaseTimer >= throwSetupDuration) SetPhase(BowlingPhase.Release);
                    break;
                case BowlingPhase.Release:
                    if (_phaseTimer >= releaseDuration) SetPhase(BowlingPhase.FollowThrough);
                    break;
                case BowlingPhase.FollowThrough:
                    if (_phaseTimer >= followThroughDuration) SetPhase(BowlingPhase.IdleAtRack);
                    break;
            }
        }

        private void UpdateWalkTo(Transform target, BowlingPhase next)
        {
            if (target == null)
            {
                SetPhase(next);
                return;
            }

            Vector3 toTarget = target.position - transform.position;
            Vector3 planar = Vector3.ProjectOnPlane(toTarget, Vector3.up);
            float distance = planar.magnitude;

            if (distance <= arrivalDistance)
            {
                transform.position = new Vector3(target.position.x, transform.position.y, target.position.z);
                SetLocomotion(0f);
                SetPhase(next);
                return;
            }

            Vector3 dir = planar / Mathf.Max(0.0001f, distance);
            FaceDirection(dir);
            transform.position += dir * (walkSpeed * Time.deltaTime);
            SetLocomotion(1f);
        }

        private bool FaceTarget(Vector3 worldTarget)
        {
            Vector3 planar = Vector3.ProjectOnPlane(worldTarget - transform.position, Vector3.up);
            if (planar.sqrMagnitude <= 1e-6f) return true;
            return FaceDirection(planar.normalized);
        }

        private bool FaceDirection(Vector3 forward)
        {
            Quaternion targetRot = Quaternion.LookRotation(forward, Vector3.up);
            transform.rotation = Quaternion.RotateTowards(transform.rotation, targetRot, turnSpeed * Time.deltaTime);
            return Quaternion.Angle(transform.rotation, targetRot) < 1f;
        }

        private void SetPhase(BowlingPhase next)
        {
            _phase = next;
            _phaseTimer = 0f;
            if (animator != null)
            {
                animator.SetInteger(phaseKey, (int)next);
            }

            if (next == BowlingPhase.ThrowPose)
            {
                // right-handed release setup: left leg forward, right leg back, left arm stabilizer
                transform.position = releasePoint != null ? new Vector3(releasePoint.position.x, transform.position.y, releasePoint.position.z) : transform.position;
            }
        }

        private void SetLocomotion(float value)
        {
            if (animator != null)
            {
                animator.SetFloat(locomotionSpeedKey, value);
            }
        }
    }
}
