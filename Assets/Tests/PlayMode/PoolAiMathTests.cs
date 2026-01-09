using NUnit.Framework;
using UnityEngine;
using PoolRoyale.AI;

namespace PoolRoyale.AI.Tests
{
    public class PoolAiMathTests
    {
        [Test]
        public void SmallestAngleBetweenHandlesWrap()
        {
            float a = 350f * Mathf.Deg2Rad;
            float b = 10f * Mathf.Deg2Rad;
            float diff = PoolShotSelector.SmallestAngleBetween(a, b);
            Assert.That(diff, Is.EqualTo(20f * Mathf.Deg2Rad).Within(0.001f));
        }

        [Test]
        public void PocketOpeningAndCenterOffsetAreComputed()
        {
            var pocket = new Pocket
            {
                jawLeft = new Vector2(-1f, 1f),
                jawRight = new Vector2(1f, 1f),
                center = new Vector2(0f, 1f)
            };
            Vector2 objectPos = Vector2.zero;
            Vector2 dOP = (pocket.center - objectPos).normalized;
            PocketOpenMetrics metrics = PoolShotSelector.ComputePocketOpening(objectPos, pocket, dOP);
            Assert.That(metrics.openingAngle, Is.GreaterThan(0f));
            Assert.That(metrics.centerOffset, Is.LessThan(0.001f));
        }

        [Test]
        public void GhostBallPositionIsOffsetByTwoRadii()
        {
            Vector2 objectPos = Vector2.zero;
            Vector2 dir = Vector2.right;
            float radius = 0.03f;
            GhostBallMetrics metrics = PoolShotSelector.ComputeGhostBall(objectPos, dir, radius);
            Assert.That(metrics.ghostPos.x, Is.EqualTo(-2f * radius).Within(0.0001f));
            Assert.That(metrics.ghostPos.y, Is.EqualTo(0f).Within(0.0001f));
        }
    }
}
