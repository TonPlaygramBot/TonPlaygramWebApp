using UnityEditor;
using UnityEngine;

namespace Aiming.EditorTools
{
    public static class AimingConfigCreator
    {
        [MenuItem("Aiming/Create Default Config")]
        public static void CreateAsset()
        {
            var asset = ScriptableObject.CreateInstance<Aiming.AimingConfig>();
            AssetDatabase.CreateAsset(asset, "Assets/Resources/AimingConfig.asset");
            AssetDatabase.SaveAssets();
            EditorUtility.FocusProjectWindow();
            Selection.activeObject = asset;
        }
    }
}
