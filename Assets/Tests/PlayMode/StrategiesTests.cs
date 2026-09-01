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
        }
    }
}
