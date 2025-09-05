using System;
using System.Collections.Generic;

namespace Billiards;

/// <summary>Main deterministic physics solver for billiards.</summary>
public class BilliardsSolver
{
    public class Ball
    {
        public Vec2 Position;
        public Vec2 Velocity;
    }

    public struct Edge
    {
        public Vec2 A;
        public Vec2 B;
        public Vec2 Normal;
    }

    public List<Edge> PocketEdges { get; } = new List<Edge>();

    public struct Preview
    {
        public List<Vec2> Path;
        public Vec2 ContactPoint;
        public Vec2 CuePostVelocity;
        public Vec2? TargetPostVelocity;
    }

    public struct Impact
    {
        public Vec2 Point;
        public Vec2 CueVelocity;
        public Vec2? TargetVelocity;
    }

    private bool IsBeyondPocketEdges(Vec2 position)
    {
        foreach (var e in PocketEdges)
        {
            var n = e.Normal.Normalized();
            double dist = Vec2.Dot(position - e.A, n);
            if (dist < -PhysicsConstants.BallRadius)
                return true;
        }
        return false;
    }

    private void ClampToTable(Ball b)
    {
        double minX = PhysicsConstants.BallRadius;
        double maxX = PhysicsConstants.TableWidth - PhysicsConstants.BallRadius;
        double minY = PhysicsConstants.BallRadius;
        double maxY = PhysicsConstants.TableHeight - PhysicsConstants.BallRadius;

        bool outOfBounds = b.Position.X < minX || b.Position.X > maxX || b.Position.Y < minY || b.Position.Y > maxY;
        if (outOfBounds && IsBeyondPocketEdges(b.Position))
            return;

        if (b.Position.X < minX)
        {
            b.Position = new Vec2(minX, b.Position.Y);
            if (b.Velocity.X < 0)
                b.Velocity = new Vec2(-b.Velocity.X * PhysicsConstants.CushionRestitution, b.Velocity.Y);
        }
        else if (b.Position.X > maxX)
        {
            b.Position = new Vec2(maxX, b.Position.Y);
            if (b.Velocity.X > 0)
                b.Velocity = new Vec2(-b.Velocity.X * PhysicsConstants.CushionRestitution, b.Velocity.Y);
        }

        if (b.Position.Y < minY)
        {
            b.Position = new Vec2(b.Position.X, minY);
            if (b.Velocity.Y < 0)
                b.Velocity = new Vec2(b.Velocity.X, -b.Velocity.Y * PhysicsConstants.CushionRestitution);
        }
        else if (b.Position.Y > maxY)
        {
            b.Position = new Vec2(b.Position.X, maxY);
            if (b.Velocity.Y > 0)
                b.Velocity = new Vec2(b.Velocity.X, -b.Velocity.Y * PhysicsConstants.CushionRestitution);
        }
    }

    /// <summary>Integrates positions and handles cushion reflections for one step.</summary>
    public void Step(List<Ball> balls, double dt)
    {
        foreach (var b in balls)
        {
            if (b.Velocity.Length > 0)
            {
                double remaining = dt;
                while (remaining > PhysicsConstants.Epsilon && b.Velocity.Length > 0)
                {
                    Vec2 min = new Vec2(0, 0);
                    Vec2 max = new Vec2(PhysicsConstants.TableWidth, PhysicsConstants.TableHeight);

                    double tHit = double.PositiveInfinity;
                    Vec2 normal = new Vec2();
                    double restitution = PhysicsConstants.Restitution;
                    bool hit = false;

                    if (Ccd.CircleAabb(b.Position, b.Velocity, PhysicsConstants.BallRadius, min, max, out double tBox, out Vec2 nBox) && tBox <= remaining)
                    {
                        var candidate = b.Position + b.Velocity * tBox;
                        if (!IsBeyondPocketEdges(candidate))
                        {
                            tHit = tBox;
                            normal = nBox;
                            restitution = PhysicsConstants.CushionRestitution;
                            hit = true;
                        }
                    }

                    foreach (var e in PocketEdges)
                    {
                        if (Ccd.CircleSegment(b.Position, b.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double tEdge) && tEdge <= remaining && tEdge < tHit)
                        {
                            tHit = tEdge;
                            normal = e.Normal;
                            restitution = PhysicsConstants.PocketRestitution;
                            hit = true;
                        }
                    }

                    if (hit)
                    {
                        b.Position += b.Velocity * tHit;
                        var speed = b.Velocity.Length;
                        var newSpeed = Math.Max(0, speed - PhysicsConstants.Mu * tHit);
                        b.Velocity = newSpeed > 0 ? b.Velocity.Normalized() * newSpeed : new Vec2(0, 0);
                        b.Velocity = Collision.Reflect(b.Velocity, normal, restitution);
                        remaining -= tHit;
                    }
                    else
                    {
                        b.Position += b.Velocity * remaining;
                        var speed = b.Velocity.Length;
                        var newSpeed = Math.Max(0, speed - PhysicsConstants.Mu * remaining);
                        b.Velocity = newSpeed > 0 ? b.Velocity.Normalized() * newSpeed : new Vec2(0, 0);
                        break;
                    }
                }
            }
            ClampToTable(b);
        }
    }

