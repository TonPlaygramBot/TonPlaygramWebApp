export function getSnookerShotPowerFeedback(power = 0) {
  const normalized = Math.min(1, Math.max(0, Number.isFinite(power) ? power : 0));

  if (normalized === 0) {
    return { label: 'Pull down', detail: 'Release to shoot', tone: 'ready' };
  }
  if (normalized < 0.3) {
    return { label: 'Soft touch', detail: `${Math.round(normalized * 100)}% power`, tone: 'soft' };
  }
  if (normalized < 0.7) {
    return { label: 'Controlled', detail: `${Math.round(normalized * 100)}% power`, tone: 'control' };
  }
  return { label: 'Power shot', detail: `${Math.round(normalized * 100)}% power`, tone: 'power' };
}
