#if UNITY_5_3_OR_NEWER
using UnityEngine;

public class BilliardLighting : MonoBehaviour
{
    void Start()
    {
        // Create a shiny plastic (PBR) material with slightly brighter base color
        Material plasticMat = new Material(Shader.Find("Standard"));
        plasticMat.color = Color.red;           // change color per ball as needed
        plasticMat.SetFloat("_Metallic", 0f);   // not metallic
        // Make the balls a bit shinier and brighter
        // Slightly boost base colour and specular highlights for more sheen.
        plasticMat.color *= 1.2f;
        plasticMat.SetFloat("_Glossiness", 0.97f);
        plasticMat.SetColor("_SpecColor", Color.white * 1.4f);

        // Apply material, attach highlight lights and add cue ball dot
        GameObject[] balls = GameObject.FindGameObjectsWithTag("Ball");
        foreach (GameObject ball in balls)
        {
            Renderer renderer = ball.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material = plasticMat;
            }

            // Add a small red aiming dot to the cue ball so it rolls with the surface
            if (ball.name.ToLower().Contains("cue"))
            {
                CreateCueBallDot(ball.transform);
            }

            // Position three point lights so each ball shows three distinct reflections
            const int lightCount = 3;
            Vector3 basePos = new Vector3(0.5f, 0.8f, 0.6f);
            for (int i = 0; i < lightCount; i++)
            {
                float angle = (i - (lightCount - 1) / 2f) * 30f;
                Vector3 pos = Quaternion.Euler(0f, 0f, angle) * basePos;
                CreateHighlightLight(ball.transform, pos);
            }
        }

        // Slightly boost the texture detail on the green cloth so the felt stands out
        EnhanceClothTexture();
    }

    void CreateHighlightLight(Transform parent, Vector3 localPosition)
    {
        GameObject lightObj = new GameObject("HighlightLight");
        lightObj.transform.parent = parent;
        lightObj.transform.localPosition = localPosition;

        Light pointLight = lightObj.AddComponent<Light>();
        pointLight.type = LightType.Point;
        pointLight.range = 0.75f;  // keep small so highlights don't overlap
        pointLight.intensity = 3f;
        pointLight.shadows = LightShadows.None;
        pointLight.color = Color.white;
    }

    // Create a tiny red sphere on the cue ball to help players judge spin
    void CreateCueBallDot(Transform cueBall)
    {
        Renderer r = cueBall.GetComponent<Renderer>();
        if (r == null)
        {
            return;
        }

        float radius = r.bounds.extents.x;
        float dotRadius = radius * 0.1f;

        GameObject dot = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        dot.name = "CueBallDot";
        dot.transform.SetParent(cueBall);
        dot.transform.localScale = Vector3.one * dotRadius * 2f; // diameter
        dot.transform.localPosition = new Vector3(0f, radius - dotRadius, 0f);

        Renderer dotRenderer = dot.GetComponent<Renderer>();
        if (dotRenderer != null)
        {
            Material dotMat = new Material(Shader.Find("Standard"));
            dotMat.color = Color.red;
            dotMat.SetFloat("_Metallic", 0f);
            dotMat.SetFloat("_Glossiness", 0.4f);
            dotRenderer.material = dotMat;
        }
    }

    // Increase the cloth texture scale slightly so the green felt looks richer
    void EnhanceClothTexture()
    {
        GameObject cloth = GameObject.Find("TableCloth");
        if (cloth == null)
        {
            cloth = GameObject.Find("Cloth");
        }

        if (cloth != null)
        {
            Renderer renderer = cloth.GetComponent<Renderer>();
            if (renderer != null)
            {
                Material mat = renderer.material;
                mat.mainTextureScale *= 1.2f;
                if (mat.HasProperty("_BumpScale"))
                {
                    mat.SetFloat("_BumpScale", mat.GetFloat("_BumpScale") * 1.2f);
                }
            }
        }
    }
}
#endif
