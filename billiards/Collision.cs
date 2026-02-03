using System;

namespace Billiards;

/// <summary>Post-impact velocity computations.</summary>
public static class Collision
{
    /// <summary>Reflect velocity on a surface with given normal and restitution.</summary>
    public static Vec2 Reflect(Vec2 v, Vec2 normal, double restitution)
    {
        var n = normal.Normalized();
        var dot = Vec2.Dot(v, n);
        return v - n * (1 + restitution) * dot;
    }

    /// <summary>Reflect velocity with tangential damping to simulate cushion grip.</summary>
    public static Vec2 ReflectWithFriction(Vec2 v, Vec2 normal, double restitution, double friction)
    {
        var n = normal.Normalized();
        var alongNormal = Vec2.Dot(v, n);
        var tangent = v - n * alongNormal;
        var clampedFriction = Math.Clamp(friction, 0.0, 0.95);
        var dampedTangent = tangent * (1.0 - clampedFriction);
        var reflectedNormal = n * (-alongNormal * restitution);
        return dampedTangent + reflectedNormal;
    }

    /// <summary>Reflect velocity on a surface with default table restitution.</summary>
    public static Vec2 Reflect(Vec2 v, Vec2 normal)
    {
        return Reflect(v, normal, PhysicsConstants.Restitution);
    }

    /// <summary>Resolve elastic collision between two equal-mass balls.</summary>
    public static void ResolveBallBall(Vec2 p0, Vec2 v0, Vec2 p1, Vec2 v1, out Vec2 v0Out, out Vec2 v1Out)
    {
        var n = (p1 - p0).Normalized();
        var relVel = v0 - v1;
        var along = Vec2.Dot(relVel, n);
        var j = n * along;
        v0Out = (v0 - j) * PhysicsConstants.Restitution;
        v1Out = (v1 + j) * PhysicsConstants.Restitution;
    }
}
