using Aiming;
using UnityEngine;

namespace Gameplay.PoolRoyale
{
    [DisallowMultipleComponent]
    public class PoolHumanCharacterRigAligner : MonoBehaviour
    {
        [System.Serializable]
        public struct CharacterSlot
        {
            public PoolHumanCharacterId id;
            public GameObject characterRoot;
            public Transform rightGrip;
            public Transform chest;
            public Transform head;
        }

        [Header("Murlan Royal character slots")]
        [Tooltip("Assign the five human character prefabs/instances copied from Murlan Royal here.")]
        [SerializeField] private CharacterSlot[] characters = new CharacterSlot[5];
        [SerializeField] private PoolHumanCharacterId activeCharacter = PoolHumanCharacterId.MurlanRoyalPro;

        [Header("Pool-player stance")]
        [SerializeField] private Transform cueRoot;
        [SerializeField] private Transform cueBall;
        [SerializeField] private float stanceBackDistance = 0.62f;
        [SerializeField] private float stanceSideOffset = 0.08f;
        [SerializeField] private float stanceLerp = 16f;
        [SerializeField] private float cueHeightAboveBall = 0.035f;
        [SerializeField] private float upperBodyLeanDeg = 9f;
        [SerializeField] private float headDownDeg = 7f;

        CharacterSlot _activeSlot;
        Vector3 _lastAimDirection = Vector3.forward;

        public PoolHumanCharacterId ActiveCharacter => activeCharacter;

        void Awake()
        {
            SelectCharacter(activeCharacter);
        }

        public void SelectCharacter(PoolHumanCharacterId id)
        {
            activeCharacter = id;
            _activeSlot = default;

            for (int i = 0; i < characters.Length; i++)
            {
                bool isActive = characters[i].id == id;
                if (characters[i].characterRoot != null)
                {
                    characters[i].characterRoot.SetActive(isActive);
                }

                if (isActive)
                {
                    _activeSlot = characters[i];
                }
            }
        }

        public void AlignToShot(Vector3 cueBallPosition, Vector3 aimPoint, PoolHumanCharacterProfile profile)
        {
            Vector3 aim = aimPoint - cueBallPosition;
            aim.y = 0f;
            if (aim.sqrMagnitude <= 1e-8f)
            {
                aim = _lastAimDirection;
            }

            aim.Normalize();
            _lastAimDirection = aim;

            Transform root = _activeSlot.characterRoot != null ? _activeSlot.characterRoot.transform : transform;
            Vector3 side = Vector3.Cross(Vector3.up, aim).normalized;
            Vector3 targetPosition = cueBallPosition - aim * stanceBackDistance + side * stanceSideOffset;
            Quaternion targetRotation = Quaternion.LookRotation(aim, Vector3.up);
            float lerp = Application.isPlaying ? 1f - Mathf.Exp(-stanceLerp * Time.deltaTime) : 1f;

            root.position = Vector3.Lerp(root.position, targetPosition, lerp);
            root.rotation = Quaternion.Slerp(root.rotation, targetRotation, lerp);

            ApplyUpperBodyPose(targetRotation, profile);
            AlignCue(cueBallPosition, aim, targetRotation);
        }

        public void AlignToCurrentCue(AimSolution solution)
        {
            Vector3 sourceCueBall = cueBall != null ? cueBall.position : solution.aimStart;
            AlignToShot(sourceCueBall, solution.aimEnd, PoolHumanCharacterProfile.GetPreset(activeCharacter));
        }

        void ApplyUpperBodyPose(Quaternion baseRotation, PoolHumanCharacterProfile profile)
        {
            float settleLean = Mathf.Lerp(0.75f, 1.18f, profile.skill01);
            if (_activeSlot.chest != null)
            {
                _activeSlot.chest.rotation = baseRotation * Quaternion.Euler(upperBodyLeanDeg * settleLean, 0f, 0f);
            }

            if (_activeSlot.head != null)
            {
                _activeSlot.head.rotation = baseRotation * Quaternion.Euler(headDownDeg * settleLean, 0f, 0f);
            }
        }

        void AlignCue(Vector3 cueBallPosition, Vector3 aim, Quaternion targetRotation)
        {
            if (cueRoot == null)
                return;

            Vector3 cuePosition = cueBallPosition - aim * 0.28f + Vector3.up * cueHeightAboveBall;
            cueRoot.position = cuePosition;
            cueRoot.rotation = targetRotation;

            if (_activeSlot.rightGrip != null)
            {
                cueRoot.position += _activeSlot.rightGrip.position - cueRoot.position;
            }
        }
    }
}
