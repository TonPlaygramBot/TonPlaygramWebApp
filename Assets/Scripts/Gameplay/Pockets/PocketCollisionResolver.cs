using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// Resolves jaw-face + rounded-tip contacts using explicit billiards response.
    /// </summary>
    [System.Serializable]
    public class PocketCollisionResolver
    {
        [SerializeField, Min(0f)] private float positionalSlop = 0.0002f;
        [SerializeField, Min(0f)] private float maxPushOut = 0.02f;

        public bool Resolve(IPoolBallBody ball, PocketMouth mouth)
        {
            if (ball == null || !ball.IsValid || ball.IsKinematic || mouth == null || !mouth.IsConfigured)
            {
                return false;
            }

            bool any = false;
            any |= ResolveJaw(ball, mouth.LeftJaw);
            any |= ResolveJaw(ball, mouth.RightJaw);
            any |= ResolveTip(ball, mouth.LeftJaw.StartTip, mouth.LeftJaw.JawRestitution, mouth.LeftJaw.JawFriction);
            any |= ResolveTip(ball, mouth.LeftJaw.EndTip, mouth.LeftJaw.JawRestitution, mouth.LeftJaw.JawFriction);
            any |= ResolveTip(ball, mouth.RightJaw.StartTip, mouth.RightJaw.JawRestitution, mouth.RightJaw.JawFriction);
            any |= ResolveTip(ball, mouth.RightJaw.EndTip, mouth.RightJaw.JawRestitution, mouth.RightJaw.JawFriction);
            return any;
        }

        private bool ResolveJaw(IPoolBallBody ball, PocketJawDefinition jaw)
        {
            FiniteJawSegment segment = jaw.Segment;
            if (!PocketGeometry.TryCircleVsCapsule(
                    ball.Position2,
                    ball.Radius,
                    segment,
                    jaw.JawRadius,
                    out Vector2 normal,
                    out float penetration,
                    out _))
            {
                return false;
            }

            ApplyCollisionResponse(ball, normal, penetration, jaw.JawRestitution, jaw.JawFriction);
            return true;
        }

        private bool ResolveTip(IPoolBallBody ball, JawTip tip, float restitution, float friction)
        {
            if (!PocketGeometry.TryCircleVsTip(ball.Position2, ball.Radius, tip, out Vector2 normal, out float penetration))
            {
                return false;
            }

            ApplyCollisionResponse(ball, normal, penetration, restitution, friction);
            return true;
        }

        private void ApplyCollisionResponse(IPoolBallBody ball, Vector2 normal, float penetration, float restitution, float friction)
        {
            float push = Mathf.Min(Mathf.Max(0f, penetration + positionalSlop), maxPushOut);
            ball.Position2 += normal * push;

            Vector2 vel = ball.Velocity2;
            float vn = Vector2.Dot(vel, normal);

            // Only reflect when moving into the jaw.
            if (vn < 0f)
            {
                Vector2 vN = normal * vn;
                Vector2 vT = vel - vN;
                Vector2 reflectedN = -vN * Mathf.Clamp01(restitution);
                Vector2 dampedT = vT * Mathf.Clamp01(1f - friction);
                ball.Velocity2 = reflectedN + dampedT;
            }
        }
    }
}
