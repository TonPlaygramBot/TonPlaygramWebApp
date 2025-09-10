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
        plasticMat.color *= 1.1f;
        plasticMat.SetFloat("_Glossiness", 0.9f);
        plasticMat.SetColor("_SpecColor", Color.white * 1.3f);

        // Apply material and attach three small point lights to each ball
        GameObject[] balls = GameObject.FindGameObjectsWithTag("Ball");
        foreach (GameObject ball in balls)
        {
            Renderer renderer = ball.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material = plasticMat;
            }

            // Position three point lights in an arc so reflections don't touch
            CreateHighlightLight(ball.transform, new Vector3(0.5f, 0.8f, 0.6f));
            CreateHighlightLight(ball.transform, new Vector3(-0.6f, 0.7f, -0.5f));
            CreateHighlightLight(ball.transform, new Vector3(0.2f, 0.9f, -0.6f));
        }
    }

    void CreateHighlightLight(Transform parent, Vector3 localPosition)
    {
        GameObject lightObj = new GameObject("HighlightLight");
        lightObj.transform.parent = parent;
        lightObj.transform.localPosition = localPosition;

        Light pointLight = lightObj.AddComponent<Light>();
        pointLight.type = LightType.Point;
        pointLight.range = 0.5f;   // keep small so highlights don't overlap
        pointLight.intensity = 2f;
        pointLight.shadows = LightShadows.None;
        pointLight.color = Color.white;
    }
}
#endif
