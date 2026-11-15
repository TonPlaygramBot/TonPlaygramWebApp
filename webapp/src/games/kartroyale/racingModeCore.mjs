/** Explicit activity resolution. Paid sessions always retain the original race
 * runtime; missing/AI URLs must not default to a new nested mode-selection menu. */
export function racingActivity(search = '') {
  const p = new URLSearchParams(search);
  if (p.get('mode') === 'online' || p.get('tableId') || p.get('code')) return 'race';
  if (p.get('activity') === 'explore' || p.get('activity') === 'city') return 'explore';
  // Explicit old job-board links continue to work; the Career entry is social.
  if (p.get('activity') === 'racing-career') return 'career';
  if (p.get('mode') === 'career') return 'explore';
  return 'race';
}
