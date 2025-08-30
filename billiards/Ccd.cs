using System;

namespace Billiards;

/// <summary>Continuous collision detection helpers.</summary>
public static class Ccd
{
    /// <summary>Time of impact between a moving circle and static circle. Returns true if they collide.</summary>
    public static bool CircleCircle(Vec2 p0, Vec2 v0, double r0, Vec2 p1, double r1, out double toi)
    {
        Vec2 rel = p0 - p1;
        double r = r0 + r1;
        double a = Vec2.Dot(v0, v0);
        double b = 2 * Vec2.Dot(rel, v0);
        double c = Vec2.Dot(rel, rel) - r * r;
        double disc = b * b - 4 * a * c;
        if (disc < 0 || Math.Abs(a) < PhysicsConstants.Epsilon)
        {
            toi = double.PositiveInfinity;
            return false;
        }
        double sqrt = Math.Sqrt(disc);
        double t = (-b - sqrt) / (2 * a);
        if (t >= 0 && t <= PhysicsConstants.MaxPreviewTime)
        {
            toi = t;
            return true;
        }
        toi = double.PositiveInfinity;
        return false;
    }

    /// <summary>Time of impact between moving circle and axis-aligned bounding box edges.</summary>
    public static bool CircleAabb(Vec2 p, Vec2 v, double r, Vec2 min, Vec2 max, out double toi, out Vec2 normal)
    {
        toi = double.PositiveInfinity;
        normal = new Vec2(0, 0);
        bool hit = false;

        if (Math.Abs(v.X) > PhysicsConstants.Epsilon)
        {
            double tx = v.X > 0 ? (max.X - r - p.X) / v.X : (min.X + r - p.X) / v.X;
            if (tx >= 0 && tx < toi)
            {
                double y = p.Y + v.Y * tx;
                if (y >= min.Y + r && y <= max.Y - r)
                {
                    toi = tx;
                    hit = true;
                    normal = v.X > 0 ? new Vec2(-1, 0) : new Vec2(1, 0);
                }
            }
        }
        if (Math.Abs(v.Y) > PhysicsConstants.Epsilon)
        {
            double ty = v.Y > 0 ? (max.Y - r - p.Y) / v.Y : (min.Y + r - p.Y) / v.Y;
            if (ty >= 0 && ty < toi)
            {
                double x = p.X + v.X * ty;
                if (x >= min.X + r && x <= max.X - r)
                {
                    toi = ty;
                    hit = true;
                    normal = v.Y > 0 ? new Vec2(0, -1) : new Vec2(0, 1);
                }
            }
        }
        return hit;
    }

    /// <summary>Time of impact between moving circle and line segment with given normal.
    /// The normal should point into the playable area.</summary>
    public static bool CircleSegment(Vec2 p, Vec2 v, double r, Vec2 a, Vec2 b, Vec2 normal, out double toi)
    {
        toi = double.PositiveInfinity;
        var n = normal.Normalized();
        double denom = Vec2.Dot(v, n);
        if (denom >= -PhysicsConstants.Epsilon)
            return false;

        double dist = Vec2.Dot(p - a, n);
        double t = (r - dist) / denom;
        if (t < 0 || t > PhysicsConstants.MaxPreviewTime)
            return false;

        var hitPoint = p + v * t - n * r;
        var seg = b - a;
        double len = seg.Length;
        if (len < PhysicsConstants.Epsilon)
            return false;
        var dir = seg / len;
        double proj = Vec2.Dot(hitPoint - a, dir);
        if (proj < -PhysicsConstants.Epsilon || proj > len + PhysicsConstants.Epsilon)
            return false;

        toi = t;
        return true;
    }
}
