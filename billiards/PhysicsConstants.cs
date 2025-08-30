namespace Billiards;

/// <summary>Holds all tunable physics constants for determinism and easy calibration.</summary>
public static class PhysicsConstants
{
    public const double BallRadius = 0.028575;        // metres (57.15 mm diameter)
    public const double Restitution = 0.98;            // elastic coefficient
    public const double PocketRestitution = 0;              // no bounce on pocket edges
    public const double Mu = 0.2;                      // linear damping (m/s^2)
    public const double TableWidth = 2.84;             // 9ft table internal size
    public const double TableHeight = 1.42;
    public const double FixedDt = 1.0 / 120.0;         // simulation step
    public const double Epsilon = 1e-9;                // numerical epsilon
    public const double MaxPreviewTime = 30.0;         // safeguard for CCD
}
