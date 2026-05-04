using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace Aiming.Gameplay.Bowling
{
    /// <summary>
    /// Handles pin state detection, fallen-pin cleanup, and rack reset.
    /// </summary>
    public class BowlingPinDeckSystem : MonoBehaviour
    {
        [System.Serializable]
        public class IntEvent : UnityEvent<int> { }

        [SerializeField] private Rigidbody[] pins;
        [SerializeField] private Transform[] pinSpawnPoints;
        [SerializeField] private float fallenTiltDegrees = 25f;
        [SerializeField] private float fallenHeightThreshold = 0.06f;

        public IntEvent onPinsScored;

        private readonly HashSet<int> _clearedPinIndices = new HashSet<int>();

        public int CountStandingPins()
        {
            int standing = 0;
            for (int i = 0; i < pins.Length; i++)
            {
                Rigidbody pin = pins[i];
                if (pin == null || !pin.gameObject.activeSelf)
                {
                    continue;
                }

                if (!IsFallen(pin.transform))
                {
                    standing++;
                }
            }

            return standing;
        }

        public int SweepAndScoreFallenPins()
        {
            int fallenThisSweep = 0;
            for (int i = 0; i < pins.Length; i++)
            {
                Rigidbody pin = pins[i];
                if (pin == null || !pin.gameObject.activeSelf || _clearedPinIndices.Contains(i))
                {
                    continue;
                }

                if (!IsFallen(pin.transform))
                {
                    continue;
                }

                fallenThisSweep++;
                _clearedPinIndices.Add(i);
                pin.gameObject.SetActive(false);
            }

            if (fallenThisSweep > 0)
            {
                onPinsScored?.Invoke(fallenThisSweep);
            }

            return fallenThisSweep;
        }

        public void ResetRack()
        {
            _clearedPinIndices.Clear();

            int max = Mathf.Min(pins.Length, pinSpawnPoints.Length);
            for (int i = 0; i < max; i++)
            {
                Rigidbody pin = pins[i];
                Transform spawn = pinSpawnPoints[i];
                if (pin == null || spawn == null)
                {
                    continue;
                }

                pin.gameObject.SetActive(true);
                pin.velocity = Vector3.zero;
                pin.angularVelocity = Vector3.zero;
                pin.position = spawn.position;
                pin.rotation = spawn.rotation;
            }
        }

        private bool IsFallen(Transform pin)
        {
            float tilt = Vector3.Angle(pin.up, Vector3.up);
            bool tooTilted = tilt >= fallenTiltDegrees;
            bool tooLow = pin.position.y <= fallenHeightThreshold;
            return tooTilted || tooLow;
        }
    }
}
