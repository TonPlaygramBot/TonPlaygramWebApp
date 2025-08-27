using System;

namespace Billiards;

/// <summary>Lightweight deterministic 2D vector using doubles.</summary>
public readonly struct Vec2
{
    public readonly double X;
    public readonly double Y;

    public Vec2(double x, double y) { X = x; Y = y; }

    public static Vec2 operator +(Vec2 a, Vec2 b) => new Vec2(a.X + b.X, a.Y + b.Y);
    public static Vec2 operator -(Vec2 a, Vec2 b) => new Vec2(a.X - b.X, a.Y - b.Y);
    public static Vec2 operator *(Vec2 a, double s) => new Vec2(a.X * s, a.Y * s);
    public static Vec2 operator /(Vec2 a, double s) => new Vec2(a.X / s, a.Y / s);

    public double Length => Math.Sqrt(X * X + Y * Y);
    public double LengthSquared => X * X + Y * Y;

    public Vec2 Normalized()
    {
        var l = Length;
        return l < PhysicsConstants.Epsilon ? new Vec2(0, 0) : this / l;
    }

    public static double Dot(Vec2 a, Vec2 b) => a.X * b.X + a.Y * b.Y;

    public override string ToString() => $"({X}, {Y})";
}
