using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Aligns hand bones to a three-hole bowling grip (thumb + middle + ring).
    /// </summary>
    public class BowlingBallGripHelper : MonoBehaviour
    {
        [SerializeField] private Transform ballRoot;
        [SerializeField] private Transform thumbHole;
        [SerializeField] private Transform middleHole;
        [SerializeField] private Transform ringHole;

        [Header("Hand Bones")]
        [SerializeField] private Transform thumbTip;
        [SerializeField] private Transform middleTip;
        [SerializeField] private Transform ringTip;

        [SerializeField] private bool updateEveryFrame = true;
        [SerializeField] private float blend = 0.85f;

        public void AlignGrip()
        {
            if (ballRoot == null) return;
            AlignFinger(thumbTip, thumbHole);
            AlignFinger(middleTip, middleHole);
            AlignFinger(ringTip, ringHole);
        }

        private void LateUpdate()
        {
            if (updateEveryFrame)
            {
                AlignGrip();
            }
        }

        private void AlignFinger(Transform fingerTip, Transform hole)
        {
            if (fingerTip == null || hole == null) return;
            fingerTip.position = Vector3.Lerp(fingerTip.position, hole.position, blend);
            fingerTip.rotation = Quaternion.Slerp(fingerTip.rotation, hole.rotation, blend);
        }
    }
}
