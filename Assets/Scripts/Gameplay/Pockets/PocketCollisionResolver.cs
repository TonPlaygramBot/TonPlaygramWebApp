using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// Resolves jaw-face + rounded-tip contacts using explicit billiards response.
    /// Tuned for realistic corner-pocket jaw rattle and glancing slides.
    /// </summary>
    [System.Serializable]
    public class PocketCollisionResolver
    {
        [SerializeField, Min(0f)] private float positionalSlop = 0.0002f;
        [SerializeField, Min(0f)] private float maxPushOut = 0.02f;

        [Header("Jaw realism")]
        [SerializeField, Range(0f, 1f)] private float glancingRestitutionScale = 0.4f;
        [SerializeField, Range(0f, 1f)] private float glancingFrictionScale = 0.5f;
        [SerializeField, Min(0f)] private float minTangentialCarry = 0.03f;
        [SerializeField, Range(0f, 1f)] private float pocketGuidance = 0.22f;

        public bool Resolve(IPoolBallBody ball, PocketMouth mouth)
        {
            if (ball == null || !ball.IsValid || ball.IsKinematic || mouth == null || !mouth.IsConfigured)
            {
                return false;
            }

            bool any = false;
            any |= ResolveJaw(ball, mouth, mouth.LeftJaw);
            any |= ResolveJaw(ball, mouth, mouth.RightJaw);
            any |= ResolveTip(ball, mouth, mouth.GetEffectiveStartTip(mouth.LeftJaw), mouth.LeftJaw.JawRestitution, mouth.LeftJaw.JawFriction);
            any |= ResolveTip(ball, mouth, mouth.GetEffectiveEndTip(mouth.LeftJaw), mouth.LeftJaw.JawRestitution, mouth.LeftJaw.JawFriction);
            any |= ResolveTip(ball, mouth, mouth.GetEffectiveStartTip(mouth.RightJaw), mouth.RightJaw.JawRestitution, mouth.RightJaw.JawFriction);
            any |= ResolveTip(ball, mouth, mouth.GetEffectiveEndTip(mouth.RightJaw), mouth.RightJaw.JawRestitution, mouth.RightJaw.JawFriction);
            return any;
        }

        private bool ResolveJaw(IPoolBallBody ball, PocketMouth mouth, PocketJawDefinition jaw)
        {
            FiniteJawSegment segment = mouth.GetEffectiveJawSegment(jaw);
            if (!PocketGeometry.TryCircleVsCapsule(
                    ball.Position2,
                    ball.Radius,
                    segment,
                    jaw.JawRadius,
                    out Vector2 normal,
                    out float penetration,
                    out Vector2 closest))
            {
                return false;
            }

            Vector2 tangent = segment.Direction.sqrMagnitude > 1e-8f
                ? segment.Direction.normalized
                : new Vector2(-normal.y, normal.x);
            ApplyCollisionResponse(ball, mouth, normal, tangent, closest, penetration, jaw.JawRestitution, jaw.JawFriction);
            return true;
        }

        private bool ResolveTip(IPoolBallBody ball, PocketMouth mouth, JawTip tip, float restitution, float friction)
        {
            if (!PocketGeometry.TryCircleVsTip(ball.Position2, ball.Radius, tip, out Vector2 normal, out float penetration))
            {
                return false;
            }

            Vector2 tangent = new Vector2(-normal.y, normal.x);
            ApplyCollisionResponse(ball, mouth, normal, tangent, tip.center, penetration, restitution, friction);
            return true;
        }

        private void ApplyCollisionResponse(
            IPoolBallBody ball,
            PocketMouth mouth,
            Vector2 normal,
            Vector2 tangent,
            Vector2 contactPoint,
            float penetration,
            float restitution,
            float friction)
        {
            float push = Mathf.Min(Mathf.Max(0f, penetration + positionalSlop), maxPushOut);
            ball.Position2 += normal * push;

            Vector2 vel = ball.Velocity2;
            float vn = Vector2.Dot(vel, normal);

            // Only reflect when moving into the jaw.
            if (vn >= 0f)
            {
                return;
            }

            if (tangent.sqrMagnitude < 1e-8f)
            {
                tangent = new Vector2(-normal.y, normal.x);
            }
            tangent.Normalize();

            float tangentSpeedSigned = Vector2.Dot(vel, tangent);
            float tangentSpeed = Mathf.Abs(tangentSpeedSigned);
            float normalSpeed = -vn;
            float impactRatio = normalSpeed / Mathf.Max(1e-5f, normalSpeed + tangentSpeed);

            float effectiveRestitution = Mathf.Lerp(
                Mathf.Clamp01(restitution) * Mathf.Clamp01(glancingRestitutionScale),
                Mathf.Clamp01(restitution),
                impactRatio);

            float effectiveFriction = Mathf.Lerp(
                Mathf.Clamp01(friction) * Mathf.Clamp01(glancingFrictionScale),
                Mathf.Clamp01(friction),
                impactRatio);

            float reflectedNormalSpeed = normalSpeed * effectiveRestitution;
            float outTangentSpeed = tangentSpeedSigned * (1f - effectiveFriction);

            // Keep a small tangential carry on glancing contacts so balls rattle/slide naturally
            // on jaw angles instead of unnaturally sticking or kicking straight out.
            float minCarry = minTangentialCarry * (normalSpeed + tangentSpeed);
            if (Mathf.Abs(outTangentSpeed) < minCarry)
            {
                float sign = Mathf.Abs(tangentSpeedSigned) > 1e-5f ? Mathf.Sign(tangentSpeedSigned) : 1f;
                outTangentSpeed = sign * minCarry;
            }

            // Bias glancing contacts toward the pocket opening direction.
            Vector2 toPocket = mouth.PocketCenter - contactPoint;
            if (toPocket.sqrMagnitude > 1e-8f)
            {
                Vector2 toPocketDir = toPocket.normalized;
                float tangentTowardPocket = Vector2.Dot(tangent, toPocketDir);
                outTangentSpeed += tangentTowardPocket * normalSpeed * pocketGuidance;
            }

            ball.Velocity2 = normal * reflectedNormalSpeed + tangent * outTangentSpeed;
        }
    }
}
