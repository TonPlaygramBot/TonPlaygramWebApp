using UnityEngine;

namespace Aiming.Gameplay.Cue
{
    /// <summary>
    /// Prevents cue overlap with balls/cushions/chalk and keeps helper visuals aligned.
    /// </summary>
    public class CueTableClearanceGuard : MonoBehaviour
    {
        [SerializeField] private Transform cueRoot;
        [SerializeField] private Transform[] protectedBalls;
        [SerializeField] private Transform[] ballHelpers;
        [SerializeField] private Renderer[] ballShadowRenderers;
        [SerializeField] private LayerMask blockerMask;
        [SerializeField, Min(0f)] private float cueRadius = 0.012f;
        [SerializeField, Min(0f)] private float ballLift = 0.0015f;
        [SerializeField, Min(0f)] private float helperClearance = 0.001f;
        [SerializeField, Min(0f)] private float shadowScaleMultiplier = 1f;

        [Header("Cloth material parity")]
        [SerializeField] private Renderer[] clothRenderers;
        [SerializeField] private Material texasHoldemClothMaterial;

        void LateUpdate()
        {
            KeepCueClear();
            LiftBallsAndHelpers();
            MatchShadowRadius();
            ApplyTexasHoldemCloth();
        }

        private void KeepCueClear()
        {
            if (cueRoot == null)
            {
                return;
            }

            Vector3 start = cueRoot.position;
            Vector3 end = cueRoot.position + cueRoot.forward * 1.4f;
            if (!Physics.CheckCapsule(start, end, cueRadius, blockerMask, QueryTriggerInteraction.Ignore))
            {
                return;
            }

            Vector3 retreat = cueRoot.forward * -0.01f;
            cueRoot.position += retreat;
        }

        private void LiftBallsAndHelpers()
        {
            for (int i = 0; i < protectedBalls.Length; i++)
            {
                Transform ball = protectedBalls[i];
                if (ball == null)
                {
                    continue;
                }

                Vector3 pos = ball.position;
                ball.position = new Vector3(pos.x, Mathf.Max(pos.y, ballLift), pos.z);
            }

            for (int i = 0; i < ballHelpers.Length; i++)
            {
                Transform helper = ballHelpers[i];
                if (helper == null)
                {
                    continue;
                }

                Vector3 helperPos = helper.position;
                helper.position = new Vector3(helperPos.x, helperPos.y + helperClearance, helperPos.z);
            }
        }

        private void MatchShadowRadius()
        {
            foreach (Renderer shadowRenderer in ballShadowRenderers)
            {
                if (shadowRenderer == null)
                {
                    continue;
                }

                Vector3 scale = shadowRenderer.transform.localScale;
                float radiusScale = Mathf.Max(scale.x, scale.z) * shadowScaleMultiplier;
                shadowRenderer.transform.localScale = new Vector3(radiusScale, scale.y, radiusScale);
            }
        }

        private void ApplyTexasHoldemCloth()
        {
            if (texasHoldemClothMaterial == null)
            {
                return;
            }

            foreach (Renderer clothRenderer in clothRenderers)
            {
                if (clothRenderer == null)
                {
                    continue;
                }

                if (clothRenderer.sharedMaterial != texasHoldemClothMaterial)
                {
                    clothRenderer.sharedMaterial = texasHoldemClothMaterial;
                }
            }
        }
    }
}
