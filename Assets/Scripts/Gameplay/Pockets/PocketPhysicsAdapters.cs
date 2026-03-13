using UnityEngine;

namespace Aiming.Pockets
{
    public interface IPoolBallBody
    {
        int Id { get; }
        float Radius { get; }
        Vector2 Position2 { get; set; }
        Vector2 Velocity2 { get; set; }
        bool IsValid { get; }
        bool IsKinematic { get; }
        void AddImpulse2(Vector2 impulse);
    }

    public sealed class PoolBallBody2D : IPoolBallBody
    {
        private readonly Rigidbody2D body;
        private readonly CircleCollider2D circle;

        public PoolBallBody2D(Rigidbody2D body, CircleCollider2D circle, int id)
        {
            this.body = body;
            this.circle = circle;
            Id = id;
        }

        public int Id { get; }
        public float Radius => circle != null ? Mathf.Abs(circle.radius * Mathf.Max(circle.transform.lossyScale.x, circle.transform.lossyScale.y)) : 0.028575f;
        public Vector2 Position2 { get => body.position; set => body.position = value; }
        public Vector2 Velocity2 { get => body.velocity; set => body.velocity = value; }
        public bool IsValid => body != null;
        public bool IsKinematic => body == null || body.bodyType != RigidbodyType2D.Dynamic;

        public void AddImpulse2(Vector2 impulse)
        {
            body.AddForce(impulse, ForceMode2D.Impulse);
        }
    }

    public sealed class PoolBallBody3D : IPoolBallBody
    {
        private readonly Rigidbody body;
        private readonly SphereCollider sphere;

        public PoolBallBody3D(Rigidbody body, SphereCollider sphere, int id)
        {
            this.body = body;
            this.sphere = sphere;
            Id = id;
        }

        public int Id { get; }
        public float Radius => sphere != null ? Mathf.Abs(sphere.radius * Mathf.Max(sphere.transform.lossyScale.x, sphere.transform.lossyScale.z)) : 0.028575f;
        public Vector2 Position2
        {
            get => new Vector2(body.position.x, body.position.z);
            set
            {
                Vector3 p = body.position;
                p.x = value.x;
                p.z = value.y;
                body.position = p;
            }
        }

        public Vector2 Velocity2
        {
            get => new Vector2(body.velocity.x, body.velocity.z);
            set
            {
                Vector3 v = body.velocity;
                v.x = value.x;
                v.z = value.y;
                body.velocity = v;
            }
        }

        public bool IsValid => body != null;
        public bool IsKinematic => body == null || body.isKinematic;

        public void AddImpulse2(Vector2 impulse)
        {
            body.AddForce(new Vector3(impulse.x, 0f, impulse.y), ForceMode.Impulse);
        }
    }
}
