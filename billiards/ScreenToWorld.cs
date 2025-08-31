namespace Billiards;

/// <summary>Utility converting screen coordinates to world space.</summary>
public static class ScreenToWorld
{
#if UNITY_5_3_OR_NEWER
    /// <summary>Unity wrapper using the active camera.</summary>
    public static Vec2 FromScreen(UnityEngine.Camera cam, UnityEngine.Vector2 screen)
    {
        var p = cam.ScreenToWorldPoint(new UnityEngine.Vector3((float)screen.x, (float)screen.y, 0));
        return new Vec2(p.x, p.y);
    }
#endif

    /// <summary>Engine-agnostic orthographic conversion.</summary>
    public static Vec2 Ortho(Vec2 screen, double screenWidth, double screenHeight)
    {
        double x = screen.X / screenWidth * PhysicsConstants.TableWidth;
        double y = (screenHeight - screen.Y) / screenHeight * PhysicsConstants.TableHeight;
        return new Vec2(x, y);
    }
}
