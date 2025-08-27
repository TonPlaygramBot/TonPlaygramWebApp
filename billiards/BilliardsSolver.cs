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

    /// <summary>Integrates positions and handles cushion reflections for one step.</summary>
    public void Step(List<Ball> balls, double dt)
    {
        foreach (var b in balls)
        {
            if (b.Velocity.Length > 0)
            {
                b.Position += b.Velocity * dt;
                // simple friction
                var speed = b.Velocity.Length;
                var newSpeed = Math.Max(0, speed - PhysicsConstants.Mu * dt);
                b.Velocity = b.Velocity.Normalized() * newSpeed;
                // cushion
                Vec2 min = new Vec2(0, 0);
                Vec2 max = new Vec2(PhysicsConstants.TableWidth, PhysicsConstants.TableHeight);
                if (b.Position.X < min.X + PhysicsConstants.BallRadius)
                {
                    b.Position = new Vec2(min.X + PhysicsConstants.BallRadius, b.Position.Y);
                    b.Velocity = Collision.Reflect(b.Velocity, new Vec2(1, 0));
                }
                else if (b.Position.X > max.X - PhysicsConstants.BallRadius)
                {
                    b.Position = new Vec2(max.X - PhysicsConstants.BallRadius, b.Position.Y);
                    b.Velocity = Collision.Reflect(b.Velocity, new Vec2(-1, 0));
                }
                if (b.Position.Y < min.Y + PhysicsConstants.BallRadius)
                {
                    b.Position = new Vec2(b.Position.X, min.Y + PhysicsConstants.BallRadius);
                    b.Velocity = Collision.Reflect(b.Velocity, new Vec2(0, 1));
                }
                else if (b.Position.Y > max.Y - PhysicsConstants.BallRadius)
                {
                    b.Position = new Vec2(b.Position.X, max.Y - PhysicsConstants.BallRadius);
                    b.Velocity = Collision.Reflect(b.Velocity, new Vec2(0, -1));
                }
            }
        }
    }

    /// <summary>Runs CCD to predict cue-ball path until first impact.</summary>
    public Preview PreviewShot(Vec2 cueStart, Vec2 dir, double speed, List<Ball> others)
    {
        Vec2 velocity = dir * speed;
        double bestT = double.PositiveInfinity;
        Ball hitBall = null;
        Vec2 hitNormal = new Vec2();
        bool ballHit = false;

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
            if (tc < bestT)
            {
                bestT = tc; hitNormal = n; ballHit = false;
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
            Collision.ResolveBallBall(contact - dir * PhysicsConstants.BallRadius, velocity, hitBall.Position, new Vec2(0, 0), out cuePost, out var target);
            targetPost = target;
            path.Add(contact + cuePost.Normalized() * PhysicsConstants.BallRadius);
        }
        else
        {
            cuePost = Collision.Reflect(velocity, hitNormal);
            path.Add(contact + cuePost.Normalized() * PhysicsConstants.BallRadius);
        }

        return new Preview { Path = path, ContactPoint = contact, CuePostVelocity = cuePost, TargetPostVelocity = targetPost };
    }

    /// <summary>Deterministic stepper simulation to validate preview.</summary>
    public Impact SimulateFirstImpact(Vec2 cueStart, Vec2 dir, double speed, List<Ball> others)
    {
        var cue = new Ball { Position = cueStart, Velocity = dir * speed };
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
            if (Ccd.CircleAabb(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, new Vec2(0, 0), new Vec2(PhysicsConstants.TableWidth, PhysicsConstants.TableHeight), out double tc, out Vec2 n) && tc <= PhysicsConstants.FixedDt)
            {
                cue.Position += cue.Velocity * tc;
                var post = Collision.Reflect(cue.Velocity, n);
                return new Impact { Point = cue.Position, CueVelocity = post };
            }
            Step(balls, PhysicsConstants.FixedDt);
            time += PhysicsConstants.FixedDt;
        }
        return new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
    }
}
