#if UNITY_5_3_OR_NEWER
using UnityEngine;

public class BilliardLighting : MonoBehaviour
{
    static Texture2D squareCookie;

    static Texture2D SquareCookie
    {
        get
        {
            if (squareCookie == null)
            {
                squareCookie = new Texture2D(2, 2, TextureFormat.RGBA32, false, true);
                Color32[] pixels =
                {
                    new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255),
                    new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255)
                };
                squareCookie.SetPixels32(pixels);
                squareCookie.wrapMode = TextureWrapMode.Clamp;
                squareCookie.filterMode = FilterMode.Bilinear;
                squareCookie.Apply();
            }

            return squareCookie;
        }
    }

    void Start()
    {
        // Create three spot lights to highlight the D, blue and black spots on the table
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
            spotLight.intensity = 2.25f;       // brightness reduced by 10%
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
            float ballRadius = 0.5f;
            if (renderer != null)
            {
                Material source = renderer.material;
                Material mat = new Material(standard);
                mat.color = source.color * 1.5f;             // brighter base colour
                mat.SetFloat("_Metallic", 0f);
                mat.SetFloat("_Glossiness", 0.9f);          // shinier surface
                mat.SetColor("_SpecColor", Color.white);    // clean specular highlight
                mat.EnableKeyword("_EMISSION");
                mat.SetColor("_EmissionColor", source.color * 0.25f);
                renderer.material = mat;

                ballRadius = renderer.bounds.extents.x;
            }

            // Add a small red aiming dot to the cue ball so it rolls with the surface
            if (ball.name.ToLower().Contains("cue"))
            {
                CreateCueBallDot(ball.transform);
            }

            // Position four lightweight square highlights in a straight line
            const int lightCount = 4;
            const float sizeMultiplier = 0.28f;    // slightly larger reflection footprint
            const float lightIntensity = 2.25f;    // keep total brightness close to previous setup
            float spacing = ballRadius * 0.4f;
            Vector3 basePos = new Vector3(-spacing * 1.5f, 0.8f, 0.6f);
            for (int i = 0; i < lightCount; i++)
            {
                Vector3 pos = basePos + new Vector3(spacing * i, 0f, 0f);
                CreateHighlightLight(ball.transform, pos, sizeMultiplier, lightIntensity);
            }
        }

        // Enhance felt detail so the green cloth stands out
        EnhanceClothTexture();
    }

    void CreateHighlightLight(Transform parent, Vector3 localPosition, float sizeMultiplier, float intensity)
    {
        GameObject lightObj = new GameObject("HighlightLight");
        lightObj.transform.parent = parent;
        lightObj.transform.localPosition = localPosition;
        lightObj.transform.LookAt(parent); // aim the spot at the ball centre

        Light spotLight = lightObj.AddComponent<Light>();
        spotLight.type = LightType.Spot;
        spotLight.cookie = SquareCookie;            // crisp square reflection
        spotLight.cookieSize = 0.35f * sizeMultiplier;
        spotLight.range = 2.5f * sizeMultiplier;
        spotLight.intensity = intensity;
        spotLight.spotAngle = 10f * sizeMultiplier;
        spotLight.color = Color.white;
        spotLight.shadows = LightShadows.None;
        spotLight.renderMode = LightRenderMode.Auto; // lightweight rendering
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
