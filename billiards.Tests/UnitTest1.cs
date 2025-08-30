using System;
using System.Collections.Generic;
using Billiards;

namespace Billiards.Tests;

public class CcdRegressionTests
{
    [Test]
    public void CircleCircleHeadOn()
    {
        var p0 = new Vec2(0, 0);
        var v0 = new Vec2(1, 0);
        var p1 = new Vec2(1, 0);
        Assert.IsTrue(Ccd.CircleCircle(p0, v0, PhysicsConstants.BallRadius, p1, PhysicsConstants.BallRadius, out double t));
        Assert.That(t, Is.EqualTo(1 - 2 * PhysicsConstants.BallRadius).Within(1e-6));
    }

    [Test]
    public void CircleCircleGlancing()
    {
        var p0 = new Vec2(0, 0);
        var v0 = new Vec2(1, 0);
        // place second ball slightly offset in Y so cue ball barely clips it
        var p1 = new Vec2(1, PhysicsConstants.BallRadius * 1.5);
        Assert.IsTrue(Ccd.CircleCircle(p0, v0, PhysicsConstants.BallRadius, p1, PhysicsConstants.BallRadius, out double t));
        Assert.Greater(t, 0);
    }

    [Test]
    public void NearParallelCushion()
    {
        var p0 = new Vec2(0.5, 0.5);
        var v0 = new Vec2(1e-3, 1);
        Assert.IsTrue(Ccd.CircleAabb(p0, v0, PhysicsConstants.BallRadius, new Vec2(0,0), new Vec2(1,1), out double t, out Vec2 n));
        Assert.Greater(t, 0);
        Assert.That(Math.Abs(n.Y - (-1)), Is.LessThan(1e-6));
    }
}

public class PreviewRuntimeTests
{
    [Test]
    public void PreviewMatchesRuntime()
    {
        var solver = new BilliardsSolver();
        var others = new List<BilliardsSolver.Ball> { new BilliardsSolver.Ball { Position = new Vec2(1.2, 0.5) } };
        var start = new Vec2(0.2, 0.5);
        var dir = new Vec2(1, 0);
        double speed = 2.0;
        var p = solver.PreviewShot(start, dir, speed, others);
        var r = solver.SimulateFirstImpact(start, dir, speed, others);
        Assert.That((p.ContactPoint - r.Point).Length, Is.LessThan(PhysicsConstants.BallRadius * 0.5));
        var angP = Math.Atan2(p.CuePostVelocity.Y, p.CuePostVelocity.X);
        var angR = Math.Atan2(r.CueVelocity.Y, r.CueVelocity.X);
        Assert.That(Math.Abs(angP - angR) * 180 / Math.PI, Is.LessThan(0.5));
    }
}

public class DeterminismTests
{
    [Test]
    public void PreviewDeterministic()
    {
        var solver = new BilliardsSolver();
        var others = new List<BilliardsSolver.Ball> { new BilliardsSolver.Ball { Position = new Vec2(1.2, 0.5) } };
        var start = new Vec2(0.2, 0.5);
        var dir = new Vec2(1, 0);
        double speed = 2.0;
        var a = solver.PreviewShot(start, dir, speed, others);
        var b = solver.PreviewShot(start, dir, speed, others);
        Assert.That((a.ContactPoint - b.ContactPoint).Length, Is.LessThan(1e-9));
    }
}

public class DirectionNormalizationTests
{
    [Test]
    public void PreviewShotNormalizesDirection()
    {
        var solver = new BilliardsSolver();
        var start = new Vec2(0.2, 0.5);
        double speed = 2.0;
        var p1 = solver.PreviewShot(start, new Vec2(1, 0), speed, new List<BilliardsSolver.Ball>());
        var p2 = solver.PreviewShot(start, new Vec2(2, 0), speed, new List<BilliardsSolver.Ball>());
        Assert.That((p1.Path[1] - p2.Path[1]).Length, Is.LessThan(1e-9));
    }
}

public class CushionStepTests
{
    [Test]
    public void BallReflectsWithoutCrossingBoundary()
    {
        var solver = new BilliardsSolver();
        var ball = new BilliardsSolver.Ball { Position = new Vec2(0.2, 0.5), Velocity = new Vec2(-5, 0) };
        solver.Step(new List<BilliardsSolver.Ball> { ball }, 0.1);
        Assert.That(ball.Position.X, Is.GreaterThanOrEqualTo(PhysicsConstants.BallRadius - 1e-9));
        Assert.That(ball.Velocity.X, Is.GreaterThan(0));
    }
}

public class PocketEdgeTests
{
    [Test]
    public void BallBouncesOffPocketEdgeWithReducedEnergy()
    {
        var solver = new BilliardsSolver();
        solver.PocketEdges.Add(new BilliardsSolver.Edge
        {
            A = new Vec2(0, 0.1),
            B = new Vec2(0.1, 0),
            Normal = new Vec2(1, 1).Normalized()
        });
        var v = new Vec2(-1, -1).Normalized();
        var ball = new BilliardsSolver.Ball { Position = new Vec2(0.2, 0.2), Velocity = v };
        double preSpeed = ball.Velocity.Length;
        solver.Step(new List<BilliardsSolver.Ball> { ball }, 0.3);
        var n = new Vec2(1, 1).Normalized();
        double c = Vec2.Dot(new Vec2(0, 0.1), n);
        double dist = Vec2.Dot(ball.Position, n) - c;
        Assert.That(dist, Is.GreaterThanOrEqualTo(PhysicsConstants.BallRadius - 1e-6));
        Assert.That(Vec2.Dot(ball.Velocity, n), Is.GreaterThan(0));
        Assert.That(ball.Velocity.Length, Is.LessThan(preSpeed * PhysicsConstants.PocketRestitution + 1e-3));
    }
}
