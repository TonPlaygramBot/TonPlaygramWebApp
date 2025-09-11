#if UNITY_5_3_OR_NEWER
using UnityEngine;

public class BilliardLighting : MonoBehaviour
{
    void Start()
    {
        // Create three spot lights to highlight the D, blue and black spots on a snooker table
        Vector3[] lightPositions =
        {
            new Vector3(0f, 5f, -3.5f), // D spot at baulk end
            new Vector3(0f, 5f, 0f),    // blue spot in the centre
            new Vector3(0f, 5f, 3.5f)   // black spot at top end
        };

        for (int i = 0; i < lightPositions.Length; i++)
        {
            GameObject lightObj = new GameObject("BilliardSpotLight_" + i);
            Light spotLight = lightObj.AddComponent<Light>();
            spotLight.type = LightType.Spot;
            spotLight.color = Color.white;
            spotLight.intensity = 2.5f;        // brightness
            spotLight.range = 15f;             // distance
            spotLight.spotAngle = 60f;         // cone size
            spotLight.shadows = LightShadows.Soft;

            lightObj.transform.position = lightPositions[i];
            lightObj.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
        }

        // Apply a shiny plastic (PBR) material to each ball while keeping its colour
        Shader standard = Shader.Find("Standard");
        GameObject[] balls = GameObject.FindGameObjectsWithTag("Ball");
        foreach (GameObject ball in balls)
        {
            Renderer renderer = ball.GetComponent<Renderer>();
            if (renderer != null)
            {
                Material source = renderer.material;
                Material mat = new Material(standard);
                mat.color = source.color * 1.5f;        // brighter base colour
                mat.SetFloat("_Metallic", 0f);
                mat.SetFloat("_Glossiness", 0.5f);     // wider specular highlight
                mat.SetColor("_SpecColor", Color.white * 1.4f);
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", source.color * 0.25f);
                renderer.material = mat;
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

        // Enhance felt detail so the green cloth stands out
        EnhanceClothTexture();
    }

    void CreateHighlightLight(Transform parent, Vector3 localPosition)
    {
        GameObject lightObj = new GameObject("HighlightLight");
        lightObj.transform.parent = parent;
        lightObj.transform.localPosition = localPosition;

        Light pointLight = lightObj.AddComponent<Light>();
        pointLight.type = LightType.Point;
        pointLight.range = 2.5f;  // allow larger reflection area
        pointLight.intensity = 3f; // stronger highlight
        pointLight.shadows = LightShadows.None;
        pointLight.color = Color.white;
        pointLight.renderMode = LightRenderMode.ForcePixel;
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
                mat.color = new Color(0f, 0.3f, 0f, 1f); // deep green cloth
                mat.SetFloat("_Metallic", 0f);
                mat.SetFloat("_Glossiness", 0.2f);

                Texture clothTex = Resources.Load<Texture>("Textures/green_cloth");
                if (clothTex != null)
                {
                    mat.mainTexture = clothTex;
                    mat.mainTextureScale *= 1.2f;
                }

                Texture bump = Resources.Load<Texture>("Textures/green_cloth_normal");
                if (bump != null && mat.HasProperty("_BumpMap"))
                {
                    mat.SetTexture("_BumpMap", bump);
                    float scale = mat.HasProperty("_BumpScale") ? mat.GetFloat("_BumpScale") : 1f;
                    mat.SetFloat("_BumpScale", scale * 1.2f);
                }
            }
        }
    }
}
#endif
