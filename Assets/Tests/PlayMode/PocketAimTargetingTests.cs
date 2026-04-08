using NUnit.Framework;
using UnityEngine;

namespace Aiming.Tests
{
    public class PocketAimTargetingTests
    {
        [Test]
        public void StraightShotTargetsPocketEntranceCenter()
        {
            var cfg = ScriptableObject.CreateInstance<AimingConfig>();
            cfg.pocketApproachDepth = 0.12f;
            cfg.straightPocketCenterAngleDeg = 7f;

            var ctx = new ShotContext
            {
                objectBallPos = Vector3.zero,
                cueBallPos = new Vector3(0f, 0f, -1f),
                pocketPos = new Vector3(0f, 0f, 2f),
                ballRadius = 0.028f
            };

            Vector3 aimPoint = AdaptiveAimingEngine.ComputePocketAimPoint(ctx, cfg);
            Vector3 expected = new Vector3(0f, 0f, 1.88f);
            Assert.That(Vector3.Distance(aimPoint, expected), Is.LessThan(0.0001f));
        }

        [Test]
        public void AngledShotUsesJawGuidedLateralOffset()
        {
            var cfg = ScriptableObject.CreateInstance<AimingConfig>();
            cfg.pocketApproachDepth = 0.12f;
            cfg.straightPocketCenterAngleDeg = 7f;
            cfg.jawGuideStartAngleDeg = 10f;
            cfg.jawGuideMaxAngleDeg = 50f;
            cfg.jawGuideOffsetMin = 0.01f;
            cfg.jawGuideOffsetMax = 0.03f;

            var ctx = new ShotContext
            {
                objectBallPos = Vector3.zero,
                cueBallPos = new Vector3(0.55f, 0f, -1f),
                pocketPos = new Vector3(0f, 0f, 2f),
                ballRadius = 0.028f
            };

            Vector3 aimPoint = AdaptiveAimingEngine.ComputePocketAimPoint(ctx, cfg);
            Vector3 centerOnly = new Vector3(0f, 0f, 1.88f);
            Assert.That(Mathf.Abs(aimPoint.x), Is.GreaterThan(0.009f));
            Assert.That(Mathf.Abs(aimPoint.x), Is.LessThanOrEqualTo(0.03f));
            Assert.That(Mathf.Abs(aimPoint.z - centerOnly.z), Is.LessThan(0.0001f));
        }
    }
}
