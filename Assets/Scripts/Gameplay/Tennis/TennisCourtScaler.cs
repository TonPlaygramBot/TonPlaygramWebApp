using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    public class TennisCourtScaler : MonoBehaviour
    {
        [SerializeField] private Transform courtRoot;
        [SerializeField] private Transform[] characterRoots;
        [SerializeField] private Transform[] racketRoots;
        [SerializeField] private Transform ballRoot;
        [SerializeField] private Transform netRoot;
        [SerializeField] private Camera targetCamera;
        [SerializeField] private Transform framingPivot;
        [SerializeField, Min(0.1f)] private float worldScaleMultiplier = 2.55f;
        [SerializeField, Min(1f)] private float framingDistanceScale = 2.35f;

        private bool _initialized;
        private Vector3 _initialCourtScale;
        private Vector3[] _initialCharacterScales;
        private Vector3[] _initialRacketScales;
        private Vector3 _initialBallScale;
        private Vector3 _initialNetScale;
        private Vector3 _initialCameraPosition;

        private void Start()
        {
            ApplyScaleAndFraming();
        }

        [ContextMenu("Apply Scale + Camera Framing")]
        public void ApplyScaleAndFraming()
        {
            EnsureInitialized();

            SetScaled(courtRoot, _initialCourtScale);
            SetScaled(ballRoot, _initialBallScale);
            SetScaled(netRoot, _initialNetScale);
            SetScaledArray(characterRoots, _initialCharacterScales);
            SetScaledArray(racketRoots, _initialRacketScales);

            ApplyCameraFraming();
        }

        private void EnsureInitialized()
        {
            if (_initialized) return;
            _initialized = true;

            _initialCourtScale = courtRoot != null ? courtRoot.localScale : Vector3.one;
            _initialBallScale = ballRoot != null ? ballRoot.localScale : Vector3.one;
            _initialNetScale = netRoot != null ? netRoot.localScale : Vector3.one;

            _initialCharacterScales = CaptureScales(characterRoots);
            _initialRacketScales = CaptureScales(racketRoots);

            if (targetCamera != null)
            {
                _initialCameraPosition = targetCamera.transform.position;
            }
        }

        private void ApplyCameraFraming()
        {
            if (targetCamera == null) return;

            if (framingPivot == null)
            {
                targetCamera.transform.position = _initialCameraPosition * framingDistanceScale;
                return;
            }

            Vector3 offset = _initialCameraPosition - framingPivot.position;
            targetCamera.transform.position = framingPivot.position + (offset * framingDistanceScale);
        }

        private Vector3[] CaptureScales(Transform[] roots)
        {
            if (roots == null) return null;

            var scales = new Vector3[roots.Length];
            for (int i = 0; i < roots.Length; i++)
            {
                scales[i] = roots[i] != null ? roots[i].localScale : Vector3.one;
            }

            return scales;
        }

        private void SetScaledArray(Transform[] roots, Vector3[] baseScales)
        {
            if (roots == null || baseScales == null) return;
            for (int i = 0; i < roots.Length && i < baseScales.Length; i++)
            {
                SetScaled(roots[i], baseScales[i]);
            }
        }

        private void SetScaled(Transform target, Vector3 baseScale)
        {
            if (target == null) return;
            target.localScale = baseScale * worldScaleMultiplier;
        }
    }
}
