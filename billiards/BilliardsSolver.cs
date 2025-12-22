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
        double cornerCutAngle = DegreesToRadians(PhysicsConstants.CornerCutAngleDeg);
        double sideCutAngle = DegreesToRadians(PhysicsConstants.SideCutAngleDeg);

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

        int cornerSegments = Math.Max(2, PhysicsConstants.CornerJawSegments);
        AddCornerJaw(
            new Vec2(cornerCut, 0),
            new Vec2(0, cornerCut),
            new Vec2(1, 0),
            new Vec2(0, 1),
            new Vec2(-1, -1),
            cornerCutAngle,
            cornerSegments);
        AddCornerJaw(
            new Vec2(width, cornerCut),
            new Vec2(width - cornerCut, 0),
            new Vec2(0, 1),
            new Vec2(-1, 0),
            new Vec2(1, -1),
            cornerCutAngle,
            cornerSegments);
        AddCornerJaw(
            new Vec2(width - cornerCut, height),
            new Vec2(width, height - cornerCut),
            new Vec2(-1, 0),
            new Vec2(0, -1),
            new Vec2(1, 1),
            cornerCutAngle,
            cornerSegments);
        AddCornerJaw(
            new Vec2(0, height - cornerCut),
            new Vec2(cornerCut, height),
            new Vec2(0, -1),
            new Vec2(1, 0),
            new Vec2(-1, 1),
            cornerCutAngle,
            cornerSegments);

        int sideSegments = Math.Max(6, PhysicsConstants.SideJawSegments);
        AddSidePocketJaw(new Vec2(width / 2, 0 - sideOutset), sideCut, sideDepth, true, sideSegments, sideCutAngle);
        AddSidePocketJaw(new Vec2(width / 2, height + sideOutset), sideCut, sideDepth, false, sideSegments, sideCutAngle);
        AddSidePocketJaw(new Vec2(0 - sideOutset, height / 2), sideCut, sideDepth, true, sideSegments, sideCutAngle, true);
        AddSidePocketJaw(new Vec2(width + sideOutset, height / 2), sideCut, sideDepth, false, sideSegments, sideCutAngle, true);

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

    private void AddCornerJaw(
        Vec2 mouthA,
        Vec2 mouthB,
        Vec2 railDirA,
        Vec2 railDirB,
        Vec2 outwardHint,
        double cutAngle,
        int segments)
    {
        if (segments <= 0)
            return;
        Vec2 towardPocket = outwardHint.Normalized();
        Vec2 dirA = RotateToward(railDirA, towardPocket, cutAngle);
        Vec2 dirB = RotateToward(railDirB, towardPocket, cutAngle);
        if (!RayIntersection(mouthA, dirA, mouthB, dirB, out Vec2 throat))
            throat = (mouthA + mouthB) * 0.5 + towardPocket * mouthA.Length;

        List<Vec2> pts = new List<Vec2> { mouthA };
        for (int i = 1; i < segments; i++)
        {
            double t = (double)i / segments;
            Vec2 alongA = mouthA + dirA * (throat - mouthA).Length * t;
            Vec2 alongB = mouthB + dirB * (throat - mouthB).Length * t;
            pts.Add(Lerp(alongA, alongB, t));
        }
        pts.Add(mouthB);

        Vec2 interiorHint = -towardPocket;
        int cushionBands = Math.Clamp(PhysicsConstants.JawCushionSegments, 1, Math.Max(1, pts.Count - 1));
        AddSegmentStrip(pts, interiorHint, cushionBands);
    }

    private void AddSidePocketJaw(Vec2 center, double halfMouth, double depth, bool positive, int segments, double cutAngle, bool vertical = false)
    {
        if (halfMouth <= PhysicsConstants.Epsilon || depth <= PhysicsConstants.Epsilon || segments <= 0)
            return;

        Vec2 outward = vertical
            ? new Vec2(positive ? -1 : 1, 0)
            : new Vec2(0, positive ? -1 : 1);
        Vec2 railDirLeft = vertical ? new Vec2(0, 1) : new Vec2(1, 0);
        Vec2 railDirRight = -railDirLeft;

        Vec2 mouthA = vertical
            ? new Vec2(center.X, center.Y - halfMouth)
            : new Vec2(center.X - halfMouth, center.Y);
        Vec2 mouthB = vertical
            ? new Vec2(center.X, center.Y + halfMouth)
            : new Vec2(center.X + halfMouth, center.Y);

        Vec2 dirA = RotateToward(railDirLeft, outward, cutAngle);
        Vec2 dirB = RotateToward(railDirRight, outward, cutAngle);

        if (!RayIntersection(mouthA, dirA, mouthB, dirB, out Vec2 throat))
            throat = center + outward * depth;

        List<Vec2> pts = new List<Vec2> { mouthA };
        for (int i = 1; i < segments; i++)
        {
            double t = (double)i / segments;
            Vec2 alongA = mouthA + dirA * depth * t;
            Vec2 alongB = mouthB + dirB * depth * t;
            pts.Add(Lerp(alongA, alongB, t));
        }
        pts.Add(mouthB);

        Vec2 interiorHint = -outward;
        int cushionBands = Math.Max(1, Math.Min(PhysicsConstants.JawCushionSegments, Math.Max(1, pts.Count - 1)));
        AddSegmentStrip(pts, interiorHint, cushionBands);
    }

    private static Vec2 PointOnCircle(Vec2 center, double radius, double angle)
    {
        return new Vec2(
            center.X + Math.Cos(angle) * radius,
            center.Y + Math.Sin(angle) * radius);
    }

    private static Vec2 RotateToward(Vec2 from, Vec2 toward, double radians)
    {
        Vec2 f = from.Normalized();
        Vec2 t = toward.Normalized();
        double angleBetween = Math.Acos(Math.Clamp(Vec2.Dot(f, t), -1.0, 1.0));
        if (angleBetween < PhysicsConstants.Epsilon)
            return f;
        double clamped = Math.Min(radians, angleBetween);
        double sign = Math.Sign(f.X * t.Y - f.Y * t.X);
        return Rotate(f, clamped * (sign == 0 ? 1 : sign));
    }

    private static Vec2 Rotate(Vec2 v, double radians)
    {
        double c = Math.Cos(radians);
        double s = Math.Sin(radians);
        return new Vec2(v.X * c - v.Y * s, v.X * s + v.Y * c);
    }

    private static bool RayIntersection(Vec2 p1, Vec2 d1, Vec2 p2, Vec2 d2, out Vec2 intersection)
    {
        double det = d1.X * d2.Y - d1.Y * d2.X;
        if (Math.Abs(det) < PhysicsConstants.Epsilon)
        {
            intersection = new Vec2();
            return false;
        }
        Vec2 diff = p2 - p1;
        double t = (diff.X * d2.Y - diff.Y * d2.X) / det;
        intersection = p1 + d1 * t;
        return true;
    }

    private static Vec2 Lerp(Vec2 a, Vec2 b, double t) => a + (b - a) * t;

    private void AddSegmentStrip(List<Vec2> pts, Vec2 interiorHint, int cushionBands)
    {
        for (int i = 0; i < pts.Count - 1; i++)
        {
            Vec2 a = pts[i];
            Vec2 b = pts[i + 1];
            if ((b - a).Length < PhysicsConstants.Epsilon)
                continue;
            Vec2 dir = (b - a).Normalized();
            Vec2 normal = new Vec2(-dir.Y, dir.X);
            if (Vec2.Dot(normal, interiorHint) < 0)
                normal = -normal;
            if (normal.Length > PhysicsConstants.Epsilon)
                normal = normal.Normalized();
            var edge = new Edge { A = a, B = b, Normal = normal };
            bool nearMouth = i < cushionBands || i >= pts.Count - 1 - cushionBands;
            if (nearMouth)
                CushionEdges.Add(edge);
            else
                PocketEdges.Add(edge);
        }
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180.0;

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
