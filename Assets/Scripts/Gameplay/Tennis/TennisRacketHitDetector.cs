using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [DisallowMultipleComponent]
    public class TennisRacketHitDetector : MonoBehaviour
    {
        [SerializeField] private TennisShotTuning shotTuning;
        [SerializeField] private Rigidbody ballBody;
        [SerializeField] private Collider racketFaceCollider;
        [SerializeField] private Transform racketFaceCenter;
        [SerializeField] private Transform aimTarget;
        [SerializeField] private ShotVariant defaultVariant = ShotVariant.Flat;

        [Header("Precision")]
        [Min(0.005f)] public float ballRadius = 0.12f;
        [Min(0.005f)] public float contactTolerance = 0.025f;
        [Range(0f, 1f)] public float minSweetSpot01 = 0.18f;
        [Min(0f)] public float hitCooldown = 0.08f;
        [Range(0f, 1f)] public float minimumRacketForwardDot = 0.12f;

        private Vector3 _lastRacketPosition;
        private Vector3 _racketVelocity;
        private float _nextHitTime;

        private void Awake()
        {
            Transform velocityRoot = racketFaceCenter != null ? racketFaceCenter : transform;
            _lastRacketPosition = velocityRoot.position;
        }

        private void FixedUpdate()
        {
            Transform velocityRoot = racketFaceCenter != null ? racketFaceCenter : transform;
            _racketVelocity = (velocityRoot.position - _lastRacketPosition) / Time.fixedDeltaTime;
            _lastRacketPosition = velocityRoot.position;
        }

        private void OnTriggerStay(Collider other)
        {
            if (ballBody != null && other.attachedRigidbody == ballBody)
            {
                TryHitBall();
            }
        }

        private void OnCollisionStay(Collision collision)
        {
            if (ballBody != null && collision.rigidbody == ballBody)
            {
                TryHitBall();
            }
        }

        public bool TryHitBall()
        {
            if (Time.time < _nextHitTime || shotTuning == null || ballBody == null) return false;
            if (!IsActuallyTouchingBall(out float sweetSpot01)) return false;

            Vector3 aim = ResolveAimDirection();
            float racketSpeed = _racketVelocity.magnitude;
            float incomingSpeed = ballBody.velocity.magnitude;
            float dynamicPower = Mathf.InverseLerp(1.5f, 14f, racketSpeed + (incomingSpeed * 0.35f));
            dynamicPower = Mathf.Lerp(dynamicPower, dynamicPower * sweetSpot01, 0.55f);

            if (!HasForwardContactIntent(aim, racketSpeed)) return false;

            shotTuning.ApplyContactShot(ballBody, aim, dynamicPower, defaultVariant, sweetSpot01, _racketVelocity);
            _nextHitTime = Time.time + hitCooldown;
            return true;
        }

        private bool IsActuallyTouchingBall(out float sweetSpot01)
        {
            sweetSpot01 = 0f;
            Collider face = racketFaceCollider != null ? racketFaceCollider : GetComponent<Collider>();
            if (face == null) return false;

            Vector3 closest = face.ClosestPoint(ballBody.position);
            float distance = Vector3.Distance(closest, ballBody.position);
            if (distance > ballRadius + contactTolerance) return false;

            Vector3 center = racketFaceCenter != null ? racketFaceCenter.position : face.bounds.center;
            float maxSweetSpotDistance = Mathf.Max(Mathf.Max(face.bounds.extents.x, face.bounds.extents.y), Mathf.Max(face.bounds.extents.z, ballRadius));
            sweetSpot01 = 1f - Mathf.Clamp01(Vector3.Distance(closest, center) / maxSweetSpotDistance);
            return sweetSpot01 >= minSweetSpot01;
        }

        private bool HasForwardContactIntent(Vector3 aim, float racketSpeed)
        {
            if (racketSpeed <= 0.05f) return true;
            return Vector3.Dot(_racketVelocity.normalized, aim.normalized) >= minimumRacketForwardDot;
        }

        private Vector3 ResolveAimDirection()
        {
            if (aimTarget != null)
            {
                Vector3 targetAim = aimTarget.position - ballBody.position;
                if (targetAim.sqrMagnitude > 0.001f) return targetAim.normalized;
            }

            if (_racketVelocity.sqrMagnitude > 0.01f) return _racketVelocity.normalized;
            return transform.forward;
        }
    }
}
