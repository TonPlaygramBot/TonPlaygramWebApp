using UnityEngine;

namespace Aiming
{
    public static class MathUtil
    {
        public static Vector3 Ortho(Vector3 v)
        {
            return new Vector3(-v.z, 0f, v.x).normalized;
        }

        public static Vector3 OrthoAround(Vector3 v, Vector3 up)
        {
            Vector3 proj = Vector3.ProjectOnPlane(v, up).normalized;
            Vector3 o = Vector3.Cross(up, proj).normalized;
            if (o.sqrMagnitude < 1e-6f) o = new Vector3(-proj.z, 0f, proj.x).normalized;
            return o;
        }

        public static float ClosestRailDistance(Bounds table, Vector3 p)
        {
            float dx = Mathf.Min(Mathf.Abs(p.x - table.min.x), Mathf.Abs(table.max.x - p.x));
            float dz = Mathf.Min(Mathf.Abs(p.z - table.min.z), Mathf.Abs(table.max.z - p.z));
            return Mathf.Min(dx, dz);
        }
    }
}
