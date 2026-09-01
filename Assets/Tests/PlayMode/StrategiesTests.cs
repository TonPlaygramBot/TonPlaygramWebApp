using NUnit.Framework;
using UnityEngine;

namespace Aiming.Tests
{
    public class StrategiesTests
    {
        [Test]
        public void GhostBallProducesPoint()
        {
            var s = new Strategies.GhostBallStrategy();
            var info = new ShotInfo { vOP = Vector3.forward };
            var sol = s.Solve(new ShotContext
            {
                cueBallPos = Vector3.zero,
                objectBallPos = new Vector3(0, 0, 1),
                pocketPos = new Vector3(0, 0, 3),
                ballRadius = 0.028f
            }, info, null);
            Assert.IsTrue(sol.isValid);
            Assert.That(Vector3.Distance(sol.aimEnd, new Vector3(0, 0, 0.944f)), Is.LessThan(0.00001f));
        }

        [Test]
        public void GhostBallAimPredictsExactObjectBallDirection()
        {
            const float radius = 0.028f;
            Vector3 cue = Vector3.zero;
            Vector3 objectBall = new Vector3(0f, 0f, 1f);
            Vector3 pocket = new Vector3(0.65f, 0f, 2.4f);
            Vector3 objectDirection = (pocket - objectBall).normalized;
            Vector3 ghost = objectBall - objectDirection * (radius * 2f);

            float error = AdaptiveAimingEngine.CalculateImpactAngularErrorDeg(
                cue, objectBall, pocket, ghost - cue, radius);

            Assert.That(error, Is.LessThan(0.01f));
        }

        [Test]
        public void CenterBallAimIsRejectedForCutShot()
        {
            float error = AdaptiveAimingEngine.CalculateImpactAngularErrorDeg(
                Vector3.zero,
                new Vector3(0f, 0f, 1f),
                new Vector3(0.65f, 0f, 2.4f),
                Vector3.forward,
                0.028f);

            Assert.That(error, Is.GreaterThan(20f));
        }
    }
}
