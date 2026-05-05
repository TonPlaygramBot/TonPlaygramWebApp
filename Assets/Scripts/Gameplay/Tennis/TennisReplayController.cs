using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace TonPlaygram.Gameplay.Tennis
{
    /// <summary>
    /// Lightweight TV-style replay recorder for tennis rallies.
    /// Records runtime transforms and can replay for fouls/decisive points.
    /// </summary>
    [DisallowMultipleComponent]
    public class TennisReplayController : MonoBehaviour
    {
        [Header("Replay Targets")]
        [SerializeField] private Transform playerRoot;
        [SerializeField] private Transform opponentRoot;
        [SerializeField] private Transform ballRoot;
        [SerializeField] private Transform netRoot;

        [Header("Capture")]
        [SerializeField, Min(2)] private int maxFrames = 420;
        [SerializeField, Min(0.01f)] private float sampleIntervalSeconds = 1f / 30f;

        [Header("Playback")]
        [SerializeField, Min(0.25f)] private float playbackSpeed = 0.65f;
        [SerializeField] private GameObject replayMenuSkipButton;
        [SerializeField] private Button replayOverlaySkipButton;
        [SerializeField] private KeyCode keyboardSkipKey = KeyCode.Space;

        private readonly List<ReplayFrame> _frames = new();
        private float _captureTimer;
        private int _playbackIndex;
        private bool _isReplaying;
        private bool _skipRequested;

        private void Awake()
        {
            if (replayOverlaySkipButton != null)
            {
                replayOverlaySkipButton.onClick.AddListener(SkipReplay);
            }

            SetSkipUiVisible(false);
        }

        private void Update()
        {
            if (_isReplaying)
            {
                TickPlayback();
                return;
            }

            _captureTimer += Time.unscaledDeltaTime;
            if (_captureTimer < sampleIntervalSeconds) return;

            _captureTimer = 0f;
            CaptureCurrentFrame();
        }

        public void RequestReplayOnFoul() => TryStartReplay("FOUL");

        public void RequestReplayOnDecisivePoint() => TryStartReplay("DECISIVE POINT");

        public void SkipReplay()
        {
            if (!_isReplaying) return;
            _skipRequested = true;
        }

        private void TryStartReplay(string reason)
        {
            if (_frames.Count < 2 || _isReplaying) return;

            _isReplaying = true;
            _skipRequested = false;
            _playbackIndex = 0;
            SetSkipUiVisible(true);
            Debug.Log($"[TennisReplayController] Replay started: {reason}");
        }

        private void TickPlayback()
        {
            if (_skipRequested)
            {
                StopReplay();
                return;
            }

            if (Input.GetKeyDown(keyboardSkipKey))
            {
                StopReplay();
                return;
            }

            _playbackIndex += Mathf.Max(1, Mathf.RoundToInt(playbackSpeed));
            if (_playbackIndex >= _frames.Count)
            {
                StopReplay();
                return;
            }

            ApplyFrame(_frames[_playbackIndex]);
        }

        private void StopReplay()
        {
            _isReplaying = false;
            _skipRequested = false;
            SetSkipUiVisible(false);
        }

        private void SetSkipUiVisible(bool visible)
        {
            if (replayMenuSkipButton != null) replayMenuSkipButton.SetActive(visible);
            if (replayOverlaySkipButton != null) replayOverlaySkipButton.gameObject.SetActive(visible);
        }

        private void CaptureCurrentFrame()
        {
            _frames.Add(new ReplayFrame
            {
                player = Snapshot.Of(playerRoot),
                opponent = Snapshot.Of(opponentRoot),
                ball = Snapshot.Of(ballRoot),
                net = Snapshot.Of(netRoot)
            });

            if (_frames.Count > maxFrames)
            {
                _frames.RemoveAt(0);
            }
        }

        private void ApplyFrame(ReplayFrame frame)
        {
            frame.player.Apply(playerRoot);
            frame.opponent.Apply(opponentRoot);
            frame.ball.Apply(ballRoot);
            frame.net.Apply(netRoot);
        }

        [Serializable]
        private struct ReplayFrame
        {
            public Snapshot player;
            public Snapshot opponent;
            public Snapshot ball;
            public Snapshot net;
        }

        [Serializable]
        private struct Snapshot
        {
            public Vector3 position;
            public Quaternion rotation;

            public static Snapshot Of(Transform t)
            {
                if (t == null) return default;
                return new Snapshot { position = t.position, rotation = t.rotation };
            }

            public void Apply(Transform t)
            {
                if (t == null) return;
                t.position = position;
                t.rotation = rotation;
            }
        }
    }
}
