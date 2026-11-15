/** Paid/resume links always open racing. Retired city and Free Roam links
 * fall back to the garage; explicit career-job links keep their own runtime. */
export function racingActivity(search = '') {
  const p = new URLSearchParams(search);
  if (p.get('mode') === 'online' || p.get('tableId') || p.get('code')) return 'race';
  if (p.get('activity') === 'racing-career') return 'career';
  return 'race';
}
