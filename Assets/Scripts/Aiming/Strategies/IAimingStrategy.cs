using UnityEngine;

namespace Aiming
{
    public interface IAimingStrategy
    {
        string Name { get; }
        AimSolution Solve(in ShotContext ctx, in ShotInfo info, AimingConfig cfg);
    }
}
