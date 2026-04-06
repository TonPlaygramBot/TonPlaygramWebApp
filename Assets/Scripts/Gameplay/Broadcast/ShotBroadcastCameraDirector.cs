using UnityEngine;

namespace Aiming.Gameplay.Broadcast
{
    public enum BroadcastCameraMode
    {
        RailOverhead,
        Pocket
    }

    public enum PocketKind
    {
        Corner,
        Middle
    }

    /// <summary>
    /// Routes highlight camera selection for broadcast: bank/double rail + middle pockets
    /// use rail overhead, corner pockets use pocket cameras.
    /// </summary>
    public class ShotBroadcastCameraDirector : MonoBehaviour
    {
        [SerializeField, Min(0f)] private float maxBankDistanceToRail = 0.06f;
        [SerializeField, Min(0f)] private float pocketCameraLift = 0f;
        [SerializeField, Min(0f)] private float pocketCameraInward = 0f;

        private bool forceRailOverheadForPendingShot;

        public void ForceRailOverheadForNextShot()
        {
            forceRailOverheadForPendingShot = true;
        }

        public BroadcastCameraMode ResolveCamera(
            Vector3 contactPoint,
            Bounds tableBounds,
            int cushionHits,
            PocketKind pocketKind,
            ref Vector3 pocketCameraPosition,
            Vector3 tableCenter)
        {
            if (forceRailOverheadForPendingShot)
            {
                forceRailOverheadForPendingShot = false;
                return BroadcastCameraMode.RailOverhead;
            }

            bool isDoubleBank = cushionHits >= 2;
            bool isMiddlePocket = pocketKind == PocketKind.Middle;
            bool nearRail = DistanceToRail(contactPoint, tableBounds) <= maxBankDistanceToRail;

            if (isDoubleBank || isMiddlePocket || nearRail)
            {
                return BroadcastCameraMode.RailOverhead;
            }

            pocketCameraPosition = LiftAndPullInward(pocketCameraPosition, tableCenter);
            return BroadcastCameraMode.Pocket;
        }

        private Vector3 LiftAndPullInward(Vector3 cameraPosition, Vector3 tableCenter)
        {
            Vector3 lifted = cameraPosition + Vector3.up * pocketCameraLift;
            Vector3 toCenter = (tableCenter - lifted);
            if (toCenter.sqrMagnitude < 0.0001f)
            {
                return lifted;
            }

            return lifted + toCenter.normalized * pocketCameraInward;
        }

        private static float DistanceToRail(Vector3 point, Bounds tableBounds)
        {
            float dx = Mathf.Min(Mathf.Abs(point.x - tableBounds.min.x), Mathf.Abs(tableBounds.max.x - point.x));
            float dz = Mathf.Min(Mathf.Abs(point.z - tableBounds.min.z), Mathf.Abs(tableBounds.max.z - point.z));
            return Mathf.Min(dx, dz);
        }
    }
}
