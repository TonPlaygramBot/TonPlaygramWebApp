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
            if (sol.isValid && cueTip != null)
            {
                Vector3 dir = (sol.aimEnd - sol.aimStart);
                if (dir.sqrMagnitude > 1e-6f)
                {
                    dir.Normalize();
                    transform.position = sol.aimStart;
                    transform.rotation = Quaternion.LookRotation(dir, Vector3.up);
                    cueTip.position = sol.aimStart + dir * 0.1f;
                }
            }
        }
    }
}
