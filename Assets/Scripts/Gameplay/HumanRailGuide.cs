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
        [SerializeField, Min(0f)] private float outsidePadding = 0.12f;
        [SerializeField] private bool drawHelpers = true;

        private readonly Vector3[] railHelpers = new Vector3[4];

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
            railHelpers[0] = new Vector3(c.x, humanRoot.position.y, c.z - e.z); // short near
            railHelpers[1] = new Vector3(c.x, humanRoot.position.y, c.z + e.z); // short far
            railHelpers[2] = new Vector3(c.x - e.x, humanRoot.position.y, c.z); // long left
            railHelpers[3] = new Vector3(c.x + e.x, humanRoot.position.y, c.z); // long right
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
            }
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
