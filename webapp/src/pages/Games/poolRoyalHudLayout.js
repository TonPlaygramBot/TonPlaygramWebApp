export const POOL_SPIN_DIAMETER_PX = 124;
export const POOL_AVATAR_SIZE_PX = 40;

/** Shared bounds for the portrait avatars and spin dial, in every camera view.
 * Do not give the avatar container w-full: left/right insets define its width. */
export function poolRoyalHudLayout({ uiScale = 1, portrait = true, bottom = 12 }) {
  const spinScale = uiScale * 0.88;
  const spinRight = portrait ? 2 : 4;
  const spinSize = POOL_SPIN_DIAMETER_PX * spinScale;
  return {
    avatars: { left: 8, right: spinRight + spinSize + 12, bottom },
    spin: {
      right: spinRight, bottom,
      transform: `scale(${spinScale})`, transformOrigin: 'bottom right'
    }
  };
}
