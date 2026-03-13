using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// Finite, bounded jaw segment in table space.
    /// Collision uses closest-point-on-segment, never infinite lines.
    /// </summary>
    [System.Serializable]
    public struct FiniteJawSegment
    {
        public Vector2 start;
        public Vector2 end;

        public Vector2 Direction => end - start;
        public float Length => Direction.magnitude;

        public Vector2 ClosestPoint(Vector2 point, out float t)
        {
            Vector2 d = end - start;
            float lenSq = d.sqrMagnitude;
            if (lenSq < 1e-8f)
            {
                t = 0f;
                return start;
            }

            // Segment-bounded projection: clamp [0..1] guarantees finite jaw only.
            t = Mathf.Clamp01(Vector2.Dot(point - start, d) / lenSq);
            return start + d * t;
        }

        public Vector2 ClosestPoint(Vector2 point)
        {
            return ClosestPoint(point, out _);
        }
    }

    /// <summary>
    /// Rounded jaw cap used for realistic grazing / rattle / rejection.
    /// </summary>
    [System.Serializable]
    public struct JawTip
    {
        public Vector2 center;
        public float radius;

        public Vector2 ClosestPoint(Vector2 point)
        {
            Vector2 delta = point - center;
            float len = delta.magnitude;
            if (len < 1e-6f)
            {
                return center + Vector2.right * radius;
            }

            return center + (delta / len) * radius;
        }
    }

    public static class PocketGeometry
    {
        public static bool TryCircleVsCapsule(
            Vector2 center,
            float sphereRadius,
            FiniteJawSegment segment,
            float capsuleRadius,
            out Vector2 normal,
            out float penetration,
            out Vector2 closest)
        {
            closest = segment.ClosestPoint(center);
            Vector2 delta = center - closest;
            float distance = delta.magnitude;
            float totalRadius = sphereRadius + Mathf.Max(0f, capsuleRadius);
            penetration = totalRadius - distance;

            if (penetration <= 0f)
            {
                normal = Vector2.zero;
                return false;
            }

            if (distance < 1e-6f)
            {
                Vector2 tangent = segment.Direction.normalized;
                normal = new Vector2(-tangent.y, tangent.x);
                if (normal.sqrMagnitude < 1e-6f)
                {
                    normal = Vector2.up;
                }
            }
            else
            {
                normal = delta / distance;
            }

            return true;
        }

        public static bool TryCircleVsTip(
            Vector2 center,
            float sphereRadius,
            JawTip tip,
            out Vector2 normal,
            out float penetration)
        {
            Vector2 delta = center - tip.center;
            float distance = delta.magnitude;
            float totalRadius = sphereRadius + Mathf.Max(0f, tip.radius);
            penetration = totalRadius - distance;

            if (penetration <= 0f)
            {
                normal = Vector2.zero;
                return false;
            }

            normal = distance < 1e-6f ? Vector2.up : delta / distance;
            return true;
        }
    }
}
