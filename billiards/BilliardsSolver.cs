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

    public struct Jaw
    {
        public Vec2 A;
        public Vec2 B;
        public Vec2 Normal;
    }

    public List<Jaw> PocketJaws { get; } = new List<Jaw>();

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

    private const double PocketGapThreshold = 0.2;

    private List<(Jaw jaw, bool isJaw)> BuildSegments()
    {
        var segments = new List<(Jaw, bool)>();
        double w = PhysicsConstants.TableWidth;
        double h = PhysicsConstants.TableHeight;

        List<double> left = new List<double> { 0, h };
        List<double> right = new List<double> { 0, h };
        List<double> bottom = new List<double> { 0, w };
        List<double> top = new List<double> { 0, w };

        foreach (var j in PocketJaws)
        {
            if (Math.Abs(j.A.X) < PhysicsConstants.Epsilon) left.Add(j.A.Y);
            if (Math.Abs(j.B.X) < PhysicsConstants.Epsilon) left.Add(j.B.Y);
            if (Math.Abs(j.A.X - w) < PhysicsConstants.Epsilon) right.Add(j.A.Y);
            if (Math.Abs(j.B.X - w) < PhysicsConstants.Epsilon) right.Add(j.B.Y);
            if (Math.Abs(j.A.Y) < PhysicsConstants.Epsilon) bottom.Add(j.A.X);
            if (Math.Abs(j.B.Y) < PhysicsConstants.Epsilon) bottom.Add(j.B.X);
            if (Math.Abs(j.A.Y - h) < PhysicsConstants.Epsilon) top.Add(j.A.X);
            if (Math.Abs(j.B.Y - h) < PhysicsConstants.Epsilon) top.Add(j.B.X);
        }

        left.Sort();
        right.Sort();
        bottom.Sort();
        top.Sort();

        for (int i = 0; i < left.Count - 1; i++)
        {
            double a = left[i];
            double b = left[i + 1];
            if (b - a > PocketGapThreshold)
                segments.Add((new Jaw { A = new Vec2(0, a), B = new Vec2(0, b), Normal = new Vec2(1, 0) }, false));
        }
        for (int i = 0; i < right.Count - 1; i++)
        {
            double a = right[i];
            double b = right[i + 1];
            if (b - a > PocketGapThreshold)
                segments.Add((new Jaw { A = new Vec2(w, a), B = new Vec2(w, b), Normal = new Vec2(-1, 0) }, false));
        }
        for (int i = 0; i < bottom.Count - 1; i++)
        {
            double a = bottom[i];
            double b = bottom[i + 1];
            if (b - a > PocketGapThreshold)
                segments.Add((new Jaw { A = new Vec2(a, 0), B = new Vec2(b, 0), Normal = new Vec2(0, 1) }, false));
        }
        for (int i = 0; i < top.Count - 1; i++)
        {
            double a = top[i];
            double b = top[i + 1];
            if (b - a > PocketGapThreshold)
                segments.Add((new Jaw { A = new Vec2(a, h), B = new Vec2(b, h), Normal = new Vec2(0, -1) }, false));
        }

        foreach (var j in PocketJaws)
            segments.Add((j, true));

        return segments;
    }

    /// <summary>Integrates positions and handles cushion reflections for one step.</summary>
    public void Step(List<Ball> balls, double dt)
    {
        foreach (var b in balls)
        {
            if (b.Velocity.Length > 0)
            {
                double remaining = dt;
                var segments = BuildSegments();
                while (remaining > PhysicsConstants.Epsilon && b.Velocity.Length > 0)
                {
                    double tHit = double.PositiveInfinity;
                    Vec2 normal = new Vec2();
                    bool jaw = false;
                    bool hit = false;

                    foreach (var seg in segments)
                    {
                        if (Ccd.CircleSegment(b.Position, b.Velocity, PhysicsConstants.BallRadius, seg.jaw.A, seg.jaw.B, seg.jaw.Normal, out double tSeg) && tSeg <= remaining && tSeg < tHit)
                        {
                            tHit = tSeg;
                            normal = seg.jaw.Normal;
                            jaw = seg.isJaw;
                            hit = true;
                        }
                    }

                    if (hit)
                    {
                        b.Position += b.Velocity * tHit;
                        var speed = b.Velocity.Length;
                        var newSpeed = Math.Max(0, speed - PhysicsConstants.Mu * tHit);
                        b.Velocity = newSpeed > 0 ? b.Velocity.Normalized() * newSpeed : new Vec2(0, 0);
                        b.Velocity = jaw
                            ? Collision.ReflectWithFriction(b.Velocity, normal, PhysicsConstants.JawRestitution, PhysicsConstants.JawFriction, PhysicsConstants.JawDrag)
                            : Collision.Reflect(b.Velocity, normal, PhysicsConstants.CushionRestitution);
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

        bool jawHit = false;
        var segments = BuildSegments();
        foreach (var seg in segments)
        {
            if (Ccd.CircleSegment(cueStart, velocity, PhysicsConstants.BallRadius, seg.jaw.A, seg.jaw.B, seg.jaw.Normal, out double tSeg))
            {
                if (tSeg < bestT)
                {
                    bestT = tSeg;
                    hitNormal = seg.jaw.Normal;
                    ballHit = false;
                    jawHit = seg.isJaw;
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
            cuePost = jawHit
                ? Collision.ReflectWithFriction(velocity, hitNormal, PhysicsConstants.JawRestitution, PhysicsConstants.JawFriction, PhysicsConstants.JawDrag)
                : Collision.Reflect(velocity, hitNormal, PhysicsConstants.CushionRestitution);
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

            double tHit = double.PositiveInfinity;
            Vec2 normal = new Vec2();
            bool jaw = false;
            var segments = BuildSegments();
            foreach (var seg in segments)
            {
                if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, seg.jaw.A, seg.jaw.B, seg.jaw.Normal, out double tSeg) && tSeg <= PhysicsConstants.FixedDt && tSeg < tHit)
                {
                    tHit = tSeg;
                    normal = seg.jaw.Normal;
                    jaw = seg.isJaw;
                }
            }
            if (tHit < double.PositiveInfinity)
            {
                cue.Position += cue.Velocity * tHit;
                var post = jaw
                    ? Collision.ReflectWithFriction(cue.Velocity, normal, PhysicsConstants.JawRestitution, PhysicsConstants.JawFriction, PhysicsConstants.JawDrag)
                    : Collision.Reflect(cue.Velocity, normal, PhysicsConstants.CushionRestitution);
                return new Impact { Point = cue.Position, CueVelocity = post };
            }
            Step(balls, PhysicsConstants.FixedDt);
            time += PhysicsConstants.FixedDt;
        }
        return new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
    }
}
