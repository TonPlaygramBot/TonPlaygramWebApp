#if UNITY_5_3_OR_NEWER
using UnityEngine;
using System.Collections.Generic;
using Billiards;

/// <summary>Example MonoBehaviour wiring the solver to mouse input and a LineRenderer.</summary>
public class DemoBehaviour : MonoBehaviour
{
    public LineRenderer Line;
    // Reference to the cue ball so the aim direction can be calculated
    public Transform CueBall;
    // How quickly the aiming line follows the pointer (higher is snappier)
    public float aimSmoothing = 12f;
    public float previewSpeed = 2.0f;

    private BilliardsSolver solver = new BilliardsSolver();
    private List<BilliardsSolver.Ball> balls = new List<BilliardsSolver.Ball>();
    private Vec2 currentDir = new Vec2(1, 0);

    private void Start()
    {
        solver.InitStandardTable();
        Line.positionCount = 0;
    }

    private void Update()
    {
        if (Input.GetMouseButton(0) && CueBall != null)
        {
            // Convert cue ball and target positions to solver coordinates
            var cueStart = new Vec2(CueBall.position.x, CueBall.position.y);
            var target = ScreenToWorld.FromScreen(Camera.main, Input.mousePosition);

            // Smoothly adjust the aiming direction towards the chosen target
            var desiredDir = (target - cueStart).Normalized();
            currentDir = (currentDir + (desiredDir - currentDir) * Time.deltaTime * aimSmoothing).Normalized();

            var preview = AimPreview.Build(solver, cueStart, currentDir, previewSpeed, balls);
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
