using System.Collections.Generic;
using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// 2D adapter: same math and tuning, mapped to XY table plane.
    /// </summary>
    public class PocketPhysicsDriver2D : MonoBehaviour
    {
        [System.Serializable]
        private class BallBinding
        {
            public int id;
            public Rigidbody2D body;
            public CircleCollider2D circle;
        }

        [SerializeField] private PocketMouth pocketMouth;
        [SerializeField] private PocketCaptureZone captureZone;
        [SerializeField] private List<BallBinding> balls = new List<BallBinding>();

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
                if (b == null || b.body == null || b.circle == null)
                {
                    continue;
                }

                var adapter = new PoolBallBody2D(b.body, b.circle, b.id);
                collisionResolver.Resolve(adapter, pocketMouth);
                captureResolver.TryCapture(adapter, pocketMouth, captureZone, out _);
            }
        }
    }
}
