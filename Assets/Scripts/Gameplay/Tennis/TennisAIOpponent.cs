using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [DisallowMultipleComponent]
    public class TennisAIOpponent : MonoBehaviour
    {
        [Header("Shot References")]
        [SerializeField] private TennisShotTuning shotTuning;
        [SerializeField] private Rigidbody ballBody;
        [SerializeField] private Transform hitTarget;
        [SerializeField] private TennisRacketSwingAnimator swingAnimator;

        [Header("Movement")]
        [SerializeField] private CharacterController characterController;
        [SerializeField] private Transform eyesOrChest;
        [SerializeField] private Transform homePosition;
        [SerializeField] private Vector2 courtXBounds = new Vector2(-4.4f, 4.4f);
        [SerializeField] private Vector2 courtZBounds = new Vector2(-11.3f, 11.3f);
        [SerializeField, Min(0.1f)] private float moveSpeed = 5.8f;
        [SerializeField, Min(0.1f)] private float recoverySpeed = 3.8f;
        [SerializeField, Min(0.01f)] private float rotationSharpness = 12f;
        [SerializeField, Min(0.1f)] private float behindLandingDistance = 1.15f;
        [SerializeField, Min(0.1f)] private float stepInBeforeBounceDistance = 0.85f;
        [SerializeField, Min(0.1f)] private float volleyReachDistance = 2.25f;
        [SerializeField, Min(0.1f)] private float readyStanceDistance = 0.75f;

        [Header("Professional Timing")]
        [SerializeField, Min(0.01f)] private float reactionTime = 0.1f;
        [SerializeField, Min(0.01f)] private float minReactionTime = 0.05f;
        [SerializeField, Min(0.1f)] private float minShotPower01 = 0.45f;
        [SerializeField, Min(0.1f)] private float maxShotPower01 = 0.82f;
        [SerializeField, Min(0.1f)] private float hitRadius = 1.35f;
        [SerializeField, Min(0.01f)] private float hitCooldown = 0.32f;
        [SerializeField] private Vector2 hittableHeight = new Vector2(0.42f, 2.35f);
        [SerializeField, Range(0f, 1f)] private float interventionAggression = 0.72f;

        private float _nextDecisionTime;
        private float _nextHitTime;
        private Vector3 _moveTarget;
        private Vector3 _lastIncomingLanding;
        private bool _hasIncomingRead;
        private bool _plannedVolley;

        public Vector3 MoveTarget => _moveTarget;
        public Vector3 LastIncomingLanding => _lastIncomingLanding;
        public bool HasIncomingRead => _hasIncomingRead;

        private void Awake()
        {
            if (characterController == null) characterController = GetComponent<CharacterController>();
            _moveTarget = GetHomePosition();
        }

        private void Update()
        {
            if (ballBody == null) return;

            bool incoming = IsBallIncomingToThisSide();
            if (incoming && Time.time >= _nextDecisionTime)
            {
                float adaptiveReaction = Mathf.Max(minReactionTime, reactionTime - (ballBody.velocity.magnitude * 0.003f));
                _nextDecisionTime = Time.time + adaptiveReaction;
                PlanProfessionalPosition();
            }
            else if (!incoming)
            {
                _hasIncomingRead = false;
                _plannedVolley = false;
                RecoverToReadyPosition();
            }

            MoveTowardTarget(incoming ? moveSpeed : recoverySpeed);
            LookAtIncomingBall(incoming);

            if (incoming && ShouldInterveneAndHit())
            {
                ShootAdaptive();
            }
        }

        private bool IsBallIncomingToThisSide()
        {
            float sideSign = GetCourtSideSign();
            return Mathf.Sign(ballBody.velocity.z) == sideSign && Mathf.Abs(ballBody.velocity.z) > 0.2f;
        }

        private void PlanProfessionalPosition()
        {
            if (!TryPredictFirstBounce(out Vector3 landingPoint, out float bounceTime))
            {
                _moveTarget = ClampToCourt(ballBody.position);
                _hasIncomingRead = false;
                return;
            }

            _lastIncomingLanding = ClampToCourt(landingPoint);
            _hasIncomingRead = true;

            float sideSign = GetCourtSideSign();
            Vector3 behindBounce = landingPoint + (Vector3.forward * sideSign * behindLandingDistance);
            Vector3 preBounce = landingPoint - (Vector3.forward * sideSign * stepInBeforeBounceDistance);

            bool canVolley = bounceTime > 0.22f
                && Vector3.Distance(transform.position, preBounce) <= volleyReachDistance + (moveSpeed * bounceTime * interventionAggression);

            _plannedVolley = canVolley;
            _moveTarget = ClampToCourt(canVolley ? preBounce : behindBounce);
        }

        private void RecoverToReadyPosition()
        {
            Vector3 home = GetHomePosition();
            Vector3 target = home;
            if (hitTarget != null)
            {
                target.x = Mathf.Lerp(home.x, hitTarget.position.x, 0.18f);
                target.z = home.z;
            }
            _moveTarget = ClampToCourt(target);
        }

        private bool TryPredictFirstBounce(out Vector3 landingPoint, out float timeToBounce)
        {
            landingPoint = ballBody.position;
            timeToBounce = 0f;

            Vector3 gravity = Physics.gravity;
            float courtY = 0.05f;
            float a = 0.5f * gravity.y;
            float b = ballBody.velocity.y;
            float c = ballBody.position.y - courtY;
            float discriminant = (b * b) - (4f * a * c);
            if (discriminant < 0f || Mathf.Approximately(a, 0f)) return false;

            float sqrt = Mathf.Sqrt(discriminant);
            float t1 = (-b - sqrt) / (2f * a);
            float t2 = (-b + sqrt) / (2f * a);
            timeToBounce = t1 > 0.03f ? t1 : t2;
            if (timeToBounce <= 0.03f || timeToBounce > 4f) return false;

            landingPoint = ballBody.position + (ballBody.velocity * timeToBounce) + (0.5f * gravity * timeToBounce * timeToBounce);
            landingPoint.y = transform.position.y;
            return true;
        }

        private bool ShouldInterveneAndHit()
        {
            if (shotTuning == null || hitTarget == null || Time.time < _nextHitTime) return false;
            if (ballBody.position.y < hittableHeight.x || ballBody.position.y > hittableHeight.y) return false;

            Vector3 toBall = ballBody.position - transform.position;
            toBall.y = 0f;
            if (toBall.magnitude > hitRadius) return false;

            if (_plannedVolley) return true;
            if (!_hasIncomingRead) return true;

            float sideSign = GetCourtSideSign();
            bool behindBounceReady = (transform.position.z - _lastIncomingLanding.z) * sideSign >= -0.25f;
            return behindBounceReady;
        }

        private void ShootAdaptive()
        {
            _nextHitTime = Time.time + hitCooldown;
            Vector3 aim = (hitTarget.position - ballBody.position).normalized;
            float power = Random.Range(minShotPower01, maxShotPower01);
            ShotVariant variant = ChooseShotVariant();
            if (swingAnimator != null) swingAnimator.PlayShotSwing();
            shotTuning.ApplyShot(ballBody, aim, power, variant);
        }

        private ShotVariant ChooseShotVariant()
        {
            if (!_hasIncomingRead) return ShotVariant.Flat;

            float width01 = Mathf.InverseLerp(courtXBounds.x, courtXBounds.y, Mathf.Abs(_lastIncomingLanding.x));
            if (_plannedVolley && Random.value < 0.45f) return ShotVariant.Power;
            if (width01 > 0.7f && Random.value < 0.5f) return _lastIncomingLanding.x < 0f ? ShotVariant.CurveRight : ShotVariant.CurveLeft;
            return Random.value < 0.55f ? ShotVariant.Topspin : ShotVariant.Flat;
        }

        private void MoveTowardTarget(float speed)
        {
            Vector3 current = transform.position;
            Vector3 delta = _moveTarget - current;
            delta.y = 0f;
            if (delta.magnitude < 0.03f) return;

            Vector3 step = Vector3.ClampMagnitude(delta, speed * Time.deltaTime);
            if (characterController != null) characterController.Move(step);
            else transform.position += step;
        }

        private void LookAtIncomingBall(bool incoming)
        {
            Vector3 lookTarget = incoming ? ballBody.position : GetHomePosition() + (Vector3.back * GetCourtSideSign() * readyStanceDistance);
            Transform lookSource = eyesOrChest != null ? eyesOrChest : transform;
            Vector3 direction = lookTarget - lookSource.position;
            direction.y = 0f;
            if (direction.sqrMagnitude < 0.001f) return;

            Quaternion targetRotation = Quaternion.LookRotation(direction.normalized, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, 1f - Mathf.Exp(-rotationSharpness * Time.deltaTime));
        }

        private Vector3 ClampToCourt(Vector3 point)
        {
            point.x = Mathf.Clamp(point.x, courtXBounds.x, courtXBounds.y);
            point.z = Mathf.Clamp(point.z, courtZBounds.x, courtZBounds.y);
            point.y = transform.position.y;
            return point;
        }

        private Vector3 GetHomePosition() => homePosition != null ? homePosition.position : transform.position;

        private float GetCourtSideSign()
        {
            float z = homePosition != null ? homePosition.position.z : transform.position.z;
            return z >= 0f ? 1f : -1f;
        }
    }
}
