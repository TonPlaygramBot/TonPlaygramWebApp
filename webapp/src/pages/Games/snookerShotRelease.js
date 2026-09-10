export function deliverOrQueueSnookerShot({ fire, power, pendingRef }) {
  if (!Number.isFinite(power) || power <= 0) return false;
  if (typeof fire === 'function') {
    fire(power);
    return true;
  }
  if (pendingRef) pendingRef.current = power;
  return false;
}

export function drainQueuedSnookerShot({ fire, pendingRef }) {
  if (typeof fire !== 'function' || !pendingRef) return false;
  const power = pendingRef.current;
  pendingRef.current = null;
  if (!Number.isFinite(power) || power <= 0) return false;
  fire(power);
  return true;
}
