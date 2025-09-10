namespace Billiards;

/// <summary>Utility converting screen coordinates to world space.</summary>
public static class ScreenToWorld
{
#if UNITY_5_3_OR_NEWER
    /// <summary>Unity wrapper that projects the pointer onto the table plane.</summary>
    /// <param name="cam">Camera used for the projection.</param>
    /// <param name="screen">Screen position in pixels.</param>
    /// <param name="planeY">Y position of the table plane in world units.</param>
    public static Vec2 FromScreen(UnityEngine.Camera cam, UnityEngine.Vector2 screen, float planeY = 0f)
    {
        var ray = cam.ScreenPointToRay(new UnityEngine.Vector3(screen.x, screen.y, 0f));
        var plane = new UnityEngine.Plane(UnityEngine.Vector3.up, new UnityEngine.Vector3(0f, planeY, 0f));
        if (plane.Raycast(ray, out float enter))
        {
            var hit = ray.GetPoint(enter);
            // In Unity the table lies on the XZ plane, so map to Vec2 accordingly.
            return new Vec2(hit.x, hit.z);
        }
        // Fallback to old behaviour if the ray does not intersect the plane.
        var p = cam.ScreenToWorldPoint(new UnityEngine.Vector3(screen.x, screen.y, cam.nearClipPlane));
        return new Vec2(p.x, p.z);
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
