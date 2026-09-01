using NUnit.Framework;
using UnityEngine;

namespace Aiming.Tests
{
    public class ShotClassifierTests
    {
        AimingConfig cfg;
        ShotClassifier clf;

        [SetUp]
        public void Setup()
        {
            cfg = ScriptableObject.CreateInstance<AimingConfig>();
            clf = new ShotClassifier();
        }

        [Test]
        public void StraightDetection()
        {
            var ctx = new ShotContext
            {
                cueBallPos = Vector3.zero,
                objectBallPos = new Vector3(0, 0, 1),
                pocketPos = new Vector3(0, 0, 2),
                ballRadius = 0.028f,
                tableBounds = new Bounds(Vector3.zero, new Vector3(2.54f, 0.5f, 1.27f)),
                collisionMask = ~0
            };
            var info = clf.Classify(ctx, cfg);
            Assert.IsTrue(info.isStraight);
        }
    }
}
