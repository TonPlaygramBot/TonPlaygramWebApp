using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Applies portrait-friendly UI offsets for the bowling HUD.
    /// </summary>
    public class BowlingHudLayoutTuner : MonoBehaviour
    {
        [SerializeField] private RectTransform menuIcon;
        [SerializeField] private float menuIconLowerPixels = 28f;
        [SerializeField] private bool applyOnEnable = true;

        private Vector2 _initialMenuAnchorPos;
        private bool _captured;

        private void OnEnable()
        {
            if (applyOnEnable)
            {
                Apply();
            }
        }

        [ContextMenu("Apply HUD Tune")]
        public void Apply()
        {
            if (menuIcon == null)
            {
                return;
            }

            if (!_captured)
            {
                _initialMenuAnchorPos = menuIcon.anchoredPosition;
                _captured = true;
            }

            // Lower on screen in portrait = reduced Y anchored position.
            menuIcon.anchoredPosition = _initialMenuAnchorPos + (Vector2.down * Mathf.Abs(menuIconLowerPixels));
        }

        [ContextMenu("Reset HUD Tune")]
        public void ResetLayout()
        {
            if (menuIcon == null || !_captured)
            {
                return;
            }

            menuIcon.anchoredPosition = _initialMenuAnchorPos;
        }
    }
}
