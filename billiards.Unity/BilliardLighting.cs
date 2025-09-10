#if UNITY_5_3_OR_NEWER
using UnityEngine;

public class BilliardLighting : MonoBehaviour
{
    void Start()
    {
        // Create three spot lights in an arc so the balls show three tiny
        // reflections. Each light is offset slightly to leave a small gap
        // between highlights and is made a touch brighter than before.
        Vector3[] lightPositions =
        {
            new Vector3(-0.5f, 5f, 0f),
            new Vector3(0f, 5f, 0f),
            new Vector3(0.5f, 5f, 0f)
        };

        foreach (Vector3 pos in lightPositions)
        {
            GameObject lightObj = new GameObject("BilliardSpotLight");
            Light spotLight = lightObj.AddComponent<Light>();
            spotLight.type = LightType.Spot;
            spotLight.color = Color.white;
            // Slightly brighter spotlight to better illuminate the table
            spotLight.intensity = 3.2f;
            spotLight.range = 15f;
            spotLight.spotAngle = 60f;
            spotLight.shadows = LightShadows.Soft;

            // Position the light above the table with a small horizontal offset
            lightObj.transform.position = pos;
            lightObj.transform.rotation = Quaternion.Euler(90, 0, 0);
        }

        // Create a shiny plastic (PBR) material
        Material plasticMat = new Material(Shader.Find("Standard"));
        plasticMat.color = Color.red;           // change color per ball as needed
        plasticMat.SetFloat("_Metallic", 0f);   // not metallic
        // Increase glossiness so reflections on the balls appear brighter
        plasticMat.SetFloat("_Glossiness", 1f); // extremely shiny surface

        // Apply material to all objects tagged "Ball"
        GameObject[] balls = GameObject.FindGameObjectsWithTag("Ball");
        foreach (GameObject ball in balls)
        {
            Renderer renderer = ball.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material = plasticMat;
            }
        }
    }
}
#endif
