/** Explicit activity resolution. Paid sessions always retain the original race
 * runtime; missing/AI URLs must not default to a new nested mode-selection menu. */
export function racingActivity(search = '') {
  const p = new URLSearchParams(search);
  if (p.get('mode') === 'online' || p.get('tableId') || p.get('code')) return 'race';
  if (p.get('activity') === 'explore') return 'explore';
  if (p.get('activity') === 'racing-career' || p.get('mode') === 'career') return 'career';
  return 'race';
}
