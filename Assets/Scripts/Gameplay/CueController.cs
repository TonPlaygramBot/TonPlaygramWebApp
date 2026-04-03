using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Aiming
{
    public class CueController : MonoBehaviour
    {
        public enum ShooterKind
        {
            Unknown,
            User,
            AI,
            Replay
        }

        public enum CueMotionPhase
        {
            Pull,
            ForwardStrike,
            HoldAtContact,
            RecoverToPull,
            ResetToIdle
        }

        public readonly struct CueMotionFrame
        {
            public readonly CueMotionPhase Phase;
            public readonly float CueDepth;
            public readonly float TimeSinceShotStart;
            public readonly float ShotPower;
            public readonly ShooterKind Shooter;

            public CueMotionFrame(CueMotionPhase phase, float cueDepth, float timeSinceShotStart, float shotPower, ShooterKind shooter)
            {
                Phase = phase;
                CueDepth = cueDepth;
                TimeSinceShotStart = timeSinceShotStart;
                ShotPower = shotPower;
                Shooter = shooter;
            }
        }

        public readonly struct CueCameraFocusWindow
        {
            public readonly ShooterKind Shooter;
            public readonly float HoldDuration;
            public readonly float ShotPower;

            public CueCameraFocusWindow(ShooterKind shooter, float holdDuration, float shotPower)
            {
                Shooter = shooter;
                HoldDuration = holdDuration;
                ShotPower = shotPower;
            }
        }

        enum ShotState
        {
            Idle,
            Dragging,
            Striking
        }

        public AdaptiveAimingEngine aiming;
        public Transform cueTip;
        public Transform cueBall, objectBall, pocket;
        public Rigidbody cueBallBody;
        public Bounds tableBounds;
        public float ballRadius = 0.028575f;

        [Header("Cue placement")]
        public float idleTipGap = 0.010f;
        public float contactTipGap = 0.001f;
        public float baseCueOffset = 0.12f;
        public float pullRange = 0.34f;

        [Header("Aiming feel")]
        [Range(1f, 30f)] public float rotationDamping = 14f;
        public bool allowAimAdjustWhileCharging = false;

        [Header("Strike feel")]
        public float strikeDuration = 0.12f;
        public float strikeHoldDuration = 0.05f;
        public float baseStrikeImpulse = 1.8f;
        public float maxStrikeImpulse = 6.5f;
        [Tooltip("Normalized strike progress where the hit is fired once.")]
        [Range(0.75f, 0.99f)] public float hitProgress = 0.9f;
        [Tooltip("How much of the strike stays for the final idle->contact micro drive.")]
        [Range(0.02f, 0.25f)] public float contactDrivePortion = 0.1f;
        [Tooltip("Minimum pull used for strike animation so the cue visibly drives forward every shot.")]
        [Min(0f)] public float minimumVisualPull = 0.025f;
        [Tooltip("How long to animate from contact back to the same pulled position.")]
        [Min(0.01f)] public float recoverToPullDuration = 0.06f;
        [Tooltip("How long to animate from pulled position back to idle after camera switches away.")]
        [Min(0f)] public float resetToIdleDuration = 0.08f;
        [Tooltip("Extra cue camera hold time after the cue has recovered to pulled position.")]
        [Min(0f)] public float cueCameraExtraHold = 0.04f;

        [Header("Spin input")]
        [Tooltip("Receives normalized spin values from the existing on-screen spin controller.")]
        public Vector2 spinInput;
        public CueStrikePhysics strikePhysics = new CueStrikePhysics();

        public event Action<CueMotionFrame> CueMotionSampled;
        public event Action<CueCameraFocusWindow> CueCameraFocusRequested;

        Vector3 _aimDirection = Vector3.forward;
        Vector3 _targetDirection = Vector3.forward;
        Vector3 _cueAnchorPosition;
        float _currentCueDepth;
        float _power;
        float _latchedShotPower;
        ShotState _shotState = ShotState.Idle;
        ShooterKind _pendingShooter = ShooterKind.User;
        ShooterKind _activeShooter = ShooterKind.Unknown;
        float _shotStartTime;
        readonly List<CueMotionFrame> _lastShotFrames = new List<CueMotionFrame>(64);

        void Update()
        {
            if (aiming == null || cueBall == null || objectBall == null || pocket == null)
            {
                return;
            }

            if (_shotState == ShotState.Striking)
            {
                return;
            }

            bool ballsMoving = AreBallsMoving();
            if (ballsMoving && _shotState == ShotState.Idle)
            {
                gameObject.SetActive(false);
                return;
            }

            gameObject.SetActive(true);
            if (_shotState == ShotState.Idle)
            {
                _cueAnchorPosition = cueBall.position;
            }

            UpdateAimDirection();
            UpdateCueDepth();
            UpdateCuePose();
        }

        public void SetChargePower(float normalizedPower)
        {
            _power = Mathf.Clamp01(normalizedPower);

            if (_shotState == ShotState.Dragging)
            {
                float pull = pullRange * EaseOutCubic(_power);
                _currentCueDepth = idleTipGap + pull;
                UpdateCuePose();
                SampleCueMotion(CueMotionPhase.Pull, _pendingShooter, _power);
            }
        }

        public void BeginCharge()
        {
            BeginCharge(ShooterKind.User);
        }

        public void BeginCharge(ShooterKind shooter)
        {
            if (_shotState == ShotState.Striking)
            {
                return;
            }

            _pendingShooter = shooter;
            _cueAnchorPosition = cueBall.position;
            _shotState = ShotState.Dragging;
            _power = Mathf.Max(_power, RecoverPowerFromCueDepth(_currentCueDepth));
            _latchedShotPower = 0f;
            _currentCueDepth = idleTipGap + (pullRange * EaseOutCubic(_power));
            gameObject.SetActive(true);
            UpdateCuePose();
            SampleCueMotion(CueMotionPhase.Pull, _pendingShooter, _power);
        }

        public void SetSpinInput(Vector2 normalizedSpin)
        {
            spinInput = Vector2.ClampMagnitude(normalizedSpin, 1f);
        }

        public void CancelCharge()
        {
            if (_shotState == ShotState.Striking)
            {
                return;
            }

            _shotState = ShotState.Idle;
            _power = 0f;
            _latchedShotPower = 0f;
            _currentCueDepth = idleTipGap;
            UpdateCuePose();
        }

        public void TriggerAIStrike(float normalizedPower, Vector2 normalizedSpin)
        {
            if (_shotState == ShotState.Striking)
            {
                return;
            }

            SetSpinInput(normalizedSpin);
            _power = Mathf.Clamp01(normalizedPower);
            BeginCharge(ShooterKind.AI);
            ReleaseAndStrike();
        }

        public IReadOnlyList<CueMotionFrame> GetLastShotFrames()
        {
            return _lastShotFrames;
        }

        public void ReleaseAndStrike()
        {
            if (_shotState != ShotState.Dragging)
            {
                return;
            }

            float recoveredPower = RecoverPowerFromCueDepth(_currentCueDepth);
            _latchedShotPower = Mathf.Clamp01(Mathf.Max(_power, recoveredPower));
            if (_latchedShotPower <= 0.02f)
            {
                _shotState = ShotState.Idle;
                _currentCueDepth = idleTipGap;
                UpdateCuePose();
                return;
            }

            StartCoroutine(StrikeRoutine(_latchedShotPower));
        }

        void UpdateAimDirection()
        {
            var sol = BuildAimSolution();
            if (sol.isValid)
            {
                Vector3 desiredDirection = (sol.aimEnd - sol.aimStart);
                if (desiredDirection.sqrMagnitude > 1e-6f)
                {
                    desiredDirection.Normalize();
                    bool canAdjustAim = _shotState != ShotState.Dragging || allowAimAdjustWhileCharging;
                    if (canAdjustAim)
                    {
                        _targetDirection = desiredDirection;
                    }
                }
            }

            float rotationLerp = 1f - Mathf.Exp(-rotationDamping * Time.deltaTime);
            _aimDirection = Vector3.Slerp(_aimDirection, _targetDirection, rotationLerp).normalized;
            if (_aimDirection.sqrMagnitude < 1e-6f)
            {
                _aimDirection = _targetDirection;
            }
        }

        void UpdateCueDepth()
        {
            if (_shotState == ShotState.Dragging)
            {
                float pull = pullRange * EaseOutCubic(_power);
                _currentCueDepth = idleTipGap + pull;
                return;
            }

            _currentCueDepth = idleTipGap;
        }

        void UpdateCuePose()
        {
            Vector3 anchor = _cueAnchorPosition;
            float cueDistance = baseCueOffset + _currentCueDepth;
            transform.position = anchor - _aimDirection * cueDistance;
            transform.rotation = Quaternion.LookRotation(_aimDirection, Vector3.up);

            if (cueTip != null)
            {
                cueTip.position = anchor - _aimDirection * _currentCueDepth;
            }
        }

        ShotSolution BuildAimSolution()
        {
            ShotContext ctx = new ShotContext
            {
                cueBallPos = cueBall.position,
                objectBallPos = objectBall.position,
                pocketPos = pocket.position,
                ballRadius = ballRadius,
                tableBounds = tableBounds,
                requiresPower = false,
                highSpin = spinInput.sqrMagnitude > 0.0001f,
                collisionMask = aiming.config ? aiming.config.collisionMask : default
            };
            return aiming.GetAimSolution(ctx);
        }

        bool AreBallsMoving()
        {
            return cueBallBody != null && cueBallBody.velocity.sqrMagnitude > 0.0004f;
        }

        IEnumerator StrikeRoutine(float shotPower)
        {
            _shotState = ShotState.Striking;
            _activeShooter = _pendingShooter;
            _shotStartTime = Time.time;
            _lastShotFrames.Clear();

            Vector3 strikeDirection = _aimDirection;
            float pull = pullRange * EaseOutCubic(shotPower);
            float visualPull = Mathf.Max(pull, minimumVisualPull);
            float startDepth = idleTipGap + visualPull;
            float hitDepth = idleTipGap;
            float contactDepth = contactTipGap;
            float elapsed = 0f;
            bool didStrike = false;
            float contactStartT = Mathf.Clamp01(1f - contactDrivePortion);
            float hitT = Mathf.Clamp01(Mathf.Max(hitProgress, contactStartT));
            float cameraHoldDuration = strikeDuration + strikeHoldDuration + recoverToPullDuration + cueCameraExtraHold;
            CueCameraFocusRequested?.Invoke(new CueCameraFocusWindow(_activeShooter, cameraHoldDuration, shotPower));
            _currentCueDepth = startDepth;
            UpdateCuePose();
            SampleCueMotion(CueMotionPhase.Pull, _activeShooter, shotPower);

            while (elapsed < strikeDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / Mathf.Max(strikeDuration, 0.001f));
                float cueDepth;
                if (t < contactStartT)
                {
                    float phaseT = contactStartT > 0f ? t / contactStartT : 1f;
                    cueDepth = Mathf.Lerp(startDepth, hitDepth, EaseOutCubic(phaseT));
                }
                else
                {
                    float phaseT = contactStartT < 1f ? (t - contactStartT) / (1f - contactStartT) : 1f;
                    cueDepth = Mathf.Lerp(hitDepth, contactDepth, EaseOutCubic(phaseT));
                }

                _currentCueDepth = cueDepth;
                UpdateCuePose();
                SampleCueMotion(CueMotionPhase.ForwardStrike, _activeShooter, shotPower);

                if (!didStrike && t >= hitT)
                {
                    didStrike = true;
                    ApplyStrikeImpulse(strikeDirection, shotPower);
                }

                yield return null;
            }

            if (!didStrike)
            {
                ApplyStrikeImpulse(strikeDirection, shotPower);
            }

            _currentCueDepth = contactDepth;
            UpdateCuePose();
            SampleCueMotion(CueMotionPhase.HoldAtContact, _activeShooter, shotPower);
            yield return new WaitForSeconds(strikeHoldDuration);

            float recoverElapsed = 0f;
            while (recoverElapsed < recoverToPullDuration)
            {
                recoverElapsed += Time.deltaTime;
                float t = Mathf.Clamp01(recoverElapsed / Mathf.Max(recoverToPullDuration, 0.001f));
                _currentCueDepth = Mathf.Lerp(contactDepth, startDepth, EaseOutCubic(t));
                UpdateCuePose();
                SampleCueMotion(CueMotionPhase.RecoverToPull, _activeShooter, shotPower);
                yield return null;
            }

            _currentCueDepth = startDepth;
            UpdateCuePose();
            SampleCueMotion(CueMotionPhase.RecoverToPull, _activeShooter, shotPower);

            float resetElapsed = 0f;
            while (resetElapsed < resetToIdleDuration)
            {
                resetElapsed += Time.deltaTime;
                float t = Mathf.Clamp01(resetElapsed / Mathf.Max(resetToIdleDuration, 0.001f));
                _currentCueDepth = Mathf.Lerp(startDepth, idleTipGap, EaseOutCubic(t));
                UpdateCuePose();
                SampleCueMotion(CueMotionPhase.ResetToIdle, _activeShooter, shotPower);
                yield return null;
            }

            _currentCueDepth = idleTipGap;
            _power = 0f;
            _latchedShotPower = 0f;
            _shotState = ShotState.Idle;
            UpdateCuePose();
            SampleCueMotion(CueMotionPhase.ResetToIdle, _activeShooter, shotPower);
            _activeShooter = ShooterKind.Unknown;
            _pendingShooter = ShooterKind.User;
            _shotStartTime = 0f;
        }

        void ApplyStrikeImpulse(Vector3 strikeDirection, float shotPower)
        {
            if (cueBallBody == null)
            {
                return;
            }

            float impulseMagnitude = Mathf.Lerp(baseStrikeImpulse, maxStrikeImpulse, Mathf.Clamp01(shotPower));
            strikePhysics.Apply(cueBallBody, strikeDirection, impulseMagnitude, spinInput, ballRadius);
        }

        static float EaseOutCubic(float t)
        {
            t = Mathf.Clamp01(t);
            float inv = 1f - t;
            return 1f - (inv * inv * inv);
        }

        float RecoverPowerFromCueDepth(float cueDepth)
        {
            float pulledDistance = Mathf.Max(0f, cueDepth - idleTipGap);
            if (pullRange <= 0.0001f)
            {
                return 0f;
            }

            float easedPull = Mathf.Clamp01(pulledDistance / pullRange);
            return InverseEaseOutCubic(easedPull);
        }

        static float InverseEaseOutCubic(float easedValue)
        {
            easedValue = Mathf.Clamp01(easedValue);
            float inv = 1f - easedValue;
            return 1f - Mathf.Pow(inv, 1f / 3f);
        }

        void SampleCueMotion(CueMotionPhase phase, ShooterKind shooter, float shotPower)
        {
            float timeSinceShotStart = _shotStartTime > 0f ? Mathf.Max(0f, Time.time - _shotStartTime) : 0f;
            var frame = new CueMotionFrame(phase, _currentCueDepth, timeSinceShotStart, Mathf.Clamp01(shotPower), shooter);
            _lastShotFrames.Add(frame);
            CueMotionSampled?.Invoke(frame);
        }
    }
}
