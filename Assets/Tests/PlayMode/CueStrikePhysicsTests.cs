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

        [Test]
        public void Apply_HigherImpulse_ProducesHigherLinearVelocity()
        {
            var lowGo = new GameObject("CueBallLow");
            var lowRb = lowGo.AddComponent<Rigidbody>();
            lowRb.useGravity = false;

            var highGo = new GameObject("CueBallHigh");
            var highRb = highGo.AddComponent<Rigidbody>();
            highRb.useGravity = false;

            var physics = new CueStrikePhysics();
            physics.Apply(lowRb, Vector3.forward, 1.5f, Vector2.zero, 0.028575f);
            physics.Apply(highRb, Vector3.forward, 5f, Vector2.zero, 0.028575f);

            Assert.Greater(highRb.velocity.z, lowRb.velocity.z);

            Object.DestroyImmediate(lowGo);
            Object.DestroyImmediate(highGo);
        }
    }
}
