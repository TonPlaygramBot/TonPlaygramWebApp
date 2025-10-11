#if UNITY_5_3_OR_NEWER
using UnityEngine;
using System.Collections.Generic;
using Billiards;

/// <summary>Example MonoBehaviour wiring the solver to mouse input and a LineRenderer.</summary>
public class DemoBehaviour : MonoBehaviour
{
    public LineRenderer Line;
    // Optional circle shown at the end of the aiming line.
    public LineRenderer Circle;
    // Reference to the cue ball so the aim direction can be calculated
    public Transform CueBall;
    // How quickly the aiming line follows camera movement.  Lower values make
    // smaller adjustments for more precise shots so the player can line up
    // accurate shots without the aim jumping in large steps.
    public float aimSmoothing = 4f;
    public float previewSpeed = 2.0f;
    // Toggle whether the aiming guide should be visible. Defaults to off for broadcast play.
    public bool showAimingLine = false;

    private BilliardsSolver solver = new BilliardsSolver();
    private List<BilliardsSolver.Ball> balls = new List<BilliardsSolver.Ball>();
    private Vec2 currentDir = new Vec2(1, 0);

    private void Start()
    {
        solver.InitStandardTable();
        ClearRenderers();
    }

    private void Update()
    {
        if (CueBall == null)
        {
            ClearRenderers();
            return;
        }

        // Convert cue ball position to solver coordinates. The solver operates
        // in the XZ plane while Unity uses Y for height.
        var cueStart = new Vec2(CueBall.position.x, CueBall.position.z);
        // Aim direction is derived from the camera's centre ray so the
        // guiding line always matches what the player sees on screen even
        // when the camera strafes.
        Camera cam = Camera.main;
        var desiredDir = currentDir;
        if (cam != null)
        {
            Ray viewRay = cam.ViewportPointToRay(new Vector3(0.5f, 0.5f, 0f));
            Plane clothPlane = new Plane(Vector3.up, new Vector3(0f, CueBall.position.y, 0f));
            float distance;
            if (clothPlane.Raycast(viewRay, out distance))
            {
                Vector3 aimPoint = viewRay.GetPoint(distance);
                Vector3 flat = new Vector3(aimPoint.x - CueBall.position.x, 0f, aimPoint.z - CueBall.position.z);
                if (flat.sqrMagnitude > 0.0001f)
                {
                    desiredDir = new Vec2(flat.x, flat.z).Normalized();
                }
            }
            else
            {
                Vector3 forward = cam.transform.forward;
                desiredDir = new Vec2(forward.x, forward.z).Normalized();
            }
        }

        // Smoothly adjust the aim for small camera movements.
        float smoothingFactor = Mathf.Clamp01(1f - Mathf.Exp(-Time.deltaTime * aimSmoothing));
        currentDir = (currentDir + (desiredDir - currentDir) * smoothingFactor).Normalized();

        var preview = AimPreview.Build(solver, cueStart, currentDir, previewSpeed, balls);
        if (!showAimingLine || Line == null)
        {
            ClearRenderers();
        }
        else
        {
            Line.positionCount = preview.Path.Length;
            for (int i = 0; i < preview.Path.Length; i++)
            {
                Line.SetPosition(i, new Vector3((float)preview.Path[i].X, CueBall.position.y, (float)preview.Path[i].Y));
            }

            if (Circle != null)
            {
                if (preview.Path.Length > 0)
                {
                    // Draw a circle at the end of the aiming line sized to match the ball.
                    const int segments = 32;
                    Circle.positionCount = segments + 1;
                    var endPoint = preview.Path[preview.Path.Length - 1];
                    Vector3 centre = new Vector3((float)endPoint.X, CueBall.position.y, (float)endPoint.Y);
                    float radius = (float)PhysicsConstants.BallRadius;
                    for (int i = 0; i <= segments; i++)
                    {
                        float angle = (float)i / segments * Mathf.PI * 2f;
                        float x = Mathf.Cos(angle) * radius;
                        float z = Mathf.Sin(angle) * radius;
                        Circle.SetPosition(i, centre + new Vector3(x, 0f, z));
                    }
                }
                else
                {
                    Circle.positionCount = 0;
                }
            }
        }
    }

    private void ClearRenderers()
    {
        if (Line != null)
        {
            Line.positionCount = 0;
        }
        if (Circle != null)
        {
            Circle.positionCount = 0;
        }
    }
}
#endif
