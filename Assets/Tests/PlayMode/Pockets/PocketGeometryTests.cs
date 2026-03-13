using NUnit.Framework;
using UnityEngine;
using Aiming.Pockets;

namespace Aiming.Tests.Pockets
{
    public class PocketGeometryTests
    {
        [Test]
        public void FiniteSegment_ClosestPoint_ClampsOutsideRange()
        {
            var seg = new FiniteJawSegment
            {
                start = new Vector2(0f, 0f),
                end = new Vector2(1f, 0f)
            };

            Vector2 c = seg.ClosestPoint(new Vector2(2f, 0.3f), out float t);
            Assert.That(t, Is.EqualTo(1f).Within(1e-6f));
            Assert.That(c.x, Is.EqualTo(1f).Within(1e-6f));
            Assert.That(c.y, Is.EqualTo(0f).Within(1e-6f));
        }

        [Test]
        public void CircleVsCapsule_DetectsJawContact()
        {
            var seg = new FiniteJawSegment
            {
                start = new Vector2(-0.05f, 0f),
                end = new Vector2(0.05f, 0f)
            };

            bool hit = PocketGeometry.TryCircleVsCapsule(
                center: new Vector2(0f, 0.02f),
                sphereRadius: 0.01f,
                segment: seg,
                capsuleRadius: 0.015f,
                out Vector2 normal,
                out float penetration,
                out _);

            Assert.IsTrue(hit);
            Assert.Greater(penetration, 0f);
            Assert.Greater(normal.y, 0f);
        }

        [Test]
        public void CircleVsTip_DetectsRoundedCapCollision()
        {
            var tip = new JawTip { center = new Vector2(0f, 0f), radius = 0.01f };
            bool hit = PocketGeometry.TryCircleVsTip(
                center: new Vector2(0.015f, 0f),
                sphereRadius: 0.01f,
                tip: tip,
                out Vector2 normal,
                out float penetration);

            Assert.IsTrue(hit);
            Assert.Greater(penetration, 0f);
            Assert.Greater(normal.x, 0f);
        }
    }
}
