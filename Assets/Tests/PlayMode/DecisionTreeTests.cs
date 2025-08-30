using NUnit.Framework;
using UnityEngine;

namespace Aiming.Tests
{
    public class DecisionTreeTests
    {
        [Test]
        public void PicksContactPointForThin()
        {
            var go = new GameObject("engine");
            var eng = go.AddComponent<Aiming.AdaptiveAimingEngine>();
            eng.config = ScriptableObject.CreateInstance<AimingConfig>();
            var ctx = new ShotContext
            {
                cueBallPos = new Vector3(0, 0, 0),
                objectBallPos = new Vector3(0, 0, 1),
                pocketPos = new Vector3(1, 0, 3),
                ballRadius = 0.028f,
                tableBounds = new Bounds(Vector3.zero, new Vector3(2.54f, 0.5f, 1.27f)),
                collisionMask = ~0
            };
            var sol = eng.GetAimSolution(ctx);
            Assert.IsTrue(sol.isValid);
            Assert.IsNotEmpty(sol.strategyUsed);
        }
    }
}
