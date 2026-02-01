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
    public const double SpinEffectSpeedThreshold = 0.3; // m/s below which spin has no steering/roll effect
    public const double SpinEffectSpeedFadeRange = 0.4; // m/s range to fade in spin effects
    public const double JumpRestitution = 0.1;         // vertical energy retained on landing
    public const double JumpStopVelocity = 0.2;        // m/s below which vertical motion stops
    public const double AirborneHeightThreshold = BallRadius * 0.25; // height before ignoring cushions/balls
    public const double JumpVelocityThreshold = 0.9;   // minimum vertical speed to treat as a hop
    public const double JumpTipOffsetBoost = 0.35;     // reduces jump threshold as tip offset increases
    public const double LandingHorizontalDamping = 0.85; // horizontal speed retained on landing
    public const double LandingSpinDamping = 0.8;      // spin retained on landing
    public const double MasseAngleMin = 25.0;          // degrees where masse starts to show
    public const double MasseAngleMax = 75.0;          // degrees where masse reaches full strength
    public const double MasseSwerveBoost = 2.0;        // multiplier for swerve at max masse
    public const double SwerveSpeedCutoff = 2.5;       // m/s after which swerve fades out
    public const double SwerveSpeedFadeRange = 4.0;    // fade distance for swerve cutoff
    public const double MaxCueElevationDegrees = 85.0; // clamp to UI upper bound
    public const double MaxTipOffsetRatio = 0.9;       // max cue tip offset as a fraction of radius
    public const double PreviewPointSpacing = BallRadius * 0.85; // spacing for curved aim preview
    public const double TableWidth = 2.627;            // 9ft table reduced by ~7.5%
    public const double TableHeight = 1.07707;
    public const double FixedDt = 1.0 / 120.0;         // simulation step
    public const double Epsilon = 1e-9;                // numerical epsilon
    public const double MaxPreviewTime = 30.0;         // safeguard for CCD
    public const double MinCollisionTime = 1e-4;       // guard to prevent zero-time loops
    public const double ContactOffset = 1e-5;          // small push to keep balls off geometry
    public const int MaxSubSteps = 64;                 // hard cap per integration step

    // Pocket geometry derived from WPA spec (metres)
    public const double CornerPocketMouth = 0.1014984; // scaled with table reduction
    public const double SidePocketMouth = 0.1116013;    // scaled with table reduction
    public const double PocketCaptureRadius = 0.087875; // scaled with table reduction
    public const double CornerJawRadiusScale = 0.94;
    public const double CornerJawInset = 0.006;
    public const double SideJawInset = 0.006;
    public const double SideJawDepthScale = 1.08;
    // Shift the pocket capture center outward for the chrome plate cut.
    public const double SidePocketOutset = 0.006;
    // Offset pocket mouth guards to stop balls slipping between jaws and cushions.
    public const double PocketMouthGuardInset = BallRadius * 0.35;

    // Tesselation density for proxy mesh generation (higher => smoother normals)
    public const int CornerJawSegments = 32;
    public const int SideJawSegments = 24;
    public const int JawCushionSegments = 2;           // how many segments nearest the rails behave as cushions
}
