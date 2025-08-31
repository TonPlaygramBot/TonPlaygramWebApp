using Billiards;

namespace Billiards.Tests;

public class ScreenToWorldTests
{
    [Test]
    public void OrthoFlipsYAxis()
    {
        double width = 100;
        double height = 100;
        var topLeft = ScreenToWorld.Ortho(new Vec2(0, 0), width, height);
        Assert.That(topLeft.X, Is.EqualTo(0).Within(1e-9));
        Assert.That(topLeft.Y, Is.EqualTo(PhysicsConstants.TableHeight).Within(1e-9));

        var bottomLeft = ScreenToWorld.Ortho(new Vec2(0, height), width, height);
        Assert.That(bottomLeft.Y, Is.EqualTo(0).Within(1e-9));
    }
}
