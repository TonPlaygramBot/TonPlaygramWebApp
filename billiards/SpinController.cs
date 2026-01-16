using System;

namespace Billiards;

/// <summary>Quantized spinning controller and UI-to-cue mapping helpers.</summary>
public static class SpinController
{
    public const double MaxOffset = 0.70;
    public const double StunRadius = 0.12;
    public const double Ring1Radius = 0.32;
    public const double Ring2Radius = 0.52;
    public const double Ring3Radius = MaxOffset;

    public const double Level0Mag = 0.00;
    public const double Level1Mag = 0.25 * MaxOffset;
    public const double Level2Mag = 0.50 * MaxOffset;
    public const double Level3Mag = 0.80 * MaxOffset;

    public static Vec2 ComputeQuantizedOffsetScaled(double rawX, double rawY)
    {
        var raw = new Vec2(rawX, rawY);
        double distance = raw.Length;

        if (distance > MaxOffset && distance > PhysicsConstants.Epsilon)
        {
            raw = raw.Normalized() * MaxOffset;
            distance = MaxOffset;
        }

        double mag;
        if (distance <= StunRadius)
            mag = Level0Mag;
        else if (distance <= Ring1Radius)
            mag = Level1Mag;
        else if (distance <= Ring2Radius)
            mag = Level2Mag;
        else
            mag = Level3Mag;

        if (mag <= PhysicsConstants.Epsilon)
            return new Vec2(0, 0);

        return raw.Normalized() * mag;
    }

    public static Vec2 MapUiOffsetToCueFrame(double uiX, double uiY, Vec3 cameraRight, Vec3 cameraUp, Vec3 cueRight, Vec3 cueUp)
    {
        var offsetWorld = cameraRight * uiX + cameraUp * uiY;
        double x = Vec3.Dot(offsetWorld, cueRight);
        double y = Vec3.Dot(offsetWorld, cueUp);
        return new Vec2(x, y);
    }
}
