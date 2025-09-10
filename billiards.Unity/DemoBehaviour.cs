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
    // How quickly the aiming line follows the pointer.  Lower values make
    // smaller adjustments for more precise shots so the player can line up
    // accurate shots without the aim jumping in large steps.
    public float aimSmoothing = 4f;
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
        if (CueBall == null)
        {
            Line.positionCount = 0;
            return;
        }

        // Convert cue ball and target positions to solver coordinates. The
        // solver operates in the XZ plane while Unity uses Y for height.
        var cueStart = new Vec2(CueBall.position.x, CueBall.position.z);
        var target = ScreenToWorld.FromScreen(Camera.main, Input.mousePosition, CueBall.position.y);
        var desiredDir = (target - cueStart).Normalized();

        if (Input.GetMouseButtonDown(0))
        {
            // Snap immediately to the selected target when the player clicks.
            currentDir = desiredDir;
        }

        if (Input.GetMouseButton(0))
        {
            // Smoothly adjust the aim for small pointer movements.
            float smoothingFactor = Mathf.Clamp01(1f - Mathf.Exp(-Time.deltaTime * aimSmoothing));
            currentDir = (currentDir + (desiredDir - currentDir) * smoothingFactor).Normalized();

            var preview = AimPreview.Build(solver, cueStart, currentDir, previewSpeed, balls);
            Line.positionCount = preview.Path.Length;
            for (int i = 0; i < preview.Path.Length; i++)
            {
                Line.SetPosition(i, new Vector3((float)preview.Path[i].X, CueBall.position.y, (float)preview.Path[i].Y));
            }
        }
        else
        {
            Line.positionCount = 0;
        }
    }
}
#endif
