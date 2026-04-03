using NUnit.Framework;
using UnityEngine;

namespace Aiming.Tests
{
    public class CueStrikePhysicsTests
    {
        [Test]
        public void Apply_NoSpin_AddsForwardVelocity()
        {
            var go = new GameObject("CueBall");
            var rb = go.AddComponent<Rigidbody>();
            rb.useGravity = false;

            var physics = new CueStrikePhysics();
            physics.Apply(rb, Vector3.forward, 2f, Vector2.zero, 0.028575f);

            Assert.Greater(rb.velocity.z, 0f);
            Assert.That(rb.angularVelocity.sqrMagnitude, Is.EqualTo(0f).Within(1e-6f));

            Object.DestroyImmediate(go);
        }

        [Test]
        public void Apply_WithSideSpin_AddsAngularVelocity()
        {
            var go = new GameObject("CueBall");
            var rb = go.AddComponent<Rigidbody>();
            rb.useGravity = false;

            var physics = new CueStrikePhysics();
            physics.Apply(rb, Vector3.forward, 2f, new Vector2(0.75f, 0f), 0.028575f);

            Assert.Greater(rb.velocity.z, 0f);
            Assert.Greater(rb.angularVelocity.y, 0f);

            Object.DestroyImmediate(go);
        }
    }
}
