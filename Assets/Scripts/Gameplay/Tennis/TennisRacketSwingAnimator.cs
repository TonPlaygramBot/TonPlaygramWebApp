using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [DisallowMultipleComponent]
    public class TennisRacketSwingAnimator : MonoBehaviour
    {
        [Header("Arm Chain")]
        [SerializeField] private Transform shoulder;
        [SerializeField] private Transform upperArm;
        [SerializeField] private Transform forearm;
        [SerializeField] private Transform handOrRacket;
        [SerializeField] private Animator animator;

        [Header("Swing Shape")]
        [SerializeField, Range(0f, 90f)] private float shoulderBackswingDegrees = 42f;
        [SerializeField, Range(0f, 90f)] private float shoulderFollowThroughDegrees = 58f;
        [SerializeField, Range(0f, 90f)] private float elbowLoadDegrees = 36f;
        [SerializeField, Range(0f, 90f)] private float wristSnapDegrees = 24f;
        [SerializeField, Min(0.01f)] private float backswingSeconds = 0.18f;
        [SerializeField, Min(0.01f)] private float forwardSwingSeconds = 0.16f;
        [SerializeField, Min(0.01f)] private float recoverSeconds = 0.22f;

        private Quaternion _shoulderBase;
        private Quaternion _upperArmBase;
        private Quaternion _forearmBase;
        private Quaternion _handBase;
        private float _swingTimer;
        private float _swingDuration;
        private bool _swinging;
        private bool _serve;

        private void Awake() => CacheBasePose();
        private void OnEnable() => CacheBasePose();

        private void LateUpdate()
        {
            if (!_swinging) return;

            _swingTimer += Time.deltaTime;
            float normalized = Mathf.Clamp01(_swingTimer / _swingDuration);
            ApplySwingPose(normalized, _serve);

            if (_swingTimer >= _swingDuration)
            {
                _swinging = false;
                RestoreBasePose();
            }
        }

        public void PlayShotSwing()
        {
            BeginSwing(false, "Shot");
        }

        public void PlayServeSwing()
        {
            BeginSwing(true, "Serve");
        }

        private void BeginSwing(bool serve, string triggerName)
        {
            CacheBasePose();
            _serve = serve;
            _swingTimer = 0f;
            _swingDuration = backswingSeconds + forwardSwingSeconds + recoverSeconds;
            _swinging = true;

            if (animator != null) animator.SetTrigger(triggerName);
        }

        private void ApplySwingPose(float normalized, bool serve)
        {
            float backswingEnd = backswingSeconds / _swingDuration;
            float forwardEnd = (backswingSeconds + forwardSwingSeconds) / _swingDuration;

            float load01 = normalized <= backswingEnd ? Mathf.SmoothStep(0f, 1f, normalized / backswingEnd) : 1f;
            float strike01 = normalized <= backswingEnd ? 0f : Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(backswingEnd, forwardEnd, normalized));
            float recover01 = normalized <= forwardEnd ? 0f : Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(forwardEnd, 1f, normalized));

            float loadedShoulder = Mathf.Lerp(0f, -shoulderBackswingDegrees, load01);
            float shoulderPitch = Mathf.Lerp(loadedShoulder, shoulderFollowThroughDegrees, strike01);
            shoulderPitch = Mathf.Lerp(shoulderPitch, 0f, recover01);
            float loadedServeLift = serve ? Mathf.Lerp(0f, 24f, load01) : 0f;
            float serveLift = serve ? Mathf.Lerp(loadedServeLift, -18f, strike01) : 0f;
            serveLift = Mathf.Lerp(serveLift, 0f, recover01);
            float loadedElbow = Mathf.Lerp(0f, elbowLoadDegrees, load01);
            float elbowPitch = Mathf.Lerp(loadedElbow, -8f, strike01);
            elbowPitch = Mathf.Lerp(elbowPitch, 0f, recover01);
            float loadedWrist = Mathf.Lerp(0f, -wristSnapDegrees * 0.35f, load01);
            float wristPitch = Mathf.Lerp(loadedWrist, wristSnapDegrees, strike01);
            wristPitch = Mathf.Lerp(wristPitch, 0f, recover01);

            ApplyBone(shoulder, _shoulderBase, Quaternion.Euler(serveLift, shoulderPitch * 0.35f, 0f));
            ApplyBone(upperArm, _upperArmBase, Quaternion.Euler(serveLift * 0.45f, shoulderPitch, 0f));
            ApplyBone(forearm, _forearmBase, Quaternion.Euler(elbowPitch, 0f, 0f));
            ApplyBone(handOrRacket, _handBase, Quaternion.Euler(wristPitch, 0f, 0f));
        }

        private void CacheBasePose()
        {
            if (shoulder != null) _shoulderBase = shoulder.localRotation;
            if (upperArm != null) _upperArmBase = upperArm.localRotation;
            if (forearm != null) _forearmBase = forearm.localRotation;
            if (handOrRacket != null) _handBase = handOrRacket.localRotation;
        }

        private void RestoreBasePose()
        {
            ApplyBone(shoulder, _shoulderBase, Quaternion.identity);
            ApplyBone(upperArm, _upperArmBase, Quaternion.identity);
            ApplyBone(forearm, _forearmBase, Quaternion.identity);
            ApplyBone(handOrRacket, _handBase, Quaternion.identity);
        }

        private static void ApplyBone(Transform bone, Quaternion baseRotation, Quaternion offset)
        {
            if (bone == null) return;
            bone.localRotation = baseRotation * offset;
        }
    }
}
