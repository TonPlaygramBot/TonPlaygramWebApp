namespace Billiards;

/// <summary>Holds all tunable physics constants for determinism and easy calibration.</summary>
public static class PhysicsConstants
{
    public const double BallRadius = 0.028575;        // metres (57.15 mm diameter)
    public const double Restitution = 0.98;            // elastic coefficient
    // cushions should return a bit of energy for a natural feel without amplifying speed
    public const double CushionRestitution = Restitution * 0.9; // slight bounce for table edges
    // pocket jaws bounce with 75% less energy than cushions
    public const double JawRestitution = CushionRestitution * 0.25;          // pocket jaw elasticity
    public const double JawFriction = 0.12;             // tangential friction at jaws
    public const double JawDrag = 0.02;                 // additional energy loss on contact
    // reduced damping so balls can travel freely across the table
    public const double Mu = 0.05;                      // linear damping (m/s^2)
    public const double TableWidth = 2.84;             // 9ft table internal size
    public const double TableHeight = 1.42;
    public const double FixedDt = 1.0 / 120.0;         // simulation step
    public const double Epsilon = 1e-9;                // numerical epsilon
    public const double MaxPreviewTime = 30.0;         // safeguard for CCD
}
