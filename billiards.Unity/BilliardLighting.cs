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

        // Apply material and attach small point lights to each ball
        GameObject[] balls = GameObject.FindGameObjectsWithTag("Ball");
        foreach (GameObject ball in balls)
        {
            Renderer renderer = ball.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material = plasticMat;
            }

            // Position point lights in an arc so reflections don't touch
            int lightCount = 3;
            Vector3 basePos = new Vector3(0.5f, 0.8f, 0.6f);
            for (int i = 0; i < lightCount; i++)
            {
                float angle = (i - (lightCount - 1) / 2f) * 30f;
                Vector3 pos = Quaternion.Euler(0f, 0f, angle) * basePos;
                CreateHighlightLight(ball.transform, pos);
            }
        }
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
}
#endif
