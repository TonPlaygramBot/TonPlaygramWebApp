using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Rigidbody))]
    public class TennisBallContactPhysics : MonoBehaviour
    {
        [Header("Contact damping")]
        [Range(0.05f, 1f)] public float humanVelocityRetain = 0.42f;
        [Range(0.05f, 1f)] public float netVelocityRetain = 0.32f;
        [Range(0.05f, 1f)] public float genericSoftVelocityRetain = 0.62f;
        [Range(0f, 1f)] public float spinRetainOnSoftHit = 0.55f;
        [Min(0f)] public float softBounceLift = 0.9f;
        [Min(0f)] public float netDropBias = 0.35f;

        [Header("Rolling loss after contact")]
        [Range(0f, 2f)] public float postContactDrag = 0.2f;
        [Range(0f, 2f)] public float postContactAngularDrag = 0.35f;
        [Min(0f)] public float minimumReadableBounceSpeed = 0.25f;

        [Header("Detection")]
        [SerializeField] private string humanTag = "Player";
        [SerializeField] private string opponentTag = "Opponent";
        [SerializeField] private string netTag = "Net";
        [SerializeField] private string softObstacleTag = "SoftObstacle";

        private Rigidbody _body;
        private float _baseDrag;
        private float _baseAngularDrag;

        private void Awake()
        {
            _body = GetComponent<Rigidbody>();
            _baseDrag = _body.drag;
            _baseAngularDrag = _body.angularDrag;
        }

        private void OnCollisionEnter(Collision collision)
        {
            Vector3 normal = collision.contactCount > 0 ? collision.GetContact(0).normal : Vector3.up;
            ApplyNaturalContactLoss(collision.collider, normal);
        }

        private void OnTriggerEnter(Collider other)
        {
            ApplyNaturalContactLoss(other, Vector3.up);
        }

        private void FixedUpdate()
        {
            if (_body.velocity.sqrMagnitude < minimumReadableBounceSpeed * minimumReadableBounceSpeed)
            {
                _body.drag = Mathf.Lerp(_body.drag, _baseDrag, Time.fixedDeltaTime * 2f);
                _body.angularDrag = Mathf.Lerp(_body.angularDrag, _baseAngularDrag, Time.fixedDeltaTime * 2f);
            }
        }

        private void ApplyNaturalContactLoss(Collider collider, Vector3 contactNormal)
        {
            if (collider == null || _body == null) return;

            ContactKind kind = ResolveContactKind(collider);
            if (kind == ContactKind.HardCourt) return;

            float retain = kind == ContactKind.Net
                ? netVelocityRetain
                : kind == ContactKind.Human
                    ? humanVelocityRetain
                    : genericSoftVelocityRetain;

            Vector3 velocity = _body.velocity;
            Vector3 normal = contactNormal.sqrMagnitude > 0.001f ? contactNormal.normalized : Vector3.up;
            Vector3 tangentVelocity = Vector3.ProjectOnPlane(velocity, normal) * retain;
            Vector3 normalVelocity = Vector3.Project(velocity, normal) * Mathf.Min(retain, 0.45f);
            Vector3 softened = tangentVelocity + normalVelocity;

            float lift = kind == ContactKind.Net ? -netDropBias : softBounceLift;
            softened += Vector3.up * lift;

            _body.velocity = softened;
            _body.angularVelocity *= spinRetainOnSoftHit;
            _body.drag = Mathf.Max(_body.drag, postContactDrag);
            _body.angularDrag = Mathf.Max(_body.angularDrag, postContactAngularDrag);
        }

        private ContactKind ResolveContactKind(Collider collider)
        {
            if (MatchesTag(collider, netTag) || NameContains(collider, "net")) return ContactKind.Net;
            if (MatchesTag(collider, humanTag) || MatchesTag(collider, opponentTag) || NameContains(collider, "human") || NameContains(collider, "player")) return ContactKind.Human;
            if (MatchesTag(collider, softObstacleTag)) return ContactKind.SoftObstacle;
            return ContactKind.HardCourt;
        }

        private static bool MatchesTag(Component component, string tagName)
        {
            return !string.IsNullOrWhiteSpace(tagName) && component.tag == tagName;
        }

        private static bool NameContains(Component component, string token)
        {
            return component.name.ToLowerInvariant().Contains(token);
        }

        private enum ContactKind
        {
            HardCourt,
            Human,
            Net,
            SoftObstacle
        }
    }
}
