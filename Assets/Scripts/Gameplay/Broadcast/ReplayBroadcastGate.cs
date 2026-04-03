using System;
using System.Collections;
using UnityEngine;

namespace Aiming.Gameplay.Broadcast
{
    /// <summary>
    /// Keeps replay broadcasting behavior locked to the legacy path so replay start
    /// is always emitted to the broadcast system before playback begins.
    /// </summary>
    public class ReplayBroadcastGate : MonoBehaviour
    {
        [Header("Legacy replay broadcast")]
        [SerializeField] private bool forceLegacyReplayBroadcast = true;
        [SerializeField, Min(0f)] private float replayStartLeadSeconds = 0.08f;
        [Header("Replay frame fallback")]
        [SerializeField] private GameObject replayFrameRoot;
        [SerializeField] private CanvasGroup replayFrameCanvasGroup;
        [SerializeField, Min(0.05f)] private float replayFrameVisibleSeconds = 1.4f;

        public event Action<ReplayBroadcastPayload> ReplayBroadcastRequested;
        private Coroutine replayFrameRoutine;

        public bool TryBroadcastReplay(ReplayBroadcastPayload payload)
        {
            if (!forceLegacyReplayBroadcast || !payload.IsValid)
            {
                return false;
            }

            if (!payload.HasCueTelemetry)
            {
                payload.cueDirection = Vector3.forward;
                payload.powerNormalized = Mathf.Max(0f, payload.powerNormalized);
            }

            payload.BroadcastStartTime = Time.unscaledTime + replayStartLeadSeconds;
            ReplayBroadcastRequested?.Invoke(payload);
            ShowReplayFrame();
            return true;
        }

        public void SetLegacyReplayMode(bool enabled)
        {
            forceLegacyReplayBroadcast = enabled;
        }

        private void ShowReplayFrame()
        {
            if (replayFrameRoot == null && replayFrameCanvasGroup == null)
            {
                return;
            }

            if (replayFrameRoot == null && replayFrameCanvasGroup != null)
            {
                replayFrameRoot = replayFrameCanvasGroup.gameObject;
            }

            if (replayFrameRoutine != null)
            {
                StopCoroutine(replayFrameRoutine);
            }

            replayFrameRoutine = StartCoroutine(ReplayFrameRoutine());
        }

        private IEnumerator ReplayFrameRoutine()
        {
            if (replayFrameRoot != null)
            {
                replayFrameRoot.SetActive(true);
            }

            if (replayFrameCanvasGroup != null)
            {
                replayFrameCanvasGroup.alpha = 1f;
                replayFrameCanvasGroup.interactable = false;
                replayFrameCanvasGroup.blocksRaycasts = false;
            }

            yield return new WaitForSecondsRealtime(replayFrameVisibleSeconds);

            if (replayFrameCanvasGroup != null)
            {
                replayFrameCanvasGroup.alpha = 0f;
            }

            if (replayFrameRoot != null)
            {
                replayFrameRoot.SetActive(false);
            }

            replayFrameRoutine = null;
        }
    }

    [Serializable]
    public struct ReplayBroadcastPayload
    {
        public string shotId;
        public Vector3 cueBallPosition;
        public Vector3 cueDirection;
        public float powerNormalized;
        public bool replayOnPottedBall;
        public bool replayOnFoul;
        public float BroadcastStartTime { get; set; }

        public bool IsValid =>
            replayOnPottedBall ||
            replayOnFoul ||
            (!string.IsNullOrWhiteSpace(shotId) && HasCueTelemetry);

        public bool HasCueTelemetry =>
            cueDirection.sqrMagnitude > 0.0001f &&
            powerNormalized >= 0f;
    }
}
