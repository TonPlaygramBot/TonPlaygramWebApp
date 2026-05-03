using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    public class TennisAIOpponent : MonoBehaviour
    {
        [SerializeField] private TennisShotTuning shotTuning;
        [SerializeField] private Rigidbody ballBody;
        [SerializeField] private Transform hitTarget;
        [SerializeField, Min(0.1f)] private float reactionTime = 0.18f;
        [SerializeField, Min(0.1f)] private float minShotPower01 = 0.55f;
        [SerializeField, Min(0.1f)] private float maxShotPower01 = 1f;

        private float _nextHitTime;

        private void Update()
        {
            if (shotTuning == null || ballBody == null || hitTarget == null) return;
            if (Time.time < _nextHitTime) return;

            if (ballBody.position.z > transform.position.z)
            {
                _nextHitTime = Time.time + reactionTime;
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
