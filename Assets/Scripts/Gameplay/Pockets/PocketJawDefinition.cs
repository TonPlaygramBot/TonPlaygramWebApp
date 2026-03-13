using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// Inspector-facing jaw data. Points are in table local space (2D footprint: X/Z by default).
    /// </summary>
    public class PocketJawDefinition : MonoBehaviour
    {
        [Header("Jaw bounds (local table space)")]
        [SerializeField] private Vector2 start = new Vector2(-0.05f, 0f);
        [SerializeField] private Vector2 end = new Vector2(0.05f, 0f);

        [Header("Jaw contact")]
        [SerializeField, Min(0f)] private float jawRadius = 0.012f;
        [SerializeField, Range(0f, 1f)] private float jawRestitution = 0.2f;
        [SerializeField, Range(0f, 1f)] private float jawFriction = 0.35f;

        public FiniteJawSegment Segment => new FiniteJawSegment { start = start, end = end };
        public JawTip StartTip => new JawTip { center = start, radius = jawRadius };
        public JawTip EndTip => new JawTip { center = end, radius = jawRadius };

        public float JawRadius => jawRadius;
        public float JawRestitution => jawRestitution;
        public float JawFriction => jawFriction;

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0.9f, 0.4f, 0.15f, 1f);
            DrawCircle(start, jawRadius);
            DrawCircle(end, jawRadius);

            Gizmos.color = new Color(1f, 0.7f, 0.25f, 1f);
            Vector3 a = new Vector3(start.x, transform.position.y, start.y);
            Vector3 b = new Vector3(end.x, transform.position.y, end.y);
            Gizmos.DrawLine(a, b);
        }

        private void DrawCircle(Vector2 p, float r)
        {
            const int steps = 24;
            Vector3 prev = Vector3.zero;
            for (int i = 0; i <= steps; i++)
            {
                float t = i / (float)steps;
                float ang = t * Mathf.PI * 2f;
                Vector3 cur = new Vector3(
                    p.x + Mathf.Cos(ang) * r,
                    transform.position.y,
                    p.y + Mathf.Sin(ang) * r);
                if (i > 0)
                {
                    Gizmos.DrawLine(prev, cur);
                }
                prev = cur;
            }
        }
    }
}
