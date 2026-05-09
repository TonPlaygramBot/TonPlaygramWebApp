using NUnit.Framework;
using UnityEngine;

namespace Aiming.Tests
{
    public class PoolHumanCharacterProfileTests
    {
        [Test]
        public void AllFivePoolRoyalHumansAreSelectable()
        {
            var profiles = PoolHumanCharacterProfile.GetAllPresets();
            Assert.AreEqual(5, profiles.Length);

            for (int i = 0; i < profiles.Length; i++)
            {
                Assert.IsFalse(string.IsNullOrEmpty(profiles[i].displayName));
                Assert.Greater(profiles[i].skill01, 0f);
            }
        }

        [Test]
        public void CharacterSelectionChangesAimingPersonality()
        {
            var go = new GameObject("engine");
            var eng = go.AddComponent<AdaptiveAimingEngine>();
            eng.config = ScriptableObject.CreateInstance<AimingConfig>();
            eng.config.collisionMask = 0;
            eng.showDebug = false;

            var ctx = new ShotContext
            {
                cueBallPos = new Vector3(-0.35f, 0f, -0.45f),
                objectBallPos = new Vector3(0f, 0f, 0f),
                pocketPos = new Vector3(0.72f, 0f, 1.08f),
                ballRadius = 0.028f,
                tableBounds = new Bounds(Vector3.zero, new Vector3(1.44f, 0.4f, 2.16f)),
                collisionMask = 0
            };

            eng.SetHumanCharacter(PoolHumanCharacterId.ArtaGhostBall);
            AimSolution ghostProfile = eng.GetAimSolution(ctx);

            eng.SetHumanCharacter(PoolHumanCharacterId.BesnikCtePivot);
            AimSolution cteProfile = eng.GetAimSolution(ctx);

            Assert.IsTrue(ghostProfile.isValid);
            Assert.IsTrue(cteProfile.isValid);
            Assert.AreNotEqual(ghostProfile.debugNote, cteProfile.debugNote);
        }
    }
}
