using UnityEngine;

namespace Aiming.Gameplay
{
    /// <summary>
    /// Adds explicit helper anchors on the two short and two long rails and constrains
    /// the human root to stay outside of the table bounds while walking around it.
    /// </summary>
    public class HumanRailGuide : MonoBehaviour
    {
        [SerializeField] private CueController cueController;
        [SerializeField] private Transform humanRoot;
        [SerializeField, Min(0f)] private float outsidePadding = 0.03f;
        [SerializeField, Min(0f)] private float railWalkOffset = 0.18f;
        [SerializeField, Range(0f, 1f)] private float cornerSnapBias = 0.18f;
        [SerializeField] private bool drawHelpers = true;

        private readonly Vector3[] railHelpers = new Vector3[8];

        void LateUpdate()
        {
            if (cueController == null || humanRoot == null)
            {
                return;
            }

            BuildRailHelpers();
            ConstrainOutsideTable();
        }

        private void BuildRailHelpers()
        {
            Bounds bounds = cueController.tableBounds;
            Vector3 c = bounds.center;
            Vector3 e = bounds.extents;
            float y = humanRoot.position.y;
            float xOuter = e.x + railWalkOffset;
            float zOuter = e.z + railWalkOffset;
            railHelpers[0] = new Vector3(c.x, y, c.z - zOuter); // short near
            railHelpers[1] = new Vector3(c.x, y, c.z + zOuter); // short far
            railHelpers[2] = new Vector3(c.x - xOuter, y, c.z); // long left
            railHelpers[3] = new Vector3(c.x + xOuter, y, c.z); // long right
            railHelpers[4] = new Vector3(c.x - xOuter, y, c.z - zOuter); // corner near-left
            railHelpers[5] = new Vector3(c.x + xOuter, y, c.z - zOuter); // corner near-right
            railHelpers[6] = new Vector3(c.x - xOuter, y, c.z + zOuter); // corner far-left
            railHelpers[7] = new Vector3(c.x + xOuter, y, c.z + zOuter); // corner far-right
        }

        private void ConstrainOutsideTable()
        {
            Bounds b = cueController.tableBounds;
            Vector3 pos = humanRoot.position;
            float dx = pos.x - b.center.x;
            float dz = pos.z - b.center.z;
            float absX = Mathf.Abs(dx);
            float absZ = Mathf.Abs(dz);

            float minX = b.extents.x + outsidePadding;
            float minZ = b.extents.z + outsidePadding;
            float railX = b.extents.x + railWalkOffset;
            float railZ = b.extents.z + railWalkOffset;

            if (absX < minX && absZ < minZ)
            {
                if ((minX - absX) < (minZ - absZ))
                {
                    pos.x = b.center.x + (Mathf.Sign(dx == 0f ? 1f : dx) * minX);
                }
                else
                {
                    pos.z = b.center.z + (Mathf.Sign(dz == 0f ? 1f : dz) * minZ);
                }

                humanRoot.position = pos;
                return;
            }

            bool currentlyOnLongRail = absX > absZ;
            if (currentlyOnLongRail)
            {
                pos.x = b.center.x + (Mathf.Sign(dx == 0f ? 1f : dx) * railX);
                pos.z = Mathf.Clamp(pos.z, b.center.z - railZ, b.center.z + railZ);
            }
            else
            {
                pos.z = b.center.z + (Mathf.Sign(dz == 0f ? 1f : dz) * railZ);
                pos.x = Mathf.Clamp(pos.x, b.center.x - railX, b.center.x + railX);
            }

            if (Mathf.Abs(absX - absZ) < cornerSnapBias)
            {
                pos.x = b.center.x + (Mathf.Sign(dx == 0f ? 1f : dx) * railX);
                pos.z = b.center.z + (Mathf.Sign(dz == 0f ? 1f : dz) * railZ);
            }

            humanRoot.position = pos;
        }

        void OnDrawGizmosSelected()
        {
            if (!drawHelpers || cueController == null)
            {
                return;
            }

            if (humanRoot != null)
            {
                BuildRailHelpers();
            }

            Gizmos.color = new Color(0.98f, 0.35f, 0.08f, 0.95f);
            for (int i = 0; i < railHelpers.Length; i++)
            {
                Gizmos.DrawSphere(railHelpers[i], 0.04f);
            }
        }
    }
}
