using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    public class TennisCourtScaler : MonoBehaviour
    {
        [SerializeField] private Transform courtRoot;
        [SerializeField] private Transform[] characterRoots;
        [SerializeField] private Camera targetCamera;
        [SerializeField, Min(0.1f)] private float worldScaleMultiplier = 1.2f;
        [SerializeField, Min(1f)] private float framingDistanceScale = 1.2f;

        private void Start()
        {
            ApplyScaleAndFraming();
        }

        [ContextMenu("Apply Scale + Camera Framing")]
        public void ApplyScaleAndFraming()
        {
            if (courtRoot != null) courtRoot.localScale *= worldScaleMultiplier;
            if (characterRoots != null)
            {
                for (int i = 0; i < characterRoots.Length; i++)
                {
                    if (characterRoots[i] != null) characterRoots[i].localScale *= worldScaleMultiplier;
                }
            }

            if (targetCamera != null)
            {
                targetCamera.transform.position *= framingDistanceScale;
            }
        }
    }
}
