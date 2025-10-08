using System;

namespace Billiards;

/// <summary>Holds all tunable physics constants for determinism and easy calibration.</summary>
public static class PhysicsConstants
{
    public const double BallRadius = 0.028575;        // metres (57.15 mm diameter)
    public const double Restitution = 0.98;            // elastic coefficient
    public const double CushionRestitution = Restitution * 1.1; // extra bounce for table edges
    // connectors retain only a quarter of the cushion bounce (lose ~75% of speed)
    public const double ConnectorRestitution = CushionRestitution * 0.25;
    // pocket edges fully absorb balls (no bounce)
    public const double PocketRestitution = 0.0;
    public const double Mu = 0.2;                      // linear damping (m/s^2)
    public const double TableWidth = 2.84;             // 9ft table internal size
    public const double TableHeight = 1.42;
    public const double FixedDt = 1.0 / 120.0;         // simulation step
    public const double Epsilon = 1e-9;                // numerical epsilon
    public const double MaxPreviewTime = 30.0;         // safeguard for CCD

    /// <summary>
    /// Snooker corner cushions are bevelled at 32 degrees.  The cut begins a
    /// short distance away from the actual corner along the long rail so that
    /// balls entering the pocket do not bounce straight back out.
    /// </summary>
    public const double CornerCutAngleDegrees = 32.0;

    /// <summary>Distance along the long cushion before the bevel begins (metres).</summary>
    public const double CornerCutLongOffset = 0.095;

    /// <summary>Corner cut angle in radians.</summary>
    public static readonly double CornerCutAngleRadians = CornerCutAngleDegrees * Math.PI / 180.0;

    /// <summary>
    /// Depth of the bevel measured along the short cushion so that the surface
    /// meets the 32 degree requirement.
    /// </summary>
    public static readonly double CornerCutShortOffset = CornerCutLongOffset * Math.Tan(CornerCutAngleRadians);
}
