using TMPro;
using UnityEngine;

namespace Aiming.Gameplay.Bowling
{
    public class BowlingComplimentPopup : MonoBehaviour
    {
        [SerializeField] private TMP_Text complimentText;
        [SerializeField] private CanvasGroup canvasGroup;
        [SerializeField] private float visibleDuration = 1.8f;
        [SerializeField] private float fadeDuration = 0.35f;

        [TextArea] [SerializeField] private string[] strikeCompliments =
        {
            "Perfect strike!",
            "Legendary shot!",
            "Pin crusher!"
        };

        [TextArea] [SerializeField] private string[] strongShotCompliments =
        {
            "Great line!",
            "Nice control!",
            "Clean release!"
        };

        [TextArea] [SerializeField] private string[] recoveryCompliments =
        {
            "Good recovery!",
            "Keep it up!",
            "You got this!"
        };

        private float _timer;

        public void ShowForResult(int knockedPins)
        {
            string[] source = knockedPins >= 10
                ? strikeCompliments
                : knockedPins >= 7
                    ? strongShotCompliments
                    : recoveryCompliments;

            if (source == null || source.Length == 0 || complimentText == null)
            {
                return;
            }

            complimentText.text = source[Random.Range(0, source.Length)];
            _timer = visibleDuration + fadeDuration;
            if (canvasGroup != null) canvasGroup.alpha = 1f;
        }

        private void Update()
        {
            if (_timer <= 0f) return;
            _timer -= Time.deltaTime;
            if (canvasGroup == null) return;
            if (_timer > fadeDuration)
            {
                canvasGroup.alpha = 1f;
                return;
            }

            canvasGroup.alpha = Mathf.Clamp01(_timer / Mathf.Max(0.001f, fadeDuration));
        }
    }
}
