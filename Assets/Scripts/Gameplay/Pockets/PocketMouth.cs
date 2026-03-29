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
        [SerializeField, Min(0f)] private float cornerSideCushionTrim = 0.006f;

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

        public Vector3 MouthCenterWorld => ToWorld(MouthCenter);
        public Vector3 PocketCenterWorld => ToWorld(pocketCenter);

        public FiniteJawSegment GetEffectiveJawSegment(PocketJawDefinition jaw)
        {
            FiniteJawSegment segment = jaw.Segment;
            if (!IsCornerPocket || cornerSideCushionTrim <= 1e-6f)
            {
                return segment;
            }

            Vector2 toMouth = MouthCenter - segment.start;
            if (Vector2.Dot(segment.Direction, toMouth) > 0f)
            {
                Vector2 trimmedEnd = MoveToward(segment.end, segment.start, cornerSideCushionTrim);
                segment.end = trimmedEnd;
            }
            else
            {
                Vector2 trimmedStart = MoveToward(segment.start, segment.end, cornerSideCushionTrim);
                segment.start = trimmedStart;
            }

            return segment;
        }

        public JawTip GetEffectiveStartTip(PocketJawDefinition jaw)
        {
            FiniteJawSegment segment = GetEffectiveJawSegment(jaw);
            return new JawTip { center = segment.start, radius = jaw.JawRadius };
        }

        public JawTip GetEffectiveEndTip(PocketJawDefinition jaw)
        {
            FiniteJawSegment segment = GetEffectiveJawSegment(jaw);
            return new JawTip { center = segment.end, radius = jaw.JawRadius };
        }

        public bool IsCornerPocket
        {
            get
            {
                Vector2 dir = FallDirection;
                return Mathf.Abs(dir.x) > 0.2f && Mathf.Abs(dir.y) > 0.2f;
            }
        }

        private Vector3 ToWorld(Vector2 local2)
        {
            return transform.TransformPoint(new Vector3(local2.x, 0f, local2.y));
        }

        private static Vector2 MoveToward(Vector2 from, Vector2 to, float distance)
        {
            Vector2 delta = to - from;
            float len = delta.magnitude;
            if (len < 1e-6f)
            {
                return from;
            }

            return from + delta / len * Mathf.Min(distance, len * 0.45f);
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
