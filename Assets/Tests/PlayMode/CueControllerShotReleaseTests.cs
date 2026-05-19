using NUnit.Framework;
using UnityEngine;

namespace Aiming.Tests
{
    public class CueControllerShotReleaseTests
    {
        [Test]
        public void SliderDropFromChargedState_TriggersStrikeImpulse()
        {
            var root = new GameObject("CueControllerRoot");
            var controller = root.AddComponent<CueController>();

            var cueBallGo = new GameObject("CueBall");
            var objectBallGo = new GameObject("ObjectBall");
            var pocketGo = new GameObject("Pocket");
            var cueBallBody = cueBallGo.AddComponent<Rigidbody>();
            cueBallBody.useGravity = false;

            controller.cueBall = cueBallGo.transform;
            controller.objectBall = objectBallGo.transform;
            controller.pocket = pocketGo.transform;
            controller.cueBallBody = cueBallBody;
            controller.aiming = new AdaptiveAimingEngine();
            controller.pullRange = 0.34f;
            controller.idleTipGap = 0.01f;
            controller.minStrikeImpulse = 0.25f;
            controller.maxStrikeImpulse = 6.5f;
            controller.minimumShotPowerNormalized = 0.06f;
            controller.releaseTriggerThresholdNormalized = 0.02f;

            controller.BeginCharge();
            controller.SetChargePower(0.9f);
            controller.SetChargePower(0f);

            Assert.AreEqual(CueController.ShotState.Striking, controller.CurrentShotState);

            Object.DestroyImmediate(root);
            Object.DestroyImmediate(cueBallGo);
            Object.DestroyImmediate(objectBallGo);
            Object.DestroyImmediate(pocketGo);
        }
    }
}
