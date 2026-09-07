// Screen-relative drag: finger right looks right; finger up looks up.
export const DEFAULT_PITCH = -0.025;
export function dragLook(yaw, pitch, dx, dy, width = 390, height = 844) {
  const gain = 1.65 / Math.max(320, Math.min(width, height));
  return {
    yaw: yaw - dx * gain,
    pitch: Math.max(-0.65, Math.min(0.7, pitch - dy * gain))
  };
}
export function inAimHeight(pitch, forward) {
  const height = 1.35 + Math.tan(pitch) * forward;
  return height > 0.15 && height < 2.05;
}
