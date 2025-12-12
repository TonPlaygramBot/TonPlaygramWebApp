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
        public bool Pocketed;
    }

    public struct Edge
    {
        public Vec2 A;
        public Vec2 B;
        public Vec2 Normal;
    }

    public struct Pocket
    {
        public Vec2 Center;
        public double Radius;
    }

    public List<Edge> CushionEdges { get; } = new List<Edge>();
    public List<Edge> ConnectorEdges { get; } = new List<Edge>();
    public List<Edge> PocketEdges { get; } = new List<Edge>();
    public List<Pocket> Pockets { get; } = new List<Pocket>();

    /// <summary>Generates watertight cushion and pocket proxy geometry using table specs.</summary>
    public void InitStandardTable()
    {
        CushionEdges.Clear();
        ConnectorEdges.Clear();
        PocketEdges.Clear();
        Pockets.Clear();

        double width = PhysicsConstants.TableWidth;
        double height = PhysicsConstants.TableHeight;
        double cornerMouth = PhysicsConstants.CornerPocketMouth;
        double sideMouth = PhysicsConstants.SidePocketMouth;
        double cornerCut = cornerMouth / Math.Sqrt(2.0);
        double sideCut = sideMouth / 2.0;
        double sideDepth = Math.Max(sideCut * 1.05, PhysicsConstants.BallRadius * 1.8);
        double sideOutset = Math.Max(0.0, PhysicsConstants.SidePocketOutset);

        // Straight cushion spans (long rails)
        AddCushionSegment(new Vec2(cornerCut, 0), new Vec2(width / 2 - sideCut, 0), new Vec2(0, 1));
        AddCushionSegment(new Vec2(width / 2 + sideCut, 0), new Vec2(width - cornerCut, 0), new Vec2(0, 1));
        AddCushionSegment(new Vec2(cornerCut, height), new Vec2(width / 2 - sideCut, height), new Vec2(0, -1));
        AddCushionSegment(new Vec2(width / 2 + sideCut, height), new Vec2(width - cornerCut, height), new Vec2(0, -1));

        // Straight cushion spans (short rails)
        AddCushionSegment(new Vec2(0, cornerCut), new Vec2(0, height / 2 - sideCut), new Vec2(1, 0));
        AddCushionSegment(new Vec2(0, height / 2 + sideCut), new Vec2(0, height - cornerCut), new Vec2(1, 0));
        AddCushionSegment(new Vec2(width, cornerCut), new Vec2(width, height / 2 - sideCut), new Vec2(-1, 0));
        AddCushionSegment(new Vec2(width, height / 2 + sideCut), new Vec2(width, height - cornerCut), new Vec2(-1, 0));

        int cornerSegments = Math.Max(8, PhysicsConstants.CornerJawSegments);
        AddCornerJaw(new Vec2(cornerCut, cornerCut), cornerCut, Math.PI, 1.5 * Math.PI, cornerSegments);
        AddCornerJaw(new Vec2(width - cornerCut, cornerCut), cornerCut, 1.5 * Math.PI, 2.0 * Math.PI, cornerSegments);
        AddCornerJaw(new Vec2(width - cornerCut, height - cornerCut), cornerCut, 0, 0.5 * Math.PI, cornerSegments);
        AddCornerJaw(new Vec2(cornerCut, height - cornerCut), cornerCut, 0.5 * Math.PI, Math.PI, cornerSegments);

        int sideSegments = Math.Max(6, PhysicsConstants.SideJawSegments);
        AddSidePocketJaw(new Vec2(width / 2, 0 - sideOutset), sideCut, sideDepth, true, sideSegments);
        AddSidePocketJaw(new Vec2(width / 2, height + sideOutset), sideCut, sideDepth, false, sideSegments);
        AddSidePocketJaw(new Vec2(0 - sideOutset, height / 2), sideCut, sideDepth, true, sideSegments, vertical: true);
        AddSidePocketJaw(new Vec2(width + sideOutset, height / 2), sideCut, sideDepth, false, sideSegments, vertical: true);

        double capture = Math.Max(PhysicsConstants.BallRadius * 1.05, PhysicsConstants.PocketCaptureRadius);
        Pockets.Add(new Pocket { Center = new Vec2(0, 0), Radius = capture });
        Pockets.Add(new Pocket { Center = new Vec2(width / 2, 0 - sideOutset), Radius = capture });
        Pockets.Add(new Pocket { Center = new Vec2(width, 0), Radius = capture });
        Pockets.Add(new Pocket { Center = new Vec2(0 - sideOutset, height / 2), Radius = capture });
        Pockets.Add(new Pocket { Center = new Vec2(width + sideOutset, height / 2), Radius = capture });
        Pockets.Add(new Pocket { Center = new Vec2(0, height), Radius = capture });
        Pockets.Add(new Pocket { Center = new Vec2(width / 2, height + sideOutset), Radius = capture });
        Pockets.Add(new Pocket { Center = new Vec2(width, height), Radius = capture });
    }

    private void AddCushionSegment(Vec2 a, Vec2 b, Vec2 interiorHint)
    {
        if ((b - a).Length < PhysicsConstants.Epsilon)
            return;
        Vec2 dir = (b - a).Normalized();
        Vec2 normal = new Vec2(-dir.Y, dir.X);
        if (Vec2.Dot(normal, interiorHint) < 0)
            normal = -normal;
        CushionEdges.Add(new Edge { A = a, B = b, Normal = normal.Normalized() });
    }

    private void AddCornerJaw(Vec2 center, double radius, double startAngle, double endAngle, int segments)
    {
        if (radius <= PhysicsConstants.Epsilon || segments <= 0)
            return;
        double step = (endAngle - startAngle) / segments;
        Vec2 prev = PointOnCircle(center, radius, startAngle);
        Vec2 prevNormal = (prev - center).Normalized();
        int cushionBands = Math.Clamp(PhysicsConstants.JawCushionSegments, 1, segments);
        for (int i = 1; i <= segments; i++)
        {
            double angle = startAngle + step * i;
            Vec2 next = PointOnCircle(center, radius, angle);
            Vec2 normal = (next - center).Normalized();
            Vec2 blended = (prevNormal + normal).Normalized();
            if (blended.Length < PhysicsConstants.Epsilon)
                blended = normal;
            var edge = new Edge { A = prev, B = next, Normal = blended };
            if (i <= cushionBands || i > segments - cushionBands)
                CushionEdges.Add(edge);
            else
                PocketEdges.Add(edge);
            prev = next;
            prevNormal = normal;
        }
    }

    private void AddSidePocketJaw(Vec2 center, double halfMouth, double depth, bool positive, int segments, bool vertical = false)
    {
        if (halfMouth <= PhysicsConstants.Epsilon || depth <= PhysicsConstants.Epsilon || segments <= 0)
            return;

        List<Vec2> pts = new List<Vec2>();
        for (int i = 0; i <= segments; i++)
        {
            double t = (double)i / segments;
            double angle = Math.PI * (1.0 - t);
            double mouthOffset = halfMouth * Math.Cos(angle);
            double depthOffset = depth * Math.Sin(angle);

            if (vertical)
            {
                double y = center.Y + mouthOffset;
                double x = center.X + (positive ? depthOffset : -depthOffset);
                pts.Add(new Vec2(x, y));
            }
            else
            {
                double x = center.X + mouthOffset;
                double y = center.Y + (positive ? depthOffset : -depthOffset);
                pts.Add(new Vec2(x, y));
            }
        }

        Vec2 hint = vertical ? new Vec2(positive ? 1 : -1, 0) : new Vec2(0, positive ? 1 : -1);
        // Use a thinner band near the mouth so balls aren't deflected before they
        // visually reach the jaw lips. These mouth segments are tagged as connectors
        // to soften the rebound versus a full cushion, which keeps side-pocket
        // approach shots from pinging back unnaturally compared to the corners.
        int cushionBands = Math.Max(1, Math.Min(PhysicsConstants.JawCushionSegments - 1, Math.Max(1, pts.Count - 1)));
        for (int i = 0; i < pts.Count - 1; i++)
        {
            Vec2 a = pts[i];
            Vec2 b = pts[i + 1];
            if ((b - a).Length < PhysicsConstants.Epsilon)
                continue;
            Vec2 dir = (b - a).Normalized();
            Vec2 normal = new Vec2(-dir.Y, dir.X);
            if (Vec2.Dot(normal, hint) < 0)
                normal = -normal;
            // Normalise to keep contact offsets consistent with other pocket/cushion edges.
            if (normal.Length > PhysicsConstants.Epsilon)
                normal = normal.Normalized();
            var edge = new Edge { A = a, B = b, Normal = normal };
            bool nearMouth = i < cushionBands || i >= pts.Count - 1 - cushionBands;
            if (nearMouth)
                ConnectorEdges.Add(edge);
            else
                PocketEdges.Add(edge);
        }
    }

    private static Vec2 PointOnCircle(Vec2 center, double radius, double angle)
    {
        return new Vec2(
            center.X + Math.Cos(angle) * radius,
            center.Y + Math.Sin(angle) * radius);
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
                double remaining = dt;
                int subSteps = 0;
                while (remaining > PhysicsConstants.Epsilon && b.Velocity.Length > 0 && !b.Pocketed)
                {
                    if (++subSteps > PhysicsConstants.MaxSubSteps)
                    {
                        b.Velocity = new Vec2(0, 0);
                        break;
                    }
                    double tHit = double.PositiveInfinity;
                    Vec2 normal = new Vec2();
                    double restitution = PhysicsConstants.Restitution;
                    bool hit = false;
                    bool pocket = false;
                    Vec2 contactPoint = new Vec2();

                    foreach (var e in CushionEdges)
                    {
                        if (Ccd.CircleSegment(b.Position, b.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double tEdge) && tEdge <= remaining && tEdge < tHit)
                        {
                            tHit = tEdge;
                            normal = e.Normal;
                            restitution = PhysicsConstants.CushionRestitution;
                            hit = true;
                            contactPoint = (b.Position + b.Velocity * tEdge) - normal * PhysicsConstants.BallRadius;
                        }
                    }

                    foreach (var e in ConnectorEdges)
                    {
                        if (Ccd.CircleSegment(b.Position, b.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double tEdge) && tEdge <= remaining && tEdge < tHit)
                        {
                            tHit = tEdge;
                            normal = e.Normal;
                            restitution = PhysicsConstants.ConnectorRestitution;
                            hit = true;
                            contactPoint = (b.Position + b.Velocity * tEdge) - normal * PhysicsConstants.BallRadius;
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
                            pocket = true;
                            contactPoint = (b.Position + b.Velocity * tEdge) - normal * PhysicsConstants.BallRadius;
                        }
                    }

                    foreach (var pocketZone in Pockets)
                    {
                        double captureRadius = Math.Max(PhysicsConstants.Epsilon, pocketZone.Radius - PhysicsConstants.BallRadius);
                        if (captureRadius <= PhysicsConstants.Epsilon)
                            continue;
                        if (Ccd.CircleCircle(b.Position, b.Velocity, 0, pocketZone.Center, captureRadius, out double tPocket) && tPocket <= remaining && tPocket < tHit)
                        {
                            tHit = tPocket;
                            Vec2 dir = (b.Position + b.Velocity * tPocket - pocketZone.Center).Normalized();
                            if (dir.Length < PhysicsConstants.Epsilon)
                                dir = new Vec2(0, 1);
                            normal = dir;
                            pocket = true;
                            hit = true;
                            contactPoint = pocketZone.Center + dir * captureRadius;
                        }
                    }

                    if (hit)
                    {
                        double travel = Math.Max(tHit, PhysicsConstants.MinCollisionTime);
                        b.Position += b.Velocity * tHit;
                        var speed = b.Velocity.Length;
                        var newSpeed = Math.Max(0, speed - PhysicsConstants.Mu * travel);
                        b.Velocity = newSpeed > 0 ? b.Velocity.Normalized() * newSpeed : new Vec2(0, 0);
                        if (pocket)
                        {
                            b.Pocketed = true;
                            break;
                        }
                        b.Velocity = Collision.Reflect(b.Velocity, normal, restitution);
                        b.Position = contactPoint + normal * (PhysicsConstants.BallRadius + PhysicsConstants.ContactOffset);
                        remaining = Math.Max(0, remaining - travel);
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
        balls.RemoveAll(ball => ball.Pocketed);
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
        bool connectorHit = false;

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

        foreach (var e in ConnectorEdges)
        {
            if (Ccd.CircleSegment(cueStart, velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te))
            {
                if (te < bestT)
                {
                    bestT = te; hitNormal = e.Normal; ballHit = false; pocketHit = false; connectorHit = true;
                }
            }
        }

        bool cushionHit = false;
        foreach (var e in CushionEdges)
        {
            if (Ccd.CircleSegment(cueStart, velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te))
            {
                if (te < bestT)
                {
                    bestT = te; hitNormal = e.Normal; ballHit = false; pocketHit = false; connectorHit = false; cushionHit = true;
                }
            }
        }

        foreach (var e in PocketEdges)
        {
            if (Ccd.CircleSegment(cueStart, velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te))
            {
                if (te < bestT)
                {
                    bestT = te; hitNormal = e.Normal; ballHit = false; pocketHit = true; connectorHit = false;
                    cushionHit = false;
                }
            }
        }

        foreach (var pocketZone in Pockets)
        {
            double captureRadius = Math.Max(PhysicsConstants.Epsilon, pocketZone.Radius - PhysicsConstants.BallRadius);
            if (captureRadius <= PhysicsConstants.Epsilon)
                continue;
            if (Ccd.CircleCircle(cueStart, velocity, 0, pocketZone.Center, captureRadius, out double tPocket))
            {
                if (tPocket < bestT)
                {
                    bestT = tPocket;
                    hitNormal = (cueStart + velocity * tPocket - pocketZone.Center).Normalized();
                    if (hitNormal.Length < PhysicsConstants.Epsilon)
                        hitNormal = new Vec2(0, 1);
                    ballHit = false;
                    pocketHit = true;
                    connectorHit = false;
                    cushionHit = false;
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
            if (pocketHit)
            {
                cuePost = new Vec2(0, 0);
            }
            else if (cushionHit)
            {
                cuePost = Collision.Reflect(velocity, hitNormal, PhysicsConstants.CushionRestitution);
                if (cuePost.Length > PhysicsConstants.Epsilon)
                {
                    path.Add(contact + cuePost.Normalized() * PhysicsConstants.BallRadius);
                }
            }
            else if (connectorHit)
            {
                cuePost = Collision.Reflect(velocity, hitNormal, PhysicsConstants.ConnectorRestitution);
                path.Add(contact + cuePost.Normalized() * PhysicsConstants.BallRadius);
            }
            else
            {
                cuePost = Collision.Reflect(velocity, hitNormal, PhysicsConstants.Restitution);
                path.Add(contact + cuePost.Normalized() * PhysicsConstants.BallRadius);
            }
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
            foreach (var e in ConnectorEdges)
            {
                if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= PhysicsConstants.FixedDt)
                {
                    cue.Position += cue.Velocity * te;
                    var post = Collision.Reflect(cue.Velocity, e.Normal, PhysicsConstants.ConnectorRestitution);
                    return new Impact { Point = cue.Position, CueVelocity = post };
                }
            }

            foreach (var e in CushionEdges)
            {
                if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= PhysicsConstants.FixedDt)
                {
                    cue.Position += cue.Velocity * te;
                    var post = Collision.Reflect(cue.Velocity, e.Normal, PhysicsConstants.CushionRestitution);
                    return new Impact { Point = cue.Position, CueVelocity = post };
                }
            }

            foreach (var e in PocketEdges)
            {
                if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= PhysicsConstants.FixedDt)
                {
                    cue.Position += cue.Velocity * te;
                    return new Impact { Point = cue.Position, CueVelocity = new Vec2(0, 0) };
                }
            }

            foreach (var pocketZone in Pockets)
            {
                double captureRadius = Math.Max(PhysicsConstants.Epsilon, pocketZone.Radius - PhysicsConstants.BallRadius);
                if (captureRadius <= PhysicsConstants.Epsilon)
                    continue;
                if (Ccd.CircleCircle(cue.Position, cue.Velocity, 0, pocketZone.Center, captureRadius, out double tPocket) && tPocket <= PhysicsConstants.FixedDt)
                {
                    cue.Position += cue.Velocity * tPocket;
                    return new Impact { Point = cue.Position, CueVelocity = new Vec2(0, 0) };
                }
            }
            Step(balls, PhysicsConstants.FixedDt);
            time += PhysicsConstants.FixedDt;
        }
        return new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
    }
}
