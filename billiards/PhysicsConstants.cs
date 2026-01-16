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
    public const double Gravity = 9.81;                // m/s^2
    public const double AirDrag = 0.05;                // linear damping in flight (m/s^2)
    public const double BallMass = 0.17;               // kg (typical pool ball)
    public const double RollingEpsilon = 0.02;         // m/s
    public const double KineticFriction = 0.22;        // sliding friction coefficient
    public const double RollDamping = 0.10;            // per-second rolling drag
    public const double SpinDamping = 0.04;            // per-second spin drag in rolling
    public const double BallBallFriction = 0.20;       // tangential impulse cap for ball-ball
    public const double RailFriction = 0.25;           // tangential impulse cap for cushions
    public const double PowerToImpulseScale = 1.0;     // maps UI power to impulse (N·s)
    public const double JumpRestitution = 0.1;         // vertical energy retained on landing
    public const double JumpStopVelocity = 0.2;        // m/s below which vertical motion stops
    public const double AirborneHeightThreshold = BallRadius * 0.25; // height before ignoring cushions/balls
    public const double JumpVelocityThreshold = 0.9;   // minimum vertical speed to treat as a hop
    public const double JumpTipOffsetBoost = 0.35;     // reduces jump threshold as tip offset increases
    public const double LandingHorizontalDamping = 0.85; // horizontal speed retained on landing
    public const double LandingSpinDamping = 0.8;      // spin retained on landing
    public const double MaxCueElevationDegrees = 85.0; // clamp to UI upper bound
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
