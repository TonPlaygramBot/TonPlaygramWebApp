using System;
using System.Collections.Generic;
using UnityEngine;

namespace TonPlaygram.Gameplay.Weapons
{
    /// <summary>
    /// Retargets the original first-person weapon hand pose onto the visible human character hands.
    ///
    /// Setup notes:
    /// 1. Keep the original FPS weapon rig active so its authored gun/hand animation, recoil, and grip sockets still play.
    /// 2. Assign only the original FPS hand visual roots to originalFpsHandVisualRoots so their meshes are hidden.
    /// 3. Map every important original FPS hand bone/socket to the matching human hand bone in boneMappings.
    /// 4. Leave weaponRoot visible; this script aligns it to the chosen human grip while the hidden FPS hands drive pose fidelity.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class FpsGunHumanHandRetargeter : MonoBehaviour
    {
        [Serializable]
        public sealed class HandBoneMapping
        {
            [Tooltip("Animated source bone/socket from the original first-person gun hand rig.")]
            public Transform originalFpsBone;

            [Tooltip("Visible human-character hand/finger bone that must copy the source pose.")]
            public Transform humanBone;

            [Tooltip("Per-bone position correction in the source bone's local space. Keep zero after exact rig matching.")]
            public Vector3 localPositionOffset;

            [Tooltip("Per-bone rotation correction after copying the source world rotation. Use for rig-axis differences only.")]
            public Vector3 localEulerOffset;

            [Tooltip("Copy source world position. Disable only for twist/helper bones that should rotate in place.")]
            public bool copyPosition = true;

            [Tooltip("Copy source world rotation.")]
            public bool copyRotation = true;

            [Tooltip("Copy source lossy scale into the human bone. Off by default to avoid deforming character hands.")]
            public bool copyScale;

            private Quaternion _localRotationOffset;

            public void CacheOffsets()
            {
                _localRotationOffset = Quaternion.Euler(localEulerOffset);
            }

            public void Apply()
            {
                if (originalFpsBone == null || humanBone == null)
                    return;

                if (copyPosition)
                {
                    humanBone.position = originalFpsBone.TransformPoint(localPositionOffset);
                }

                if (copyRotation)
                {
                    humanBone.rotation = originalFpsBone.rotation * _localRotationOffset;
                }

                if (copyScale)
                {
                    humanBone.localScale = originalFpsBone.lossyScale;
                }
            }
        }

        [Header("Original FPS rig visibility")]
        [SerializeField] private Transform[] originalFpsHandVisualRoots = Array.Empty<Transform>();
        [SerializeField] private Transform[] hiddenReferenceAssetRoots = Array.Empty<Transform>();
        [SerializeField] private Renderer[] extraOriginalHandRenderers = Array.Empty<Renderer>();
        [SerializeField] private bool hideOriginalFpsHandsOnAwake = true;
        [SerializeField] private bool includeInactiveHandRenderers = true;

        [Header("Visible human hand retarget")]
        [SerializeField] private List<HandBoneMapping> boneMappings = new List<HandBoneMapping>();
        [SerializeField] private bool retargetEveryLateUpdate = true;

        [Header("Weapon grip")]
        [SerializeField] private Transform weaponRoot;
        [SerializeField] private Transform originalFpsRightGrip;
        [SerializeField] private Transform originalFpsLeftGrip;
        [SerializeField] private Transform originalFpsMuzzleForward;
        [SerializeField] private Transform humanRightGrip;
        [SerializeField] private Transform humanLeftGrip;
        [SerializeField] private bool keepWeaponOnHumanRightGrip = true;
        [SerializeField] private bool orientWeaponFromHiddenHandgunLogic = true;
        [SerializeField] private Vector3 weaponGripPositionOffset;
        [SerializeField] private Vector3 weaponGripEulerOffset;

        [Header("Handgun source pose")]
        [SerializeField] private string sourcePoseUrl = "https://poly.pizza/m/uxko5LkGia";
        [SerializeField] private string sourcePoseCredit = "Fps Rig by J-Toastie, Creative Commons Attribution";
        [SerializeField] private bool hideReferenceWeaponMesh = true;

        private readonly List<Renderer> _hiddenOriginalHandRenderers = new List<Renderer>();
        private Quaternion _weaponGripRotationOffset;
        private Quaternion _originalGripToWeaponRotation = Quaternion.identity;
        private Vector3 _originalGripToWeaponPosition;
        private bool _hasOriginalGripToWeapon;

        private void Awake()
        {
            CacheRuntimeOffsets();

            if (hideOriginalFpsHandsOnAwake)
            {
                HideOriginalFpsHands();
            }

            SnapToMappedPose();
        }

        private void LateUpdate()
        {
            if (!retargetEveryLateUpdate)
                return;

            SnapToMappedPose();
        }

        [ContextMenu("Snap Human Hands To FPS Gun Rig")]
        public void SnapToMappedPose()
        {
            for (int i = 0; i < boneMappings.Count; i++)
            {
                HandBoneMapping mapping = boneMappings[i];
                if (mapping == null)
                    continue;

                mapping.Apply();
            }

            SnapWeaponToHumanGrip();
        }

        [ContextMenu("Hide Original FPS Hands")]
        public void HideOriginalFpsHands()
        {
            _hiddenOriginalHandRenderers.Clear();
            AddExtraOriginalHandRenderers();
            AddRenderersFromOriginalHandRoots();
            AddRenderersFromReferenceAssetRoots();

            for (int i = 0; i < _hiddenOriginalHandRenderers.Count; i++)
            {
                Renderer rendererToHide = _hiddenOriginalHandRenderers[i];
                if (rendererToHide != null)
                {
                    rendererToHide.enabled = false;
                }
            }
        }

        [ContextMenu("Show Original FPS Hands")]
        public void ShowOriginalFpsHands()
        {
            for (int i = 0; i < _hiddenOriginalHandRenderers.Count; i++)
            {
                Renderer rendererToShow = _hiddenOriginalHandRenderers[i];
                if (rendererToShow != null)
                {
                    rendererToShow.enabled = true;
                }
            }
        }

        private void CacheRuntimeOffsets()
        {
            _weaponGripRotationOffset = Quaternion.Euler(weaponGripEulerOffset);
            if (weaponRoot != null && originalFpsRightGrip != null)
            {
                _originalGripToWeaponRotation = Quaternion.Inverse(originalFpsRightGrip.rotation) * weaponRoot.rotation;
                _originalGripToWeaponPosition = Quaternion.Inverse(originalFpsRightGrip.rotation) * (weaponRoot.position - originalFpsRightGrip.position);
                _hasOriginalGripToWeapon = true;
            }

            for (int i = 0; i < boneMappings.Count; i++)
            {
                HandBoneMapping mapping = boneMappings[i];
                if (mapping != null)
                {
                    mapping.CacheOffsets();
                }
            }
        }

        private void SnapWeaponToHumanGrip()
        {
            if (!keepWeaponOnHumanRightGrip || weaponRoot == null || humanRightGrip == null)
                return;

            if (_hasOriginalGripToWeapon)
            {
                Quaternion gripRotation = CalculateHumanGripRotation();
                weaponRoot.rotation = gripRotation * _originalGripToWeaponRotation * _weaponGripRotationOffset;
                weaponRoot.position = humanRightGrip.position + (gripRotation * (_originalGripToWeaponPosition + weaponGripPositionOffset));
                return;
            }

            Quaternion fallbackGripRotation = CalculateHumanGripRotation();
            weaponRoot.position = humanRightGrip.position + (fallbackGripRotation * weaponGripPositionOffset);
            weaponRoot.rotation = fallbackGripRotation * _weaponGripRotationOffset;
        }

        private Quaternion CalculateHumanGripRotation()
        {
            if (!orientWeaponFromHiddenHandgunLogic || humanRightGrip == null || humanLeftGrip == null || originalFpsRightGrip == null || originalFpsLeftGrip == null)
            {
                return humanRightGrip != null ? humanRightGrip.rotation : Quaternion.identity;
            }

            Vector3 sourceSupport = originalFpsLeftGrip.position - originalFpsRightGrip.position;
            Vector3 humanSupport = humanLeftGrip.position - humanRightGrip.position;
            if (sourceSupport.sqrMagnitude < 0.0001f || humanSupport.sqrMagnitude < 0.0001f)
            {
                return humanRightGrip.rotation;
            }

            Quaternion supportDelta = Quaternion.FromToRotation(sourceSupport.normalized, humanSupport.normalized);
            Quaternion rotation = supportDelta * originalFpsRightGrip.rotation;

            if (originalFpsMuzzleForward != null)
            {
                Vector3 sourceForward = originalFpsMuzzleForward.forward;
                Vector3 adjustedForward = supportDelta * sourceForward;
                if (adjustedForward.sqrMagnitude > 0.0001f)
                {
                    rotation = Quaternion.LookRotation(adjustedForward.normalized, rotation * Vector3.up);
                }
            }

            return rotation;
        }

        private void AddExtraOriginalHandRenderers()
        {
            for (int i = 0; i < extraOriginalHandRenderers.Length; i++)
            {
                AddHiddenRenderer(extraOriginalHandRenderers[i]);
            }
        }

        private void AddRenderersFromOriginalHandRoots()
        {
            AddRenderersFromRoots(originalFpsHandVisualRoots);
        }

        private void AddRenderersFromReferenceAssetRoots()
        {
            if (!hideReferenceWeaponMesh)
            {
                return;
            }

            AddRenderersFromRoots(hiddenReferenceAssetRoots);
        }

        private void AddRenderersFromRoots(Transform[] roots)
        {
            for (int i = 0; i < roots.Length; i++)
            {
                Transform root = roots[i];
                if (root == null)
                    continue;

                Renderer[] renderers = root.GetComponentsInChildren<Renderer>(includeInactiveHandRenderers);
                for (int rendererIndex = 0; rendererIndex < renderers.Length; rendererIndex++)
                {
                    AddHiddenRenderer(renderers[rendererIndex]);
                }
            }
        }

        private void AddHiddenRenderer(Renderer rendererToHide)
        {
            if (rendererToHide == null || _hiddenOriginalHandRenderers.Contains(rendererToHide))
                return;

            _hiddenOriginalHandRenderers.Add(rendererToHide);
        }
    }
}
