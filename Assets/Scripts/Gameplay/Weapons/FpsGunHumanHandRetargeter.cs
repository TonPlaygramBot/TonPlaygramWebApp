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
        [SerializeField] private Renderer[] extraOriginalHandRenderers = Array.Empty<Renderer>();
        [SerializeField] private bool hideOriginalFpsHandsOnAwake = true;
        [SerializeField] private bool includeInactiveHandRenderers = true;

        [Header("Visible human hand retarget")]
        [SerializeField] private List<HandBoneMapping> boneMappings = new List<HandBoneMapping>();
        [SerializeField] private bool retargetEveryLateUpdate = true;

        [Header("Weapon grip")]
        [SerializeField] private Transform weaponRoot;
        [SerializeField] private Transform originalFpsRightGrip;
        [SerializeField] private Transform humanRightGrip;
        [SerializeField] private bool keepWeaponOnHumanRightGrip = true;
        [SerializeField] private Vector3 weaponGripPositionOffset;
        [SerializeField] private Vector3 weaponGripEulerOffset;

        [Header("FPS screen presentation")]
        [SerializeField] private Camera presentationCamera;
        [SerializeField] private Transform fpsPresentationRoot;
        [SerializeField] private bool keepWeaponVisibleInFpsView = true;
        [SerializeField] private Vector3 cameraSpaceWeaponOffset = new Vector3(0.18f, -0.2f, 0.55f);
        [SerializeField] private Vector3 cameraSpaceWeaponEuler = new Vector3(-4f, 2f, 0f);
        [SerializeField] private Vector2 minWeaponViewport = new Vector2(0.12f, 0.06f);
        [SerializeField] private Vector2 maxWeaponViewport = new Vector2(0.88f, 0.42f);

        private readonly List<Renderer> _hiddenOriginalHandRenderers = new List<Renderer>();
        private Quaternion _weaponGripRotationOffset;
        private Quaternion _cameraSpaceWeaponRotationOffset;
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
            _cameraSpaceWeaponRotationOffset = Quaternion.Euler(cameraSpaceWeaponEuler);
            if (presentationCamera == null)
            {
                presentationCamera = Camera.main;
            }
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
                weaponRoot.rotation = humanRightGrip.rotation * _originalGripToWeaponRotation * _weaponGripRotationOffset;
                weaponRoot.position = humanRightGrip.position + (humanRightGrip.rotation * (_originalGripToWeaponPosition + weaponGripPositionOffset));
                KeepWeaponVisibleInFpsView();
                return;
            }

            weaponRoot.position = humanRightGrip.TransformPoint(weaponGripPositionOffset);
            weaponRoot.rotation = humanRightGrip.rotation * _weaponGripRotationOffset;
            KeepWeaponVisibleInFpsView();
        }

        private void KeepWeaponVisibleInFpsView()
        {
            Transform presentationRoot = fpsPresentationRoot != null ? fpsPresentationRoot : weaponRoot;
            if (!keepWeaponVisibleInFpsView || presentationCamera == null || presentationRoot == null)
                return;

            Vector3 viewportPoint = presentationCamera.WorldToViewportPoint(presentationRoot.position);
            bool behindCamera = viewportPoint.z <= presentationCamera.nearClipPlane;
            bool outsideSafeBottomFrame = viewportPoint.x < minWeaponViewport.x || viewportPoint.x > maxWeaponViewport.x || viewportPoint.y < minWeaponViewport.y || viewportPoint.y > maxWeaponViewport.y;
            if (!behindCamera && !outsideSafeBottomFrame)
                return;

            Transform cameraTransform = presentationCamera.transform;
            presentationRoot.position = cameraTransform.TransformPoint(cameraSpaceWeaponOffset);
            presentationRoot.rotation = cameraTransform.rotation * _cameraSpaceWeaponRotationOffset;
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
            for (int i = 0; i < originalFpsHandVisualRoots.Length; i++)
            {
                Transform handRoot = originalFpsHandVisualRoots[i];
                if (handRoot == null)
                    continue;

                Renderer[] renderers = handRoot.GetComponentsInChildren<Renderer>(includeInactiveHandRenderers);
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
