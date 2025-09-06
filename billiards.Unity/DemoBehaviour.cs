#if UNITY_5_3_OR_NEWER
using UnityEngine;
using System.Collections.Generic;
using Billiards;

/// <summary>Example MonoBehaviour wiring the solver to mouse input and a LineRenderer.</summary>
public class DemoBehaviour : MonoBehaviour
{
    public LineRenderer Line;
    private BilliardsSolver solver = new BilliardsSolver();
    private List<BilliardsSolver.Ball> balls = new List<BilliardsSolver.Ball>();

    private void Start()
    {
        solver.InitStandardTable();
        Line.positionCount = 0;
    }

    private void Update()
    {
        if (Input.GetMouseButton(0))
        {
            var start = ScreenToWorld.FromScreen(Camera.main, Input.mousePosition);
            var dir = new Vec2(1, 0); // placeholder, normally from cue direction
            var preview = AimPreview.Build(solver, start, dir, 2.0, balls);
            Line.positionCount = preview.Path.Length;
            for (int i = 0; i < preview.Path.Length; i++)
            {
                Line.SetPosition(i, new Vector3((float)preview.Path[i].X, (float)preview.Path[i].Y, 0));
            }
        }
        else
        {
            Line.positionCount = 0;
        }
    }
}
#endif
