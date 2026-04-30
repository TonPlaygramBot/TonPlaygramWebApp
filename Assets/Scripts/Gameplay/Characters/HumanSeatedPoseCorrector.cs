using UnityEngine;

namespace TonPlaygram.Gameplay.Characters
{
    /// <summary>
    /// Corrects imported human avatar orientation so seated characters face the expected direction
    /// and keep legs pointing downward on screen.
    /// </summary>
    public sealed class HumanSeatedPoseCorrector : MonoBehaviour
    {
        [SerializeField] private Transform[] characterRoots;
        [SerializeField] private bool runOnAwake = true;
        [SerializeField] private bool includeChildrenWhenEmpty = true;
        [SerializeField] private bool forceWorldUpForLegs = true;
        [SerializeField] private Vector3 localEulerOffset = new Vector3(0f, 180f, 0f);

        private Quaternion _offsetRotation;

        private void Awake()
        {
            _offsetRotation = Quaternion.Euler(localEulerOffset);
            if (runOnAwake)
            {
                ApplySeatedFix();
            }
        }

        [ContextMenu("Apply Seated Orientation Fix")]
        public void ApplySeatedFix()
        {
            Transform[] targets = ResolveTargets();
            for (int i = 0; i < targets.Length; i++)
            {
                Transform root = targets[i];
                if (root == null)
                {
                    continue;
                }

                root.localRotation = _offsetRotation * root.localRotation;

                if (forceWorldUpForLegs)
                {
                    Vector3 euler = root.eulerAngles;
                    euler.z = 0f;
                    root.eulerAngles = euler;
                }
            }
        }

        private Transform[] ResolveTargets()
        {
            if (characterRoots != null && characterRoots.Length > 0)
            {
                return characterRoots;
            }

            if (!includeChildrenWhenEmpty)
            {
                return new[] { transform };
            }

            return GetComponentsInChildren<Transform>(true);
        }
    }
}
