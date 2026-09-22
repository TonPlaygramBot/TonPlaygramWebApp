/** Keep a saved layout pending until the live entities actually exist. */
export function restorePendingBilliardsLayout(pending, balls, apply) {
  if (!Array.isArray(pending?.current) || !pending.current.length || !balls?.length || typeof apply !== 'function') return false;
  apply(pending.current);
  pending.current = null;
  return true;
}

/** Pool's numbered entities live in its serialized rule state, not FrameState.balls. */
export function poolCalledBallOptions(frame) {
  const remaining = frame?.meta?.state?.ballsOnTable;
  if (!Array.isArray(remaining)) return [];
  return [...new Set(remaining)].filter(id => Number.isInteger(id) && id > 0 && id <= 15)
    .sort((a, b) => a - b).map(id => ({ id: `ball_${id}` }));
}

/** Screen-space placement follows the active camera, including portrait views. */
export function positionPocketCallButton(button, projected, rect) {
  if (!button) return;
  const visible = [projected.x, projected.y, projected.z].every(Number.isFinite) &&
    projected.z > -1 && projected.z < 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
  button.style.opacity = visible ? '1' : '0';
  button.style.pointerEvents = visible ? 'auto' : 'none';
  if (visible) button.style.transform = `translate(${rect.left + (projected.x + 1) * rect.width / 2}px, ${rect.top + (1 - projected.y) * rect.height / 2}px) translate(-50%, -50%)`;
}
