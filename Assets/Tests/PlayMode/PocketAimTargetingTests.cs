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
                ballRadius = 0.028f,
                tableBounds = new Bounds(Vector3.zero, new Vector3(2f, 0.2f, 4f))
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
                ballRadius = 0.028f,
                tableBounds = new Bounds(Vector3.zero, new Vector3(2f, 0.2f, 4f))
            };

            Vector3 aimPoint = AdaptiveAimingEngine.ComputePocketAimPoint(ctx, cfg);
            Vector3 centerOnly = new Vector3(0f, 0f, 1.88f);
            Assert.That(Mathf.Abs(aimPoint.x), Is.GreaterThan(0.009f));
            Assert.That(Mathf.Abs(aimPoint.x), Is.LessThanOrEqualTo(0.03f));
            Assert.That(Mathf.Abs(aimPoint.z - centerOnly.z), Is.LessThan(0.0001f));
        }

        [Test]
        public void CornerPocketUsesTableEntranceNotPocketBack()
        {
            var cfg = ScriptableObject.CreateInstance<AimingConfig>();
            cfg.pocketApproachDepth = 0.12f;
            cfg.straightPocketCenterAngleDeg = 10f;
            cfg.jawGuideStartAngleDeg = 20f;

            var ctxA = new ShotContext
            {
                objectBallPos = new Vector3(-0.4f, 0f, 0.4f),
                cueBallPos = new Vector3(-0.4f, 0f, -0.8f),
                pocketPos = new Vector3(-1f, 0f, 2f),
                ballRadius = 0.028f,
                tableBounds = new Bounds(Vector3.zero, new Vector3(2f, 0.2f, 4f))
            };

            var ctxB = ctxA;
            ctxB.objectBallPos = new Vector3(-0.7f, 0f, 1.4f);

            Vector3 aimA = AdaptiveAimingEngine.ComputePocketAimPoint(ctxA, cfg);
            Vector3 aimB = AdaptiveAimingEngine.ComputePocketAimPoint(ctxB, cfg);
            Vector3 expectedEntrance = new Vector3(-0.9151472f, 0f, 1.9151472f);

            Assert.That(Vector3.Distance(aimA, expectedEntrance), Is.LessThan(0.0002f));
            Assert.That(Vector3.Distance(aimB, expectedEntrance), Is.LessThan(0.0002f));
        }
    }
}
