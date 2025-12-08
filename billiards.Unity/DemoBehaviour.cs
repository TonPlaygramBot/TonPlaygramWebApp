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
    // Optional line showing the cue ball's direction after the first impact.
    public LineRenderer CuePostLine;
    // Optional line showing the target ball's direction after the first impact.
    public LineRenderer TargetPostLine;
    // Reference to the cue ball so the aim direction can be calculated
    public Transform CueBall;
    // How quickly the aiming line follows camera movement.  Lower values make
    // smaller adjustments for more precise shots so the player can line up
    // accurate shots without the aim jumping in large steps.
    public float aimSmoothing = 4f;
    public float previewSpeed = 3.0f;
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
        // Aim direction is derived from the camera's forward vector so the
        // player aims by moving the camera rather than dragging the line.
        var camForward = Camera.main.transform.forward;
        var desiredDir = new Vec2(camForward.x, camForward.z).Normalized();

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

            if (CuePostLine != null)
            {
                // Draw a short helper line representing the cue ball's direction after impact.
                var postVelocity = preview.CuePostVelocity;
                if (postVelocity.Length > PhysicsConstants.Epsilon && preview.Path.Length > 0)
                {
                    Vec2 start = preview.Path[preview.Path.Length - 1];
                    Vec2 dir2D = postVelocity.Normalized();
                    // Extend the line by one ball length for clarity so it feels like part of the main guide.
                    float postLength = Mathf.Max((float)PhysicsConstants.BallRadius * 2f, (float)postVelocity.Length);
                    Vector3 a = new Vector3((float)start.X, CueBall.position.y, (float)start.Y);
                    Vector3 b = a + new Vector3((float)dir2D.X, 0f, (float)dir2D.Y) * postLength;
                    CuePostLine.positionCount = 2;
                    CuePostLine.SetPosition(0, a);
                    CuePostLine.SetPosition(1, b);
                }
                else
                {
                    CuePostLine.positionCount = 0;
                }
            }

            if (TargetPostLine != null)
            {
                // Draw a helper line showing the predicted direction of the target ball.
                if (preview.TargetPostVelocity.HasValue && preview.Path.Length > 0)
                {
                    var targetVelocity = preview.TargetPostVelocity.Value;
                    if (targetVelocity.Length > PhysicsConstants.Epsilon)
                    {
                        Vec2 start = preview.Path[preview.Path.Length - 1];
                        Vec2 dir2D = targetVelocity.Normalized();
                        float postLength = Mathf.Max((float)PhysicsConstants.BallRadius * 2f, (float)targetVelocity.Length);
                        Vector3 a = new Vector3((float)start.X, CueBall.position.y, (float)start.Y);
                        Vector3 b = a + new Vector3((float)dir2D.X, 0f, (float)dir2D.Y) * postLength;
                        TargetPostLine.positionCount = 2;
                        TargetPostLine.SetPosition(0, a);
                        TargetPostLine.SetPosition(1, b);
                    }
                    else
                    {
                        TargetPostLine.positionCount = 0;
                    }
                }
                else
                {
                    TargetPostLine.positionCount = 0;
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
            if (CuePostLine != null)
            {
                CuePostLine.positionCount = 0;
            }
            if (TargetPostLine != null)
            {
                TargetPostLine.positionCount = 0;
            }
        }
    }
#endif