    /// <summary>Runs CCD to predict cue-ball path until first impact.</summary>
    public Preview PreviewShot(Vec2 cueStart, Vec2 dir, double speed, List<Ball> others)
    {
        var nDir = dir.Normalized();
        Vec2 velocity = nDir * speed;
        double bestT = double.PositiveInfinity;
        Ball hitBall = null;
        Vec2 hitNormal = new Vec2();
        bool ballHit = false;
        bool pocketHit = false;

        foreach (var b in others)
        {
            if (Ccd.CircleCircle(cueStart, velocity, PhysicsConstants.BallRadius, b.Position, PhysicsConstants.BallRadius, out double t))
            {
                if (t < bestT)
                {
                    bestT = t; hitBall = b; ballHit = true;
                }
            }
        }

        Vec2 min = new Vec2(0, 0);
        Vec2 max = new Vec2(PhysicsConstants.TableWidth, PhysicsConstants.TableHeight);
        if (Ccd.CircleAabb(cueStart, velocity, PhysicsConstants.BallRadius, min, max, out double tc, out Vec2 n))
        {
            var candidate = cueStart + velocity * tc;
            if (tc < bestT && !IsBeyondPocketEdges(candidate))
            {
                bestT = tc; hitNormal = n; ballHit = false; pocketHit = false;
            }
        }

        foreach (var e in PocketEdges)
        {
            if (Ccd.CircleSegment(cueStart, velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te))
            {
                if (te < bestT)
                {
                    bestT = te; hitNormal = e.Normal; ballHit = false; pocketHit = true;
                }
            }
        }

        if (double.IsPositiveInfinity(bestT))
        {
            // no collision within preview window
            return new Preview { Path = new List<Vec2> { cueStart, cueStart + velocity }, ContactPoint = cueStart + velocity, CuePostVelocity = velocity };
        }

        Vec2 contact = cueStart + velocity * bestT;
        List<Vec2> path = new List<Vec2> { cueStart, contact };
        Vec2 cuePost;
        Vec2? targetPost = null;

        if (ballHit && hitBall != null)
        {
            Collision.ResolveBallBall(contact - nDir * PhysicsConstants.BallRadius, velocity, hitBall.Position, new Vec2(0, 0), out cuePost, out var target);
            targetPost = target;
            path.Add(contact + cuePost.Normalized() * PhysicsConstants.BallRadius);
        }
        else
        {
            var rest = pocketHit ? PhysicsConstants.PocketRestitution : PhysicsConstants.Restitution;
            cuePost = Collision.Reflect(velocity, hitNormal, rest);
            path.Add(contact + cuePost.Normalized() * PhysicsConstants.BallRadius);
        }

        return new Preview { Path = path, ContactPoint = contact, CuePostVelocity = cuePost, TargetPostVelocity = targetPost };
    }

    /// <summary>Deterministic stepper simulation to validate preview.</summary>
    public Impact SimulateFirstImpact(Vec2 cueStart, Vec2 dir, double speed, List<Ball> others)
    {
        var nDir = dir.Normalized();
        var cue = new Ball { Position = cueStart, Velocity = nDir * speed };
        var balls = new List<Ball>(others) { cue };
        double time = 0;
        while (time < PhysicsConstants.MaxPreviewTime)
        {
            // check collisions using CCD for the next dt
            foreach (var b in others)
            {
                if (Ccd.CircleCircle(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, b.Position, PhysicsConstants.BallRadius, out double t))
                {
                    if (t <= PhysicsConstants.FixedDt)
                    {
                        cue.Position += cue.Velocity * t;
                        Collision.ResolveBallBall(cue.Position, cue.Velocity, b.Position, new Vec2(0, 0), out var cuePost, out var targetPost);
                        return new Impact { Point = cue.Position, CueVelocity = cuePost, TargetVelocity = targetPost };
                    }
                }
            }
            foreach (var e in PocketEdges)
            {
                if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= PhysicsConstants.FixedDt)
                {
                    cue.Position += cue.Velocity * te;
                    var postEdge = Collision.Reflect(cue.Velocity, e.Normal, PhysicsConstants.PocketRestitution);
                    return new Impact { Point = cue.Position, CueVelocity = postEdge };
                }
            }
            if (Ccd.CircleAabb(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, new Vec2(0, 0), new Vec2(PhysicsConstants.TableWidth, PhysicsConstants.TableHeight), out double tc, out Vec2 n) && tc <= PhysicsConstants.FixedDt)
            {
                var candidate = cue.Position + cue.Velocity * tc;
                if (!IsBeyondPocketEdges(candidate))
                {
                    cue.Position += cue.Velocity * tc;
                    var post = Collision.Reflect(cue.Velocity, n);
                    return new Impact { Point = cue.Position, CueVelocity = post };
                }
            }
            Step(balls, PhysicsConstants.FixedDt);
            time += PhysicsConstants.FixedDt;
        }
        return new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
    }
}
