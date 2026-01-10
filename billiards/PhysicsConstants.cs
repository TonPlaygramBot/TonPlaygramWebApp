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
    public const double Gravity = 9.81;                // m/s^2
    public const double AirDrag = 0.05;                // linear damping in flight (m/s^2)
    public const double SpinDecay = 2.0;               // per-second decay for on-table spin
    public const double AirSpinDecay = 0.6;            // per-second decay while airborne
    public const double SwerveCoefficient = 2.4;       // lateral accel per unit side spin * speed
    public const double RollAcceleration = 1.2;        // forward accel per unit top/back spin
    public const double JumpRestitution = 0.1;         // vertical energy retained on landing
    public const double JumpStopVelocity = 0.2;        // m/s below which vertical motion stops
    public const double AirborneHeightThreshold = BallRadius * 0.25; // height before ignoring cushions/balls
    public const double MaxCueElevationDegrees = 70.0; // WPA jump cue elevations top out near this range
    public const double MaxTipOffsetRatio = 0.9;       // max cue tip offset as a fraction of radius
    public const double PreviewPointSpacing = BallRadius * 0.85; // spacing for curved aim preview
    public const double TableWidth = 2.627;            // 9ft table reduced by ~7.5%
    public const double TableHeight = 1.3135;
    public const double FixedDt = 1.0 / 120.0;         // simulation step
    public const double Epsilon = 1e-9;                // numerical epsilon
    public const double MaxPreviewTime = 30.0;         // safeguard for CCD
    public const double MinCollisionTime = 1e-4;       // guard to prevent zero-time loops
    public const double ContactOffset = 1e-5;          // small push to keep balls off geometry
    public const int MaxSubSteps = 64;                 // hard cap per integration step

    // Pocket geometry derived from WPA spec (metres)
    public const double CornerPocketMouth = 0.1057275; // scaled with table reduction
    public const double SidePocketMouth = 0.117475;    // scaled with table reduction
    public const double PocketCaptureRadius = 0.087875; // scaled with table reduction
    // Keep side pockets aligned with the rail line so they behave identically to corner pockets.
    public const double SidePocketOutset = 0.0;

    // Tesselation density for proxy mesh generation (higher => smoother normals)
    public const int CornerJawSegments = 32;
    public const int SideJawSegments = 24;
    public const int JawCushionSegments = 2;           // how many segments nearest the rails behave as cushions
}
