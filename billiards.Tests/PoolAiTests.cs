using System;
using Billiards;

namespace Billiards.Tests;

public class PoolAiMathTests
{
    [Test]
    public void SmallestAngleBetweenHandlesWraparound()
    {
        var a = 10 * Math.PI / 180.0;
        var b = 350 * Math.PI / 180.0;
        var diff = PoolAi.SmallestAngleBetweenAngles(a, b);
        Assert.That(diff, Is.EqualTo(20 * Math.PI / 180.0).Within(1e-6));
    }

    [Test]
    public void PocketOpeningComputesOpeningAndCenterOffset()
    {
        var pocket = new Pocket
        {
            Center = new Vec2(2, 0),
            JawLeft = new Vec2(1, 1),
            JawRight = new Vec2(1, -1)
        };
        var metrics = PoolAi.ComputePocketOpening(new Vec2(0, 0), pocket, new Vec2(1, 0), new AiConfig());
        Assert.That(metrics.OpeningAngle, Is.EqualTo(Math.PI / 2).Within(1e-6));
        Assert.That(metrics.CenterOffset, Is.EqualTo(0).Within(1e-6));
    }

    [Test]
    public void GhostBallPositionMatchesDirection()
    {
        var ghost = PoolAi.ComputeGhostBall(new Vec2(1, 1), new Vec2(1, 0), 0.5);
        Assert.That(ghost.Position.X, Is.EqualTo(0).Within(1e-6));
        Assert.That(ghost.Position.Y, Is.EqualTo(1).Within(1e-6));
    }
}
