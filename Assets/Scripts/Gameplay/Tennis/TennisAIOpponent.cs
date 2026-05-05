using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    public class TennisAIOpponent : MonoBehaviour
    {
        [SerializeField] private TennisShotTuning shotTuning;
        [SerializeField] private Rigidbody ballBody;
        [SerializeField] private Transform hitTarget;
        [SerializeField, Min(0.01f)] private float reactionTime = 0.1f;
        [SerializeField, Min(0f)] private float anticipationTime = 0.14f;
        [SerializeField, Min(0.01f)] private float minReactionTime = 0.05f;
        [SerializeField, Min(0.1f)] private float minShotPower01 = 0.55f;
        [SerializeField, Min(0.1f)] private float maxShotPower01 = 1f;

        private float _nextHitTime;

        private void Update()
        {
            if (shotTuning == null || ballBody == null || hitTarget == null) return;
            if (Time.time < _nextHitTime) return;

            bool ballComingToAi = ballBody.velocity.z > 0f;
            float predictedBallZ = ballBody.position.z + (ballBody.velocity.z * anticipationTime);
            if (ballComingToAi && predictedBallZ > transform.position.z)
            {
                float speed = ballBody.velocity.magnitude;
                float adaptiveReaction = Mathf.Max(minReactionTime, reactionTime - (speed * 0.003f));
                _nextHitTime = Time.time + adaptiveReaction;
                ShootAdaptive();
            }
        }

        private void ShootAdaptive()
        {
            Vector3 aim = (hitTarget.position - ballBody.position).normalized;
            float power = Random.Range(minShotPower01, maxShotPower01);
            ShotVariant variant = (ShotVariant)Random.Range(0, 5);
            shotTuning.ApplyShot(ballBody, aim, power, variant);
        }
    }
}
