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
        var p = solver.PreviewShot(cueStart, dir, speed, others);
        return new Result
        {
            Path = p.Path.ToArray(),
            ContactPoint = p.ContactPoint,
            CuePostVelocity = p.CuePostVelocity,
            TargetPostVelocity = p.TargetPostVelocity
        };
    }
}
