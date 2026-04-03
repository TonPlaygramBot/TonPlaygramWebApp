using System;
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

        public event Action<ReplayBroadcastPayload> ReplayBroadcastRequested;

        public bool TryBroadcastReplay(ReplayBroadcastPayload payload)
        {
            if (!forceLegacyReplayBroadcast || !payload.IsValid)
            {
                return false;
            }

            payload.BroadcastStartTime = Time.unscaledTime + replayStartLeadSeconds;
            ReplayBroadcastRequested?.Invoke(payload);
            return true;
        }

        public void SetLegacyReplayMode(bool enabled)
        {
            forceLegacyReplayBroadcast = enabled;
        }
    }

    [Serializable]
    public struct ReplayBroadcastPayload
    {
        public string shotId;
        public Vector3 cueBallPosition;
        public Vector3 cueDirection;
        public float powerNormalized;
        public float BroadcastStartTime { get; set; }

        public bool IsValid =>
            !string.IsNullOrWhiteSpace(shotId) &&
            cueDirection.sqrMagnitude > 0.0001f &&
            powerNormalized >= 0f;
    }
}
