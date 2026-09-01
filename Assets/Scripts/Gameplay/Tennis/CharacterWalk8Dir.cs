using UnityEngine;

namespace TonPlaygram.Gameplay.Tennis
{
    [RequireComponent(typeof(CharacterController))]
    public class CharacterWalk8Dir : MonoBehaviour
    {
        [SerializeField] private float walkSpeed = 4.5f;
        [SerializeField] private Transform cameraForwardSource;
        [SerializeField] private Animator animator;

        private CharacterController _controller;

        private void Awake() => _controller = GetComponent<CharacterController>();

        private void Update()
        {
            float x = Input.GetAxis("Horizontal");
            float y = Input.GetAxis("Vertical");

            Vector3 forward = cameraForwardSource != null ? cameraForwardSource.forward : Vector3.forward;
            Vector3 right = cameraForwardSource != null ? cameraForwardSource.right : Vector3.right;
            forward.y = 0f;
            right.y = 0f;
            forward.Normalize();
            right.Normalize();

            Vector3 move = (right * x + forward * y);
            if (move.sqrMagnitude > 1f) move.Normalize();

            _controller.Move(move * (walkSpeed * Time.deltaTime));

            if (animator != null)
            {
                animator.SetFloat("MoveX", x);
                animator.SetFloat("MoveY", y);
                animator.SetFloat("Speed", move.magnitude);
            }
        }
    }
}
