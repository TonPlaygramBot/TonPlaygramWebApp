using UnityEngine;

namespace Aiming.Pockets
{
    /// <summary>
    /// Defines the corner pocket mouth from two finite jaws + center/fall direction.
    /// </summary>
    public class PocketMouth : MonoBehaviour
    {
        [SerializeField] private PocketJawDefinition leftJaw;
        [SerializeField] private PocketJawDefinition rightJaw;

        [Header("Pocket shape")]
        [SerializeField, Min(0.01f)] private float mouthWidth = 0.115f;
        [SerializeField, Min(0f)] private float shelfDepth = 0.028f;
        [SerializeField] private Vector2 pocketCenter = new Vector2(0f, -0.06f);
        [SerializeField] private Vector2 fallDirection = new Vector2(0f, -1f);
        [SerializeField, Range(0f, 1f)] private float cushionRestitution = 0.35f;

        public PocketJawDefinition LeftJaw => leftJaw;
        public PocketJawDefinition RightJaw => rightJaw;
        public float MouthWidth => mouthWidth;
        public float ShelfDepth => shelfDepth;
        public float CushionRestitution => cushionRestitution;
        public Vector2 PocketCenter => pocketCenter;
        public Vector2 FallDirection => fallDirection.sqrMagnitude < 1e-6f ? Vector2.down : fallDirection.normalized;

        public bool IsConfigured => leftJaw != null && rightJaw != null;

        public Vector2 MouthCenter
        {
            get
            {
                if (!IsConfigured)
                {
                    return Vector2.zero;
                }

                return (leftJaw.Segment.end + rightJaw.Segment.start) * 0.5f;
            }
        }

        private void OnDrawGizmosSelected()
        {
            if (!IsConfigured)
            {
                return;
            }

            Vector2 mouthCenter = MouthCenter;
            Vector2 openDir = FallDirection;
            Vector2 right = new Vector2(openDir.y, -openDir.x);
            Vector2 half = right * (mouthWidth * 0.5f);
            Vector2 mouthA = mouthCenter - half;
            Vector2 mouthB = mouthCenter + half;
            Vector2 shelfA = mouthA + openDir * shelfDepth;
            Vector2 shelfB = mouthB + openDir * shelfDepth;

            Gizmos.color = Color.cyan;
            DrawLine2D(mouthA, mouthB);

            Gizmos.color = new Color(0.25f, 0.85f, 1f, 1f);
            DrawLine2D(mouthA, shelfA);
            DrawLine2D(mouthB, shelfB);
            DrawLine2D(shelfA, shelfB);

            Gizmos.color = Color.blue;
            DrawSphere2D(pocketCenter, 0.008f);
            DrawLine2D(mouthCenter, mouthCenter + openDir * 0.08f);
        }

        private void DrawLine2D(Vector2 a, Vector2 b)
        {
            Gizmos.DrawLine(new Vector3(a.x, transform.position.y, a.y), new Vector3(b.x, transform.position.y, b.y));
        }

        private void DrawSphere2D(Vector2 p, float radius)
        {
            Gizmos.DrawSphere(new Vector3(p.x, transform.position.y, p.y), radius);
        }
    }
}
