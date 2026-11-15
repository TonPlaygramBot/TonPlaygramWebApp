/** Explicit activity resolution. Paid sessions always retain the original race
 * runtime; missing/AI URLs must not default to a new nested mode-selection menu. */
export function racingActivity(search = '') {
  const p = new URLSearchParams(search);
  if (p.get('mode') === 'online' || p.get('tableId') || p.get('code')) return 'race';
  // Keep explicit job-board links; retired city/free-roam links open the garage.
  if (p.get('activity') === 'racing-career') return 'career';
  return 'race';
}
