using NUnit.Framework;
using UnityEngine;

namespace Aiming.Tests
{
    public class CueControllerTriggerTests
    {
        [Test]
        public void ReleaseAndStrike_WithLowPullAndCameraUp_StaysIdle()
        {
            var go = new GameObject("cue-controller-low-pull");
            var cueBall = new GameObject("cue-ball").transform;

            try
            {
                var controller = go.AddComponent<CueController>();
                controller.cueBall = cueBall;
                controller.releaseTriggerThresholdNormalized = 0.02f;
                controller.minimumShotPowerNormalized = 0.06f;

                controller.BeginCharge();
                controller.SetChargePower(0.01f);
                controller.ReleaseAndStrike();

                Assert.That(controller.CurrentShotState, Is.EqualTo(CueController.ShotState.Idle));
            }
            finally
            {
                Object.DestroyImmediate(cueBall.gameObject);
                Object.DestroyImmediate(go);
            }
        }

        [Test]
        public void ReleaseAndStrike_WithLowPullAndCameraLowered_TriggersStrike()
        {
            var go = new GameObject("cue-controller-camera-lowered");
            var cueBall = new GameObject("cue-ball").transform;

            try
            {
                var controller = go.AddComponent<CueController>();
                controller.cueBall = cueBall;
                controller.releaseTriggerThresholdNormalized = 0.02f;
                controller.minimumShotPowerNormalized = 0.06f;

                controller.SetCameraLowered(true);
                controller.SetChargePower(0.01f);
                controller.ReleaseAndStrike();

                Assert.That(controller.CurrentShotState, Is.EqualTo(CueController.ShotState.Striking));
            }
            finally
            {
                Object.DestroyImmediate(cueBall.gameObject);
                Object.DestroyImmediate(go);
            }
        }
    }
}
