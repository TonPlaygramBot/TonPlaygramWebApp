using UnityEngine;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall, objectBall, pocket;
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;
        public float cueDistanceFromBall = 0.12f;
        public float animationPullbackDistance = 0.045f;
        public float animationSpeed = 4f;

        Vector3 _lastAimDirection = Vector3.forward;

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

                    float animationPhase = (Mathf.Sin(Time.time * animationSpeed) + 1f) * 0.5f;
                    float pullback = animationPhase * animationPullbackDistance;
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
    }
}
