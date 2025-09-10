#if UNITY_5_3_OR_NEWER
using UnityEngine;

public class BilliardLighting : MonoBehaviour
{
    void Start()
    {
        // Create Spot Light
        GameObject lightObj = new GameObject("BilliardSpotLight");
        Light spotLight = lightObj.AddComponent<Light>();
        spotLight.type = LightType.Spot;
        spotLight.color = Color.white;
        // Slightly brighter spotlight to better illuminate the table
        spotLight.intensity = 3.0f;
        spotLight.range = 15f;
        spotLight.spotAngle = 60f;
        spotLight.shadows = LightShadows.Soft;

        // Position the light above the table
        lightObj.transform.position = new Vector3(0, 5, 0);
        lightObj.transform.rotation = Quaternion.Euler(90, 0, 0);

        // Create a shiny plastic (PBR) material
        Material plasticMat = new Material(Shader.Find("Standard"));
        plasticMat.color = Color.red;           // change color per ball as needed
        plasticMat.SetFloat("_Metallic", 0f);   // not metallic
        // Increase glossiness so reflections on the balls appear a touch brighter
        plasticMat.SetFloat("_Glossiness", 0.95f); // very shiny surface

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
