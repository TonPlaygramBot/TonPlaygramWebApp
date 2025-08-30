using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace Aiming
{
    [RequireComponent(typeof(LineRenderer))]
    public class AimingDebugOverlay : MonoBehaviour
    {
        AimingConfig cfg;
        ShotContext lastCtx;
        ShotInfo lastInfo;
        AimSolution lastSol;
        bool hasData = false;

        public void Init(AimingConfig config) { cfg = config; }

        public void UpdateOverlay(in ShotContext ctx, in ShotInfo info, in AimSolution sol)
        {
            lastCtx = ctx;
            lastInfo = info;
            lastSol = sol;
            hasData = true;
        }

        void OnDrawGizmos()
        {
            if (!hasData || cfg == null) return;
            Gizmos.color = cfg.lineColor;
            Gizmos.DrawSphere(lastSol.aimEnd, lastCtx.ballRadius * 0.3f);
            Gizmos.DrawLine(lastCtx.objectBallPos, lastCtx.pocketPos);
            Gizmos.DrawLine(lastCtx.cueBallPos, lastSol.aimEnd);
#if UNITY_EDITOR
            Handles.Label(lastSol.aimEnd + Vector3.up * 0.02f, $"{lastSol.strategyUsed}: {lastSol.debugNote}");
#endif
        }
    }
}
