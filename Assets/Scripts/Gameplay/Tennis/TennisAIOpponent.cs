using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    public class TennisAIOpponent : MonoBehaviour
    {
        [SerializeField] private TennisShotTuning shotTuning;
        [SerializeField] private Rigidbody ballBody;
        [SerializeField] private Transform hitTarget;
        [SerializeField] private Transform racketContactPoint;
        [SerializeField, Min(0.01f)] private float reactionTime = 0.1f;
        [SerializeField, Min(0f)] private float anticipationTime = 0.14f;
        [SerializeField, Min(0.01f)] private float minReactionTime = 0.05f;
        [SerializeField, Min(0.1f)] private float minShotPower01 = 0.45f;
        [SerializeField, Min(0.1f)] private float maxShotPower01 = 0.82f;
        [SerializeField, Min(0.01f)] private float preciseContactRadius = 0.42f;
        [SerializeField, Range(0f, 1f)] private float edgeContactPenalty = 0.35f;

        private float _nextHitTime;
        private Vector3 _lastRacketPosition;
        private Vector3 _racketVelocity;

        private void Start()
        {
            _lastRacketPosition = ContactPoint.position;
        }

        private void FixedUpdate()
        {
            Vector3 currentRacketPosition = ContactPoint.position;
            _racketVelocity = (currentRacketPosition - _lastRacketPosition) / Time.fixedDeltaTime;
            _lastRacketPosition = currentRacketPosition;
        }

        private void Update()
        {
            if (shotTuning == null || ballBody == null || hitTarget == null) return;
            if (Time.time < _nextHitTime) return;

            bool ballComingToAi = ballBody.velocity.z > 0f;
            float predictedBallZ = ballBody.position.z + (ballBody.velocity.z * anticipationTime);
            if (ballComingToAi && predictedBallZ > transform.position.z && IsBallAtRacket(out float sweetSpot01))
            {
                float speed = ballBody.velocity.magnitude;
                float adaptiveReaction = Mathf.Max(minReactionTime, reactionTime - (speed * 0.003f));
                _nextHitTime = Time.time + adaptiveReaction;
                ShootAdaptive(sweetSpot01);
            }
        }

        private void ShootAdaptive(float sweetSpot01)
        {
            Vector3 aim = (hitTarget.position - ballBody.position).normalized;
            float power = Random.Range(minShotPower01, maxShotPower01) * Mathf.Lerp(edgeContactPenalty, 1f, sweetSpot01);
            ShotVariant variant = (ShotVariant)Random.Range(0, 5);
            shotTuning.ApplyContactShot(ballBody, aim, power, variant, sweetSpot01, _racketVelocity);
        }

        private bool IsBallAtRacket(out float sweetSpot01)
        {
            float distance = Vector3.Distance(ballBody.position, ContactPoint.position);
            sweetSpot01 = 1f - Mathf.Clamp01(distance / preciseContactRadius);
            return distance <= preciseContactRadius;
        }

        private Transform ContactPoint => racketContactPoint != null ? racketContactPoint : transform;
    }
}
