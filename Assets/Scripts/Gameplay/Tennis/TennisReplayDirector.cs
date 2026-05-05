using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using Aiming.Gameplay.Broadcast;

namespace TonPlaygram.Gameplay.Tennis
{
    /// <summary>
    /// Lightweight TV-style replay trigger for decisive points/fouls with global skip controls.
    /// Hook this from gameplay events: OnDecisivePoint / OnFoul.
    /// </summary>
    [DisallowMultipleComponent]
    public class TennisReplayDirector : MonoBehaviour
    {
        [Header("Replay Dependencies")]
        [SerializeField] private ReplayBroadcastGate replayGate;

        [Header("Replay Timing")]
        [SerializeField, Min(0.2f)] private float replayDurationSeconds = 3f;
        [SerializeField] private bool pauseGameplayDuringReplay = true;

        [Header("Skip Controls")]
        [SerializeField] private Button menuSkipReplayButton;
        [SerializeField] private Button replaySkipIconButton;
        [SerializeField] private CanvasGroup replayOverlay;

        private Coroutine replayRoutine;
        private bool isReplayActive;
        private float previousTimeScale = 1f;

        public bool IsReplayActive => isReplayActive;

        private void Awake()
        {
            if (menuSkipReplayButton != null)
                menuSkipReplayButton.onClick.AddListener(SkipReplay);
            if (replaySkipIconButton != null)
                replaySkipIconButton.onClick.AddListener(SkipReplay);

            SetReplayOverlayVisible(false);
        }

        private void OnDestroy()
        {
            if (menuSkipReplayButton != null)
                menuSkipReplayButton.onClick.RemoveListener(SkipReplay);
            if (replaySkipIconButton != null)
                replaySkipIconButton.onClick.RemoveListener(SkipReplay);
        }

        public void OnDecisivePoint(string pointId, Vector3 ballPosition, Vector3 shotDirection, float powerNormalized)
        {
            RequestReplay(pointId, ballPosition, shotDirection, powerNormalized, replayOnPoint: true, replayOnFoul: false);
        }

        public void OnFoul(string foulId, Vector3 ballPosition, Vector3 shotDirection, float powerNormalized)
        {
            RequestReplay(foulId, ballPosition, shotDirection, powerNormalized, replayOnPoint: false, replayOnFoul: true);
        }

        public void SkipReplay()
        {
            if (!isReplayActive) return;
            EndReplay();
        }

        private void RequestReplay(string shotId, Vector3 ballPosition, Vector3 shotDirection, float powerNormalized, bool replayOnPoint, bool replayOnFoul)
        {
            if (replayGate == null) return;

            var payload = new ReplayBroadcastPayload
            {
                shotId = shotId,
                cueBallPosition = ballPosition,
                cueDirection = shotDirection,
                powerNormalized = Mathf.Clamp01(powerNormalized),
                replayOnPottedBall = replayOnPoint,
                replayOnFoul = replayOnFoul
            };

            if (!replayGate.TryBroadcastReplay(payload)) return;

            if (replayRoutine != null)
                StopCoroutine(replayRoutine);

            replayRoutine = StartCoroutine(ReplayRoutine());
        }

        private IEnumerator ReplayRoutine()
        {
            isReplayActive = true;
            SetReplayOverlayVisible(true);

            if (pauseGameplayDuringReplay)
            {
                previousTimeScale = Time.timeScale;
                Time.timeScale = 0f;
            }

            yield return new WaitForSecondsRealtime(replayDurationSeconds);

            EndReplay();
        }

        private void EndReplay()
        {
            if (replayRoutine != null)
            {
                StopCoroutine(replayRoutine);
                replayRoutine = null;
            }

            if (pauseGameplayDuringReplay)
                Time.timeScale = previousTimeScale;

            isReplayActive = false;
            SetReplayOverlayVisible(false);
        }

        private void SetReplayOverlayVisible(bool visible)
        {
            if (replayOverlay == null) return;
            replayOverlay.alpha = visible ? 1f : 0f;
            replayOverlay.interactable = visible;
            replayOverlay.blocksRaycasts = visible;
        }
    }
}
