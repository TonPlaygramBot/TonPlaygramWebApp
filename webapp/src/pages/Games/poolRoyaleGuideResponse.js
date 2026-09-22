/**
 * Equal-mass contact geometry in the table plane. The cyan dashed line is an
 * outgoing-direction aid, not a guarantee of final position or pot success.
 * Side spin does not rotate the tangent at ball contact; its cushion response
 * is handled by the physics engine.
 */
export function poolCueGuideResponse({ incoming, tangent, transfer = 1, spinY = 0, ballImpact = false }) {
  const inputLength = Math.hypot(incoming?.x ?? 0, incoming?.y ?? 0);
  if (!(inputLength > 1e-8)) return { direction: { x: 0, y: 0 }, strength: 0 };
  const forward = { x: incoming.x / inputLength, y: incoming.y / inputLength };
  const tangentLength = Math.hypot(tangent?.x ?? 0, tangent?.y ?? 0);
  const residual = ballImpact ? Math.max(0, Math.min(1, transfer)) : 1;
  let x = tangentLength > 1e-8 ? tangent.x / tangentLength * residual : 0;
  let y = tangentLength > 1e-8 ? tangent.y / tangentLength * residual : 0;
  if (ballImpact) {
    // Modest follow/draw indication; the solid line and ghost circle remain
    // exact first-contact geometry. Do not invent a forward path for a stun.
    const roll = Math.max(-1, Math.min(1, spinY || 0)) * 0.55;
    x += forward.x * roll;
    y += forward.y * roll;
  } else if (tangentLength <= 1e-8) {
    return { direction: forward, strength: 0 };
  }
  const length = Math.hypot(x, y);
  return length > 1e-6
    ? { direction: { x: x / length, y: y / length }, strength: Math.min(1, length) }
    : { direction: { x: 0, y: 0 }, strength: 0 };
}
