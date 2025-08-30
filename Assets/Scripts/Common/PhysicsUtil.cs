using UnityEngine;

namespace Aiming
{
    public static class PhysicsUtil
    {
        public static bool SphereLineClear(Vector3 a, Vector3 b, float radius, LayerMask mask)
        {
            Vector3 dir = b - a;
            float dist = dir.magnitude;
            if (dist < 1e-4f) return true;
            dir /= dist;
            return !Physics.SphereCast(a, radius, dir, out _, dist, mask, QueryTriggerInteraction.Ignore);
        }
    }
}
