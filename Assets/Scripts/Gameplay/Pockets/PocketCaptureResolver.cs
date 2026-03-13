using System.Collections.Generic;
using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// Determines when a ball crosses pocket mouth and is committed to falling.
    /// Separate from collision so entering balls are not unrealistically bounced out.
    /// </summary>
    [System.Serializable]
    public class PocketCaptureResolver
    {
        [SerializeField] private bool deterministicRejection = true;
        [SerializeField, Min(0f)] private float sinkSpeed = 3.2f;

        private readonly HashSet<int> committedBallIds = new HashSet<int>();

        public bool IsCommitted(int id) => committedBallIds.Contains(id);
        public void ClearCommitted(int id) => committedBallIds.Remove(id);

        public bool TryCapture(IPoolBallBody ball, PocketMouth mouth, PocketCaptureZone capture, out bool committed)
        {
            committed = false;
            if (ball == null || !ball.IsValid || mouth == null || capture == null || !mouth.IsConfigured)
            {
                return false;
            }

            Vector2 mouthCenter = mouth.MouthCenter;
            Vector2 openDir = mouth.FallDirection;
            Vector2 toBall = ball.Position2 - mouthCenter;
            float depth = Vector2.Dot(toBall, openDir);
            float lateral = Mathf.Abs(Vector2.Dot(toBall, new Vector2(openDir.y, -openDir.x)));

            if (lateral > (mouth.MouthWidth * 0.5f + capture.CaptureThreshold))
            {
                return false;
            }

            if (depth < capture.MinimumCaptureDepth)
            {
                return false;
            }

            Vector2 vel = ball.Velocity2;
            float speed = vel.magnitude;
            if (speed < 1e-5f)
            {
                Commit(ball, openDir, capture, ref committed);
                return true;
            }

            float angle = Vector2.Angle(vel.normalized, openDir);
            bool validAngle = angle <= capture.RejectionAngleTolerance;
            bool tooFastForGuaranteed = speed > capture.CleanCaptureSpeedThreshold;

            if (!validAngle)
            {
                return false;
            }

            if (tooFastForGuaranteed)
            {
                bool reject = deterministicRejection
                    ? angle > capture.RejectionAngleTolerance * 0.85f
                    : Random.value < capture.FastGlanceRejectionChance;
                if (reject)
                {
                    return false;
                }
            }

            Commit(ball, openDir, capture, ref committed);
            return true;
        }

        private void Commit(IPoolBallBody ball, Vector2 openDir, PocketCaptureZone capture, ref bool committed)
        {
            if (capture.CommitOnCapture)
            {
                committedBallIds.Add(ball.Id);
                committed = true;
            }

            // 2D + 3D shared behavior: once captured, pull velocity into pocket centerline.
            ball.Velocity2 = openDir * sinkSpeed;
        }
    }
}
