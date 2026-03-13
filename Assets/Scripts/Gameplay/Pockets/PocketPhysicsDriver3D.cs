using System.Collections.Generic;
using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// 3D adapter: uses XZ table footprint, keeps Y for vertical fall visuals.
    /// </summary>
    public class PocketPhysicsDriver3D : MonoBehaviour
    {
        [System.Serializable]
        private class BallBinding
        {
            public int id;
            public Rigidbody body;
            public SphereCollider sphere;
        }

        [SerializeField] private PocketMouth pocketMouth;
        [SerializeField] private PocketCaptureZone captureZone;
        [SerializeField] private List<BallBinding> balls = new List<BallBinding>();
        [SerializeField, Min(0f)] private float downwardFallSpeed = 2.4f;

        [SerializeField] private PocketCollisionResolver collisionResolver = new PocketCollisionResolver();
        [SerializeField] private PocketCaptureResolver captureResolver = new PocketCaptureResolver();

        private void FixedUpdate()
        {
            if (pocketMouth == null || captureZone == null)
            {
                return;
            }

            for (int i = 0; i < balls.Count; i++)
            {
                BallBinding b = balls[i];
                if (b == null || b.body == null || b.sphere == null)
                {
                    continue;
                }

                var adapter = new PoolBallBody3D(b.body, b.sphere, b.id);
                collisionResolver.Resolve(adapter, pocketMouth);

                if (captureResolver.TryCapture(adapter, pocketMouth, captureZone, out bool committed) && committed)
                {
                    Vector3 v = b.body.velocity;
                    v.y = -downwardFallSpeed;
                    b.body.velocity = v;
                }
            }
        }
    }
}
