namespace Billiards;

/// <summary>Holds all tunable physics constants for determinism and easy calibration.</summary>
public static class PhysicsConstants
{
    public const double BallRadius = 0.028575;        // metres (57.15 mm diameter)
    public const double Restitution = 0.9;             // elastic coefficient (clean cushion hits 0.85–0.92)
    public const double CushionRestitution = Restitution; // use the same restitution for cushions
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

    // Pocket geometry derived from WPA spec (metres)
    public const double CornerPocketMouth = 0.1143;    // 4.5" mouth between cushion noses
    public const double SidePocketMouth = 0.127;       // 5" mouth between cushion noses
    public const double PocketCaptureRadius = 0.095;   // radius where balls fall through

    // Tesselation density for proxy mesh generation (higher => smoother normals)
    public const int CornerJawSegments = 32;
    public const int SideJawSegments = 24;
}
