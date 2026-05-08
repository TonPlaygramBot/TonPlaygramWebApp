using UnityEngine;

namespace TonPlaygram.Gameplay.Weapons
{
    /// <summary>
    /// Keeps the dice precisely seated inside the player's palm during grab/hold poses.
    /// Attach this to the dice object or any controller object and assign refs in inspector.
    /// </summary>
    public sealed class LudoDicePalmAlignment : MonoBehaviour
    {
        [SerializeField] private Transform diceTransform;
        [SerializeField] private Transform palmAnchor;
        [SerializeField] private bool alignEveryFrame = true;
        [SerializeField] private Vector3 palmOffset = new Vector3(0f, -0.03f, 0.02f);
        [SerializeField] private Vector3 palmEulerOffset = new Vector3(5f, 0f, 90f);

        private Quaternion _localRotationOffset;

        private void Awake()
        {
            if (diceTransform == null)
            {
                diceTransform = transform;
            }

            _localRotationOffset = Quaternion.Euler(palmEulerOffset);
            SnapToPalm();
        }

        private void LateUpdate()
        {
            if (!alignEveryFrame)
                return;

            SnapToPalm();
        }

        [ContextMenu("Snap Dice To Palm")]
        public void SnapToPalm()
        {
            if (diceTransform == null || palmAnchor == null)
                return;

            diceTransform.position = palmAnchor.TransformPoint(palmOffset);
            diceTransform.rotation = palmAnchor.rotation * _localRotationOffset;
        }
    }
}
