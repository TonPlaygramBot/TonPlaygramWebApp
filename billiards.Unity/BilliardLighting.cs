#if UNITY_5_3_OR_NEWER
using UnityEngine;

public class BilliardLighting : MonoBehaviour
{
    void Start()
    {
        // Ensure normal game speed in case other scripts altered it
        Time.timeScale = 1f;

        // Create Spot Light
        GameObject lightObj = new GameObject("BilliardSpotLight");
        Light spotLight = lightObj.AddComponent<Light>();
        spotLight.type = LightType.Spot;
        spotLight.color = Color.white;
        spotLight.intensity = 2.5f;
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
        plasticMat.SetFloat("_Glossiness", 0.9f); // very shiny surface

        // Create low-friction physics material for natural rolling
        PhysicMaterial physicsMat = new PhysicMaterial();
        physicsMat.dynamicFriction = 0f;
        physicsMat.staticFriction = 0f;
        physicsMat.bounciness = 0.9f;
        physicsMat.frictionCombine = PhysicMaterialCombine.Minimum;
        physicsMat.bounceCombine = PhysicMaterialCombine.Maximum;

        // Apply materials to all objects tagged "Ball"
        GameObject[] balls = GameObject.FindGameObjectsWithTag("Ball");
        foreach (GameObject ball in balls)
        {
            Renderer renderer = ball.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material = plasticMat;
            }

            // Assign low-friction physics material and reduce drag
            Collider col = ball.GetComponent<Collider>();
            if (col != null)
            {
                col.material = physicsMat;
            }

            Rigidbody rb = ball.GetComponent<Rigidbody>();
            if (rb != null)
            {
                rb.drag = 0f;
                rb.angularDrag = 0.05f;
            }
        }
    }
}
#endif
