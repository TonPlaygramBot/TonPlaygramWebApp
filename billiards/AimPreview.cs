using System.Collections.Generic;

namespace Billiards;

/// <summary>High level preview builder converting solver output to polylines.</summary>
public static class AimPreview
{
    public class Result
    {
        public Vec2[] Path;
        public Vec2 ContactPoint;
        public Vec2 CuePostVelocity;
        public Vec2? TargetPostVelocity;
    }

    /// <summary>Runs the solver preview and formats the result.</summary>
    public static Result Build(BilliardsSolver solver, Vec2 cueStart, Vec2 dir, double speed, List<BilliardsSolver.Ball> others)
    {
        var preview = solver.PreviewShot(cueStart, dir, speed, others);
        var impact = solver.SimulateFirstImpact(cueStart, dir, speed, others);

        List<Vec2> path = new List<Vec2> { cueStart, impact.Point };
        if (impact.CueVelocity.Length > PhysicsConstants.Epsilon)
        {
            path.Add(impact.Point + impact.CueVelocity.Normalized() * PhysicsConstants.BallRadius);
        }

        return new Result
        {
            Path = path.ToArray(),
            ContactPoint = impact.Point,
            CuePostVelocity = impact.CueVelocity,
            TargetPostVelocity = impact.TargetVelocity ?? preview.TargetPostVelocity
        };
    }
}
