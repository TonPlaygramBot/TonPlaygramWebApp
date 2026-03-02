using UnityEngine;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        public enum CueAnimationTechnique
        {
            DirectLerp = 0,
            SmoothDamp = 1,
            SpringDamper = 2,
            CurveDriven = 3,
            ImpulseOvershoot = 4
        }

        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall, objectBall, pocket;
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;
        public float cueDistanceFromBall = 0.12f;
        public float animationPullbackDistance = 0.045f;
        public float animationSpeed = 4f;
        [Header("Cue animation menu")]
        public CueAnimationTechnique animationTechnique = CueAnimationTechnique.DirectLerp;
        [Range(0f, 1f)] public float sliderPull01;
        public bool autoPreviewInEditor = true;
        public float strokeDuration = 0.14f;
        public AnimationCurve strokeCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        float _smoothedPull;
        float _smoothVelocity;
        float _springVelocity;
        float _strokeTimer;
        float _strokeStrength;
        bool _strokeActive;

        Vector3 _lastAimDirection = Vector3.forward;

        public bool IsStrokeActive => _strokeActive;

        public void SetPullFromSlider(float normalizedPull)
        {
            sliderPull01 = Mathf.Clamp01(normalizedPull);
        }

        public void TriggerShotStroke(float normalizedStrength = 1f)
        {
            _strokeStrength = Mathf.Clamp01(normalizedStrength);
            _strokeTimer = 0f;
            _strokeActive = true;
        }

        void Update()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null) return;
            ShotContext ctx = new ShotContext
            {
                cueBallPos = cueBall.position,
                objectBallPos = objectBall.position,
                pocketPos = pocket.position,
                ballRadius = ballRadius,
                tableBounds = tableBounds,
                requiresPower = false,
                highSpin = false,
                collisionMask = aiming.config ? aiming.config.collisionMask : default
            };
            var sol = aiming.GetAimSolution(ctx);
            if (sol.isValid)
            {
                Vector3 dir = (sol.aimEnd - sol.aimStart);
                if (dir.sqrMagnitude > 1e-6f)
                {
                    dir.Normalize();
                    _lastAimDirection = dir;

                    float pullback = ResolvePullback(Time.deltaTime);
                    transform.position = sol.aimStart - dir * (cueDistanceFromBall + pullback);
                    transform.rotation = Quaternion.LookRotation(dir, Vector3.up);
                    if (cueTip != null)
                    {
                        cueTip.position = sol.aimStart;
                    }
                }
            }
            else
            {
                transform.rotation = Quaternion.LookRotation(_lastAimDirection, Vector3.up);
            }
        }

        float ResolvePullback(float deltaTime)
        {
            float basePull = sliderPull01;
            if (autoPreviewInEditor && !_strokeActive)
            {
                basePull = Mathf.PingPong(Time.time * animationSpeed, 1f);
            }

            if (_strokeActive)
            {
                float duration = Mathf.Max(0.02f, strokeDuration);
                _strokeTimer += deltaTime;
                float t = Mathf.Clamp01(_strokeTimer / duration);
                float shapedT = strokeCurve != null ? Mathf.Clamp01(strokeCurve.Evaluate(t)) : t;
                basePull = Mathf.Lerp(sliderPull01, 0f, shapedT * _strokeStrength);
                if (t >= 1f)
                {
                    _strokeActive = false;
                    basePull = 0f;
                }
            }

            float resolvedPull;
            switch (animationTechnique)
            {
                case CueAnimationTechnique.SmoothDamp:
                    resolvedPull = Mathf.SmoothDamp(_smoothedPull, basePull, ref _smoothVelocity, 0.08f, Mathf.Infinity, deltaTime);
                    break;
                case CueAnimationTechnique.SpringDamper:
                    float force = (basePull - _smoothedPull) * 90f;
                    _springVelocity = (_springVelocity + force * deltaTime) * 0.82f;
                    resolvedPull = Mathf.Clamp01(_smoothedPull + _springVelocity * deltaTime);
                    break;
                case CueAnimationTechnique.CurveDriven:
                    float curved = Mathf.SmoothStep(0f, 1f, basePull);
                    resolvedPull = curved * curved;
                    break;
                case CueAnimationTechnique.ImpulseOvershoot:
                    float impulse = _strokeActive ? Mathf.Sin(Mathf.Clamp01(_strokeTimer / Mathf.Max(0.02f, strokeDuration)) * Mathf.PI) * 0.2f : 0f;
                    resolvedPull = Mathf.Clamp01(basePull + impulse);
                    break;
                default:
                    resolvedPull = basePull;
                    break;
            }

            _smoothedPull = resolvedPull;
            return resolvedPull * animationPullbackDistance;
        }
    }
}
