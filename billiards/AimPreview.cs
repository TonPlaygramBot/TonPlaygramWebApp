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

        List<Vec2> path = preview.Path.Count > 0 ? preview.Path : new List<Vec2> { cueStart };
        if (preview.CuePostVelocity.Length > PhysicsConstants.Epsilon)
        {
            var endPoint = preview.ContactPoint;
            path.Add(endPoint + preview.CuePostVelocity.Normalized() * PhysicsConstants.BallRadius);
        }

        return new Result
        {
            Path = path.ToArray(),
            ContactPoint = preview.ContactPoint,
            CuePostVelocity = preview.CuePostVelocity,
            TargetPostVelocity = preview.TargetPostVelocity
        };
    }

    /// <summary>Preview with explicit spin and cue elevation inputs.</summary>
    public static Result Build(BilliardsSolver solver, Vec2 cueStart, BilliardsSolver.ShotParams shot, List<BilliardsSolver.Ball> others)
    {
        var preview = solver.PreviewShot(shot, cueStart, others);

        List<Vec2> path = preview.Path.Count > 0 ? preview.Path : new List<Vec2> { cueStart };
        if (preview.CuePostVelocity.Length > PhysicsConstants.Epsilon)
        {
            var endPoint = preview.ContactPoint;
            path.Add(endPoint + preview.CuePostVelocity.Normalized() * PhysicsConstants.BallRadius);
        }

        return new Result
        {
            Path = path.ToArray(),
            ContactPoint = preview.ContactPoint,
            CuePostVelocity = preview.CuePostVelocity,
            TargetPostVelocity = preview.TargetPostVelocity
        };
    }
}
