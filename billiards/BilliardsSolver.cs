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
        public Vec3 AngularVelocity;
        public double Height;
        public double VerticalVelocity;
    }

    public struct ShotSpin
    {
        public double OffsetX;
        public double OffsetY;

        public static ShotSpin None => new ShotSpin { OffsetX = 0, OffsetY = 0 };
    }

    public struct ShotParams
    {
        public Vec2 Direction;
        public double Power;
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
                CushionEdges.Add(edge);
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
                    bool airborne = b.Height > PhysicsConstants.AirborneHeightThreshold;
                    double tHit = double.PositiveInfinity;
                    Vec2 normal = new Vec2();
                    double restitution = PhysicsConstants.Restitution;
                    bool hit = false;
                    bool pocket = false;
                    Vec2 contactPoint = new Vec2();

                    if (!airborne)
                    {
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
                    }

                    double travel = hit ? Math.Max(tHit, PhysicsConstants.MinCollisionTime) : remaining;
                    b.Position += b.Velocity * travel;
                    if (airborne)
                    {
                        ApplyAirDrag(b, travel);
                    }
                    else
                    {
                        ApplyTableFriction(b, travel);
                    }
                    StepVertical(b, travel);

                    if (hit)
                    {
                        if (pocket)
                        {
                            b.Pocketed = true;
                            break;
                        }
                        ResolveCushionCollision(b, normal, restitution);
                        b.Position = contactPoint + normal * (PhysicsConstants.BallRadius + PhysicsConstants.ContactOffset);
                        remaining = Math.Max(0, remaining - travel);
                    }
                    else
                    {
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
            Power = speed,
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
            Power = speed,
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
            if (!airborne && TryFindImpact(cue, others, PhysicsConstants.FixedDt, out var impact))
            {
                contact = impact.Point;
                cuePost = impact.CueVelocity;
                targetPost = impact.TargetVelocity;
                AppendPathPoint(path, impact.Point, ref lastSample, true);
                break;
            }

            StepBall(cue, PhysicsConstants.FixedDt, airborne);
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
            if (!airborne && TryFindImpact(cue, others, PhysicsConstants.FixedDt, out var impact))
            {
                return impact;
            }

            StepBall(cue, PhysicsConstants.FixedDt, airborne);
            time += PhysicsConstants.FixedDt;
        }

        return new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
    }

    private static Ball CreateCueBall(Vec2 cueStart, ShotParams shot)
    {
        double cueElevation = Math.Clamp(shot.CueElevationDeg, 0, PhysicsConstants.MaxCueElevationDegrees);
        double elevationRad = cueElevation * Math.PI / 180.0;
        var dir = shot.Direction.Normalized();
        var cueDir = new Vec3(dir.X, 0, dir.Y).Normalized();
        var cueUp = new Vec3(0, 1, 0);
        var cueRight = Vec3.Cross(cueUp, cueDir).Normalized();
        double impulse = MapPowerToImpulse(shot.Power);
        var cueDirElevated = (cueDir * Math.Cos(elevationRad) + cueUp * Math.Sin(elevationRad)).Normalized();
        var linearImpulse = cueDirElevated * impulse;
        var planarVelocity = new Vec2(linearImpulse.X, linearImpulse.Z) / PhysicsConstants.BallMass;
        var verticalVelocity = linearImpulse.Y / PhysicsConstants.BallMass;

        var clampedOffset = ClampOffset(shot.Spin);
        double spinMagnitude = Math.Sqrt(clampedOffset.OffsetX * clampedOffset.OffsetX + clampedOffset.OffsetY * clampedOffset.OffsetY);
        double normalizedSpin = Math.Min(1.0, spinMagnitude / SpinController.MaxOffset);
        double jumpThreshold = Math.Max(0.0, PhysicsConstants.JumpVelocityThreshold - PhysicsConstants.JumpTipOffsetBoost * normalizedSpin);
        if (Math.Abs(verticalVelocity) < jumpThreshold)
            verticalVelocity = 0;
        var rOffset = cueRight * (clampedOffset.OffsetX * PhysicsConstants.BallRadius)
            + cueUp * (clampedOffset.OffsetY * PhysicsConstants.BallRadius);
        var torqueImpulse = Vec3.Cross(rOffset, linearImpulse);
        var inertia = MomentOfInertia();
        var angularVelocity = torqueImpulse / inertia;
        return new Ball
        {
            Position = cueStart,
            Velocity = planarVelocity,
            Height = 0,
            VerticalVelocity = verticalVelocity,
            AngularVelocity = angularVelocity
        };
    }

    private static ShotSpin ClampOffset(ShotSpin spin)
    {
        double x = Math.Clamp(spin.OffsetX, -SpinController.MaxOffset, SpinController.MaxOffset);
        double y = Math.Clamp(spin.OffsetY, -SpinController.MaxOffset, SpinController.MaxOffset);
        double magnitude = Math.Max(Math.Abs(x), Math.Abs(y));
        if (magnitude > SpinController.MaxOffset && magnitude > PhysicsConstants.Epsilon)
        {
            double scale = SpinController.MaxOffset / magnitude;
            x *= scale;
            y *= scale;
        }
        return new ShotSpin { OffsetX = x, OffsetY = y };
    }

    private static double MapPowerToImpulse(double power)
    {
        return power * PhysicsConstants.PowerToImpulseScale;
    }

    private static double MomentOfInertia()
    {
        return 0.4 * PhysicsConstants.BallMass * PhysicsConstants.BallRadius * PhysicsConstants.BallRadius;
    }

    private static Vec3 ToVec3(Vec2 v) => new Vec3(v.X, 0, v.Y);

    private static Vec2 ToVec2(Vec3 v) => new Vec2(v.X, v.Z);

    private static void StepBall(Ball b, double dt, bool airborne)
    {
        b.Position += b.Velocity * dt;
        if (airborne)
        {
            ApplyAirDrag(b, dt);
        }
        else
        {
            ApplyTableFriction(b, dt);
        }
        StepVertical(b, dt);
    }

    private static void ApplyAirDrag(Ball b, double dt)
    {
        var speed = b.Velocity.Length;
        if (speed < PhysicsConstants.Epsilon)
            return;
        var newSpeed = Math.Max(0, speed - PhysicsConstants.AirDrag * dt);
        b.Velocity = newSpeed > 0 ? b.Velocity.Normalized() * newSpeed : new Vec2(0, 0);
    }

    private static void ApplyTableFriction(Ball b, double dt)
    {
        var contactOffset = new Vec3(0, -PhysicsConstants.BallRadius, 0);
        var vRel3 = ToVec3(b.Velocity) + Vec3.Cross(b.AngularVelocity, contactOffset);
        var vRel2 = new Vec2(vRel3.X, vRel3.Z);
        var relSpeed = vRel2.Length;
        if (relSpeed > PhysicsConstants.RollingEpsilon)
        {
            var relDir = vRel2.Normalized();
            var frictionForce2 = relDir * (-PhysicsConstants.KineticFriction * PhysicsConstants.BallMass * PhysicsConstants.Gravity);
            b.Velocity += frictionForce2 / PhysicsConstants.BallMass * dt;
            var torque = Vec3.Cross(contactOffset, ToVec3(frictionForce2));
            b.AngularVelocity += torque / MomentOfInertia() * dt;
        }
        else
        {
            double roll = Math.Max(0.0, 1.0 - PhysicsConstants.RollDamping * dt);
            double spin = Math.Max(0.0, 1.0 - PhysicsConstants.SpinDamping * dt);
            b.Velocity *= roll;
            b.AngularVelocity *= spin;
        }
    }

    private static void ResolveCushionCollision(Ball b, Vec2 normal, double restitution)
    {
        var n2 = normal.Normalized();
        var n3 = new Vec3(n2.X, 0, n2.Y);
        var rContact = new Vec3(-n2.X * PhysicsConstants.BallRadius, 0, -n2.Y * PhysicsConstants.BallRadius);
        var v3 = ToVec3(b.Velocity);
        var vRel = v3 + Vec3.Cross(b.AngularVelocity, rContact);
        double relNormal = Vec3.Dot(vRel, n3);
        if (relNormal >= 0)
            return;

        double invMass = 1.0 / PhysicsConstants.BallMass;
        double inertia = MomentOfInertia();
        double jn = -(1.0 + restitution) * relNormal / invMass;
        var impulseN = n3 * jn;
        v3 += impulseN * invMass;
        b.AngularVelocity += Vec3.Cross(rContact, impulseN) / inertia;

        var t2 = new Vec2(-n2.Y, n2.X);
        var t3 = new Vec3(t2.X, 0, t2.Y);
        var vRelAfter = v3 + Vec3.Cross(b.AngularVelocity, rContact);
        double relTangent = Vec3.Dot(vRelAfter, t3);
        if (Math.Abs(relTangent) > PhysicsConstants.Epsilon)
        {
            var rCrossT = Vec3.Cross(rContact, t3);
            double kT = invMass + rCrossT.LengthSquared / inertia;
            double jt = -relTangent / kT;
            double maxJt = PhysicsConstants.RailFriction * Math.Abs(jn);
            if (Math.Abs(jt) > maxJt)
                jt = Math.Sign(jt) * maxJt;
            var impulseT = t3 * jt;
            v3 += impulseT * invMass;
            b.AngularVelocity += Vec3.Cross(rContact, impulseT) / inertia;
        }

        b.Velocity = ToVec2(v3);
    }

    private static void ResolveBallBallCollision(Ball a, Ball b, out Vec2 vAOut, out Vec3 wAOut, out Vec2 vBOut, out Vec3 wBOut)
    {
        var n2 = (b.Position - a.Position).Normalized();
        var n3 = new Vec3(n2.X, 0, n2.Y);
        var rA = n3 * PhysicsConstants.BallRadius;
        var rB = n3 * -PhysicsConstants.BallRadius;
        var vA3 = ToVec3(a.Velocity);
        var vB3 = ToVec3(b.Velocity);
        var wA = a.AngularVelocity;
        var wB = b.AngularVelocity;
        var vRel = (vA3 + Vec3.Cross(wA, rA)) - (vB3 + Vec3.Cross(wB, rB));
        double relNormal = Vec3.Dot(vRel, n3);

        double invMass = 1.0 / PhysicsConstants.BallMass;
        double inertia = MomentOfInertia();
        double invMassSum = invMass + invMass;
        double jn = -(1.0 + PhysicsConstants.Restitution) * relNormal / invMassSum;
        var impulseN = n3 * jn;

        vA3 += impulseN * invMass;
        vB3 -= impulseN * invMass;

        var t2 = new Vec2(-n2.Y, n2.X);
        var t3 = new Vec3(t2.X, 0, t2.Y);
        var vRelAfter = (vA3 + Vec3.Cross(wA, rA)) - (vB3 + Vec3.Cross(wB, rB));
        double relTangent = Vec3.Dot(vRelAfter, t3);
        if (Math.Abs(relTangent) > PhysicsConstants.Epsilon)
        {
            var rCrossT = Vec3.Cross(rA, t3);
            double kT = invMassSum + 2.0 * rCrossT.LengthSquared / inertia;
            double jt = -relTangent / kT;
            double maxJt = PhysicsConstants.BallBallFriction * Math.Abs(jn);
            if (Math.Abs(jt) > maxJt)
                jt = Math.Sign(jt) * maxJt;
            var impulseT = t3 * jt;
            vA3 += impulseT * invMass;
            vB3 -= impulseT * invMass;
            wA += Vec3.Cross(rA, impulseT) / inertia;
            wB += Vec3.Cross(rB, impulseT * -1.0) / inertia;
        }

        vAOut = ToVec2(vA3);
        vBOut = ToVec2(vB3);
        wAOut = wA;
        wBOut = wB;
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
                b.AngularVelocity *= PhysicsConstants.LandingSpinDamping;
            }
        }
    }

    private bool TryFindImpact(Ball cue, List<Ball> others, double dt, out Impact impact)
    {
        // check collisions using CCD for the next dt
        foreach (var b in others)
        {
            if (Ccd.CircleCircle(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, b.Position, PhysicsConstants.BallRadius, out double t))
            {
                if (t <= dt)
                {
                    cue.Position += cue.Velocity * t;
                    ResolveBallBallCollision(
                        cue,
                        b,
                        out var cuePost,
                        out var cueSpin,
                        out var targetPost,
                        out var targetSpin);
                    cue.AngularVelocity = cueSpin;
                    b.AngularVelocity = targetSpin;
                    impact = new Impact { Point = cue.Position, CueVelocity = cuePost, TargetVelocity = targetPost };
                    return true;
                }
            }
        }
        foreach (var e in ConnectorEdges)
        {
            if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= dt)
            {
                cue.Position += cue.Velocity * te;
                ResolveCushionCollision(cue, e.Normal, PhysicsConstants.ConnectorRestitution);
                impact = new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
                return true;
            }
        }

        foreach (var e in CushionEdges)
        {
            if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= dt)
            {
                cue.Position += cue.Velocity * te;
                ResolveCushionCollision(cue, e.Normal, PhysicsConstants.CushionRestitution);
                impact = new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
                return true;
            }
        }

        foreach (var e in PocketEdges)
        {
            if (Ccd.CircleSegment(cue.Position, cue.Velocity, PhysicsConstants.BallRadius, e.A, e.B, e.Normal, out double te) && te <= dt)
            {
                cue.Position += cue.Velocity * te;
                ResolveCushionCollision(cue, e.Normal, PhysicsConstants.PocketRestitution);
                impact = new Impact { Point = cue.Position, CueVelocity = cue.Velocity };
                return true;
            }
        }

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
