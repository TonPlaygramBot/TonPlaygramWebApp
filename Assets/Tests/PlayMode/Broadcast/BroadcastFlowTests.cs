using NUnit.Framework;
using UnityEngine;
using Aiming.Gameplay.Broadcast;

namespace Aiming.Tests.Broadcast
{
    public class BroadcastFlowTests
    {
        [Test]
        public void ShotDirector_ForceRailOverheadForNextShot_OverridesPocketSelection()
        {
            var go = new GameObject("shot-director-test");
            try
            {
                var director = go.AddComponent<ShotBroadcastCameraDirector>();
                Vector3 pocketCameraPosition = new Vector3(0.2f, 0.1f, 0.2f);
                var table = new Bounds(Vector3.zero, new Vector3(2f, 0.1f, 1f));

                director.ForceRailOverheadForNextShot();
                var mode = director.ResolveCamera(
                    contactPoint: Vector3.zero,
                    tableBounds: table,
                    cushionHits: 0,
                    pocketKind: PocketKind.Corner,
                    pocketCameraPosition: ref pocketCameraPosition,
                    tableCenter: Vector3.zero);

                Assert.That(mode, Is.EqualTo(BroadcastCameraMode.RailOverhead));
            }
            finally
            {
                Object.DestroyImmediate(go);
            }
        }

        [Test]
        public void ShotDirector_PocketCameraPlacement_StaysUnchangedByDefault()
        {
            var go = new GameObject("shot-director-default-pocket-test");
            try
            {
                var director = go.AddComponent<ShotBroadcastCameraDirector>();
                Vector3 original = new Vector3(0.2f, 0.1f, 0.2f);
                Vector3 pocketCameraPosition = original;
                var table = new Bounds(Vector3.zero, new Vector3(2f, 0.1f, 1f));

                var mode = director.ResolveCamera(
                    contactPoint: new Vector3(0f, 0f, 0.2f),
                    tableBounds: table,
                    cushionHits: 0,
                    pocketKind: PocketKind.Corner,
                    pocketCameraPosition: ref pocketCameraPosition,
                    tableCenter: Vector3.zero);

                Assert.That(mode, Is.EqualTo(BroadcastCameraMode.Pocket));
                Assert.That(pocketCameraPosition, Is.EqualTo(original));
            }
            finally
            {
                Object.DestroyImmediate(go);
            }
        }

        [Test]
        public void ReplayPayload_WithShotIdOnly_IsConsideredValid()
        {
            var payload = new ReplayBroadcastPayload
            {
                shotId = "shot-1",
                cueDirection = Vector3.zero,
                powerNormalized = -1f
            };

            Assert.IsTrue(payload.IsValid);
        }

        [Test]
        public void ReplayGate_BroadcastsEvenWhenLegacyFlagIsDisabled()
        {
            var go = new GameObject("replay-gate-test");
            try
            {
                var gate = go.AddComponent<ReplayBroadcastGate>();
                bool invoked = false;
                gate.ReplayBroadcastRequested += _ => invoked = true;

                gate.SetLegacyReplayMode(false);
                var didBroadcast = gate.TryBroadcastReplay(new ReplayBroadcastPayload
                {
                    shotId = "shot-2",
                    cueDirection = Vector3.forward,
                    powerNormalized = 0.5f
                });

                Assert.IsTrue(didBroadcast);
                Assert.IsTrue(invoked);
            }
            finally
            {
                Object.DestroyImmediate(go);
            }
        }
    }
}
