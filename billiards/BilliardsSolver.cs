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
        public double SideSpin;
        public double ForwardSpin;
        public double Height;
        public double VerticalVelocity;
        public double MasseFactor = 1.0;
    }

    public struct ShotSpin
    {
        public double Side;
        public double Top;
        public double Back;

        public static ShotSpin None => new ShotSpin { Side = 0, Top = 0, Back = 0 };
    }

    public struct ShotParams
    {
        public Vec2 Direction;
        public double Speed;
        public ShotSpin Spin;
        public double CueElevationDeg;
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
        double cornerJawRadius = cornerCut * PhysicsConstants.CornerJawRadiusScale;
        double cornerJawInset = PhysicsConstants.CornerJawInset;
        double cornerJawCenter = cornerCut + cornerJawInset;
        double sideJawInset = PhysicsConstants.SideJawInset;
        double sideDepth = Math.Max(sideCut * 1.05, PhysicsConstants.BallRadius * 1.8) * PhysicsConstants.SideJawDepthScale;
        double sideOutset = Math.Max(0.0, PhysicsConstants.SidePocketOutset);
        double mouthGuardInset = Math.Max(0.0, PhysicsConstants.PocketMouthGuardInset);

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
        AddCornerJaw(new Vec2(cornerJawCenter, cornerJawCenter), cornerJawRadius, Math.PI, 1.5 * Math.PI, cornerSegments);
        AddCornerJaw(new Vec2(width - cornerJawCenter, cornerJawCenter), cornerJawRadius, 1.5 * Math.PI, 2.0 * Math.PI, cornerSegments);
        AddCornerJaw(new Vec2(width - cornerJawCenter, height - cornerJawCenter), cornerJawRadius, 0, 0.5 * Math.PI, cornerSegments);
        AddCornerJaw(new Vec2(cornerJawCenter, height - cornerJawCenter), cornerJawRadius, 0.5 * Math.PI, Math.PI, cornerSegments);

        AddConnectorSegment(
            new Vec2(cornerCut, 0),
            new Vec2(cornerJawCenter, cornerJawCenter - cornerJawRadius),
            new Vec2(0, 1));
        AddConnectorSegment(
            new Vec2(0, cornerCut),
            new Vec2(cornerJawCenter - cornerJawRadius, cornerJawCenter),
            new Vec2(1, 0));
        AddConnectorSegment(
            new Vec2(width - cornerCut, 0),
            new Vec2(width - cornerJawCenter, cornerJawCenter - cornerJawRadius),
            new Vec2(0, 1));
        AddConnectorSegment(
            new Vec2(width, cornerCut),
            new Vec2(width - cornerJawCenter + cornerJawRadius, cornerJawCenter),
            new Vec2(-1, 0));
        AddConnectorSegment(
            new Vec2(width - cornerCut, height),
            new Vec2(width - cornerJawCenter, height - cornerJawCenter + cornerJawRadius),
            new Vec2(0, -1));
        AddConnectorSegment(
            new Vec2(width, height - cornerCut),
            new Vec2(width - cornerJawCenter + cornerJawRadius, height - cornerJawCenter),
            new Vec2(-1, 0));
        AddConnectorSegment(
            new Vec2(cornerCut, height),
            new Vec2(cornerJawCenter, height - cornerJawCenter + cornerJawRadius),
            new Vec2(0, -1));
        AddConnectorSegment(
            new Vec2(0, height - cornerCut),
            new Vec2(cornerJawCenter - cornerJawRadius, height - cornerJawCenter),
            new Vec2(1, 0));

        int sideSegments = Math.Max(6, PhysicsConstants.SideJawSegments);
        AddSidePocketJaw(new Vec2(width / 2, sideJawInset), sideCut, sideDepth, true, sideSegments);
        AddSidePocketJaw(new Vec2(width / 2, height - sideJawInset), sideCut, sideDepth, false, sideSegments);
        AddSidePocketJaw(new Vec2(sideJawInset, height / 2), sideCut, sideDepth, true, sideSegments, vertical: true);
        AddSidePocketJaw(new Vec2(width - sideJawInset, height / 2), sideCut, sideDepth, false, sideSegments, vertical: true);

        AddConnectorSegment(
            new Vec2(width / 2 - sideCut, 0),
            new Vec2(width / 2 - sideCut, sideJawInset),
            new Vec2(0, 1));
        AddConnectorSegment(
            new Vec2(width / 2 + sideCut, 0),
            new Vec2(width / 2 + sideCut, sideJawInset),
            new Vec2(0, 1));
        AddConnectorSegment(
            new Vec2(width / 2 - sideCut, height),
            new Vec2(width / 2 - sideCut, height - sideJawInset),
            new Vec2(0, -1));
        AddConnectorSegment(
            new Vec2(width / 2 + sideCut, height),
            new Vec2(width / 2 + sideCut, height - sideJawInset),
            new Vec2(0, -1));
        AddConnectorSegment(
            new Vec2(0, height / 2 - sideCut),
            new Vec2(sideJawInset, height / 2 - sideCut),
            new Vec2(1, 0));
        AddConnectorSegment(
            new Vec2(0, height / 2 + sideCut),
            new Vec2(sideJawInset, height / 2 + sideCut),
            new Vec2(1, 0));
        AddConnectorSegment(
            new Vec2(width, height / 2 - sideCut),
            new Vec2(width - sideJawInset, height / 2 - sideCut),
            new Vec2(-1, 0));
        AddConnectorSegment(
            new Vec2(width, height / 2 + sideCut),
            new Vec2(width - sideJawInset, height / 2 + sideCut),
            new Vec2(-1, 0));

        AddPocketMouthGuard(
            new Vec2(cornerCut, 0),
            new Vec2(0, cornerCut),
            new Vec2(1, 1),
            mouthGuardInset);
        AddPocketMouthGuard(
            new Vec2(width - cornerCut, 0),
            new Vec2(width, cornerCut),
            new Vec2(-1, 1),
            mouthGuardInset);
        AddPocketMouthGuard(
            new Vec2(width, height - cornerCut),
            new Vec2(width - cornerCut, height),
            new Vec2(-1, -1),
            mouthGuardInset);
        AddPocketMouthGuard(
            new Vec2(0, height - cornerCut),
            new Vec2(cornerCut, height),
            new Vec2(1, -1),
            mouthGuardInset);

        AddPocketMouthGuard(
            new Vec2(width / 2 - sideCut, 0),
            new Vec2(width / 2 + sideCut, 0),
            new Vec2(0, 1),
            mouthGuardInset);
        AddPocketMouthGuard(
            new Vec2(width / 2 - sideCut, height),
            new Vec2(width / 2 + sideCut, height),
            new Vec2(0, -1),
            mouthGuardInset);
        AddPocketMouthGuard(
            new Vec2(0, height / 2 - sideCut),
            new Vec2(0, height / 2 + sideCut),
            new Vec2(1, 0),
            mouthGuardInset);
        AddPocketMouthGuard(
            new Vec2(width, height / 2 - sideCut),
            new Vec2(width, height / 2 + sideCut),
            new Vec2(-1, 0),
            mouthGuardInset);

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
                ConnectorEdges.Add(edge);
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
        // Match the cushion treatment of corner pockets so balls contact the jaws only
        // once they visually reach the lip.
        int cushionBands = Math.Max(1, Math.Min(PhysicsConstants.JawCushionSegments, Math.Max(1, pts.Count - 1)));
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

    private void AddConnectorSegment(Vec2 a, Vec2 b, Vec2 interiorHint)
    {
        if ((b - a).Length < PhysicsConstants.Epsilon)
            return;
        Vec2 dir = (b - a).Normalized();
        Vec2 normal = new Vec2(-dir.Y, dir.X);
        if (Vec2.Dot(normal, interiorHint) < 0)
            normal = -normal;
        ConnectorEdges.Add(new Edge { A = a, B = b, Normal = normal.Normalized() });
    }

    private void AddPocketMouthGuard(Vec2 a, Vec2 b, Vec2 interiorHint, double inset)
    {
        if ((b - a).Length < PhysicsConstants.Epsilon)
            return;
        Vec2 dir = (b - a).Normalized();
        Vec2 normal = new Vec2(-dir.Y, dir.X);
        if (Vec2.Dot(normal, interiorHint) < 0)
            normal = -normal;
        if (normal.Length > PhysicsConstants.Epsilon)
            normal = normal.Normalized();
        if (inset > PhysicsConstants.Epsilon)
        {
            Vec2 offset = -normal * inset;
            a += offset;
            b += offset;
        }
        PocketEdges.Add(new Edge { A = a, B = b, Normal = normal });
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
                    bool airborne = b.Height > PhysicsConstants.AirborneHeightThreshold;
                    ApplySpinForces(b, remaining, airborne);
                    double tHit = double.PositiveInfinity;
                    Vec2 normal = new Vec2();
                    double restitution = PhysicsConstants.Restitution;
                    bool hit = false;
                    bool pocket = false;
                    bool pocketJawHit = false;
                    Vec2 contactPoint = new Vec2();

                    bool allowPocketing = !airborne;
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
                            restitution = allowPocketing ? PhysicsConstants.PocketRestitution : PhysicsConstants.CushionRestitution;
                            hit = true;
                            pocket = allowPocketing;
                            pocketJawHit = true;
                            contactPoint = (b.Position + b.Velocity * tEdge) - normal * PhysicsConstants.BallRadius;
                        }
                    }

                    if (allowPocketing)
                    {
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
                    }

                    if (hit)
                    {
                        double travel = Math.Max(tHit, PhysicsConstants.MinCollisionTime);
                        b.Position += b.Velocity * tHit;
                        var speed = b.Velocity.Length;
                        var newSpeed = Math.Max(0, speed - LinearDrag(airborne) * travel);
                        b.Velocity = newSpeed > 0 ? b.Velocity.Normalized() * newSpeed : new Vec2(0, 0);
                        if (pocket)
                        {
                            b.Pocketed = true;
                            break;
                        }
                        b.Velocity = Collision.Reflect(b.Velocity, normal, restitution);
                        if (pocketJawHit)
                        {
                            b.Velocity = ApplyPocketJawFriction(b.Velocity, normal);
                            b.SideSpin *= PhysicsConstants.PocketJawSpinDamping;
                            b.ForwardSpin *= PhysicsConstants.PocketJawSpinDamping;
                        }
                        b.Position = contactPoint + normal * (PhysicsConstants.BallRadius + PhysicsConstants.ContactOffset);
                        remaining = Math.Max(0, remaining - travel);
                        StepVertical(b, travel);
                    }
                    else
                    {
                        b.Position += b.Velocity * remaining;
                        var speed = b.Velocity.Length;
                        var newSpeed = Math.Max(0, speed - LinearDrag(airborne) * remaining);
                        b.Velocity = newSpeed > 0 ? b.Velocity.Normalized() * newSpeed : new Vec2(0, 0);
                        StepVertical(b, remaining);
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
        return PreviewShot(new ShotParams
        {
            Direction = dir,
            Speed = speed,
            Spin = ShotSpin.None,
            CueElevationDeg = 0
        }, cueStart, others);
    }

    /// <summary>Deterministic stepper simulation to validate preview.</summary>
    public Impact SimulateFirstImpact(Vec2 cueStart, Vec2 dir, double speed, List<Ball> others)
    {
        return SimulateFirstImpact(new ShotParams
        {
            Direction = dir,
            Speed = speed,
            Spin = ShotSpin.None,
            CueElevationDeg = 0
        }, cueStart, others);
    }

    public Preview PreviewShot(ShotParams shot, Vec2 cueStart, List<Ball> others)
    {
        var cue = CreateCueBall(cueStart, shot);
        var path = new List<Vec2> { cue.Position };
        Vec2? contact = null;
        Vec2 cuePost = new Vec2();
        Vec2? targetPost = null;
        double time = 0;
        Vec2 lastSample = cue.Position;

        while (time < PhysicsConstants.MaxPreviewTime)
        {
            bool airborne = cue.Height > PhysicsConstants.AirborneHeightThreshold;
            ApplySpinForces(cue, PhysicsConstants.FixedDt, airborne);
            if (TryFindImpact(cue, others, PhysicsConstants.FixedDt, airborne, out var impact))
            {
                contact = impact.Point;
                cuePost = impact.CueVelocity;
                targetPost = impact.TargetVelocity;
                AppendPathPoint(path, impact.Point, ref lastSample, true);
                break;
            }

            IntegrateCueBall(cue, PhysicsConstants.FixedDt, airborne);
            AppendPathPoint(path, cue.Position, ref lastSample, false);
            time += PhysicsConstants.FixedDt;
        }

        return new Preview
        {
            Path = path,
            ContactPoint = contact ?? cue.Position,
            CuePostVelocity = cuePost,
            TargetPostVelocity = targetPost
        };
    }

    public Impact SimulateFirstImpact(ShotParams shot, Vec2 cueStart, List<Ball> others)
    {
        var cue = CreateCueBall(cueStart, shot);
        double time = 0;
        while (time < PhysicsConstants.MaxPreviewTime)
        {
            bool airborne = cue.Height > PhysicsConstants.AirborneHeightThreshold;
            ApplySpinForces(cue, PhysicsConstants.FixedDt, airborne);
            if (TryFindImpact(cue, others, PhysicsConstants.FixedDt, airborne, out var impact))
            {
                return impact;
            }

            IntegrateCueBall(cue, PhysicsConstants.FixedDt, airborne);
            time += PhysicsConstants.FixedDt;
        }

        return new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
    }

    private static Ball CreateCueBall(Vec2 cueStart, ShotParams shot)
    {
        var clamped = ClampSpin(shot.Spin);
        var forwardSpin = clamped.Top - clamped.Back;
        double cueElevation = Math.Clamp(shot.CueElevationDeg, 0, PhysicsConstants.MaxCueElevationDegrees);
        double elevationRad = cueElevation * Math.PI / 180.0;
        var dir = shot.Direction.Normalized();
        var planarSpeed = shot.Speed * Math.Cos(elevationRad);
        var verticalSpeed = shot.Speed * Math.Sin(elevationRad);
        double spinMagnitude = Math.Sqrt(clamped.Side * clamped.Side + forwardSpin * forwardSpin);
        double normalizedSpin = Math.Min(1.0, spinMagnitude / PhysicsConstants.MaxTipOffsetRatio);
        double jumpThreshold = Math.Max(0.0, PhysicsConstants.JumpVelocityThreshold - PhysicsConstants.JumpTipOffsetBoost * normalizedSpin);
        if (verticalSpeed < jumpThreshold)
            verticalSpeed = 0;
        double masseBlend = Smoothstep(PhysicsConstants.MasseAngleMin, PhysicsConstants.MasseAngleMax, cueElevation);
        double masseFactor = 1.0 + (PhysicsConstants.MasseSwerveBoost - 1.0) * masseBlend;
        return new Ball
        {
            Position = cueStart,
            Velocity = dir * planarSpeed,
            Height = 0,
            VerticalVelocity = verticalSpeed,
            SideSpin = clamped.Side,
            ForwardSpin = forwardSpin,
            MasseFactor = masseFactor
        };
    }

    private static ShotSpin ClampSpin(ShotSpin spin)
    {
        double side = Math.Clamp(spin.Side, -PhysicsConstants.MaxTipOffsetRatio, PhysicsConstants.MaxTipOffsetRatio);
        double top = Math.Clamp(spin.Top, 0, PhysicsConstants.MaxTipOffsetRatio);
        double back = Math.Clamp(spin.Back, 0, PhysicsConstants.MaxTipOffsetRatio);
        double magnitude = Math.Max(Math.Abs(side), Math.Abs(top - back));
        if (magnitude > PhysicsConstants.MaxTipOffsetRatio && magnitude > PhysicsConstants.Epsilon)
        {
            double scale = PhysicsConstants.MaxTipOffsetRatio / magnitude;
            side *= scale;
            top *= scale;
            back *= scale;
        }
        return new ShotSpin { Side = side, Top = top, Back = back };
    }

    private static void ApplySpinForces(Ball b, double dt, bool airborne)
    {
        var speed = b.Velocity.Length;
        if (speed < PhysicsConstants.Epsilon)
            return;

        if (!airborne)
        {
            Vec2 dir = b.Velocity.Normalized();
            if (b.ForwardSpin > 0)
            {
                var forwardAccel = PhysicsConstants.RollAcceleration * b.ForwardSpin;
                b.Velocity += dir * forwardAccel * dt;
            }

            var lateral = new Vec2(-dir.Y, dir.X);
            double speedFactor = 1.0;
            if (speed > PhysicsConstants.SwerveSpeedCutoff)
            {
                double excess = speed - PhysicsConstants.SwerveSpeedCutoff;
                speedFactor = Math.Max(0.0, 1.0 - excess / PhysicsConstants.SwerveSpeedFadeRange);
            }
            var swerveAccel = PhysicsConstants.SwerveCoefficient * b.SideSpin * speed * b.MasseFactor * speedFactor;
            b.Velocity += lateral * swerveAccel * dt;

            double decay = Math.Exp(-PhysicsConstants.SpinDecay * dt);
            b.SideSpin *= decay;
            b.ForwardSpin *= decay;
        }
        else
        {
            double decay = Math.Exp(-PhysicsConstants.AirSpinDecay * dt);
            b.SideSpin *= decay;
            b.ForwardSpin *= decay;
        }
    }

    private static Vec2 ApplyPocketJawFriction(Vec2 velocity, Vec2 normal)
    {
        if (velocity.Length <= PhysicsConstants.Epsilon)
            return velocity;
        var n = normal.Normalized();
        var normalComponent = n * Vec2.Dot(velocity, n);
        var tangential = velocity - normalComponent;
        return normalComponent + tangential * PhysicsConstants.PocketJawTangentDamping;
    }

    private static void IntegrateCueBall(Ball b, double dt, bool airborne)
    {
        b.Position += b.Velocity * dt;
        var speed = b.Velocity.Length;
        var newSpeed = Math.Max(0, speed - LinearDrag(airborne) * dt);
        b.Velocity = newSpeed > 0 ? b.Velocity.Normalized() * newSpeed : new Vec2(0, 0);
        StepVertical(b, dt);
    }

    private static void StepVertical(Ball b, double dt)
    {
        if (Math.Abs(b.VerticalVelocity) < PhysicsConstants.Epsilon && b.Height <= 0)
            return;

        bool wasAbove = b.Height > 0;
        b.VerticalVelocity -= PhysicsConstants.Gravity * dt;
        b.Height += b.VerticalVelocity * dt;
        if (b.Height <= 0)
        {
            b.Height = 0;
            if (Math.Abs(b.VerticalVelocity) > PhysicsConstants.JumpStopVelocity)
            {
                b.VerticalVelocity = -b.VerticalVelocity * PhysicsConstants.JumpRestitution;
            }
            else
            {
                b.VerticalVelocity = 0;
            }
            if (wasAbove)
            {
                b.Velocity *= PhysicsConstants.LandingHorizontalDamping;
                b.SideSpin *= PhysicsConstants.LandingSpinDamping;
                b.ForwardSpin *= PhysicsConstants.LandingSpinDamping;
            }
        }
    }

    private static double LinearDrag(bool airborne)
    {
        return airborne ? PhysicsConstants.AirDrag : PhysicsConstants.Mu;
    }

    private bool TryFindImpact(Ball cue, List<Ball> others, double dt, bool airborne, out Impact impact)
    {
        // check collisions using CCD for the next dt
        if (!airborne)
        {
            foreach (var b in others)
            {
                if (Ccd.CircleCircle(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, b.Position, PhysicsConstants.BallRadius, out double t))
                {
                    if (t <= dt)
                    {
                        cue.Position += cue.Velocity * t;
                        Collision.ResolveBallBall(cue.Position, cue.Velocity, b.Position, new Vec2(0, 0), out var cuePost, out var targetPost);
                        impact = new Impact { Point = cue.Position, CueVelocity = cuePost, TargetVelocity = targetPost };
                        return true;
                    }
                }
            }
        }
        foreach (var e in ConnectorEdges)
        {
            if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= dt)
            {
                cue.Position += cue.Velocity * te;
                var post = Collision.Reflect(cue.Velocity, e.Normal, PhysicsConstants.ConnectorRestitution);
                impact = new Impact { Point = cue.Position, CueVelocity = post };
                return true;
            }
        }

        foreach (var e in CushionEdges)
        {
            if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= dt)
            {
                cue.Position += cue.Velocity * te;
                var post = Collision.Reflect(cue.Velocity, e.Normal, PhysicsConstants.CushionRestitution);
                impact = new Impact { Point = cue.Position, CueVelocity = post };
                return true;
            }
        }

        foreach (var e in PocketEdges)
        {
            if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= dt)
            {
                cue.Position += cue.Velocity * te;
                var restitution = airborne ? PhysicsConstants.CushionRestitution : PhysicsConstants.PocketRestitution;
                var post = Collision.Reflect(cue.Velocity, e.Normal, restitution);
                if (!airborne)
                {
                    post = ApplyPocketJawFriction(post, e.Normal);
                }
                impact = new Impact { Point = cue.Position, CueVelocity = post };
                return true;
            }
        }

        if (!airborne)
        {
            foreach (var pocketZone in Pockets)
            {
                double captureRadius = Math.Max(PhysicsConstants.Epsilon, pocketZone.Radius - PhysicsConstants.BallRadius);
                if (captureRadius <= PhysicsConstants.Epsilon)
                    continue;
                if (Ccd.CircleCircle(cue.Position, cue.Velocity, 0, pocketZone.Center, captureRadius, out double tPocket) && tPocket <= dt)
                {
                    cue.Position += cue.Velocity * tPocket;
                    impact = new Impact { Point = cue.Position, CueVelocity = new Vec2(0, 0) };
                    return true;
                }
            }
        }

        impact = new Impact();
        return false;
    }

    private static void AppendPathPoint(List<Vec2> path, Vec2 point, ref Vec2 lastSample, bool force)
    {
        if (force || (point - lastSample).Length >= PhysicsConstants.PreviewPointSpacing)
        {
            path.Add(point);
            lastSample = point;
        }
    }

    private static double Smoothstep(double edge0, double edge1, double x)
    {
        if (edge1 <= edge0)
            return x >= edge1 ? 1.0 : 0.0;
        double t = Math.Clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
        return t * t * (3.0 - 2.0 * t);
    }
}
