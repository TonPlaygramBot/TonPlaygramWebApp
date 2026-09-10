/** Default to the user-supplied Alpine game. Paid sessions retain their existing
 * authoritative runtime; the local weapon-bubble game never handles stakes. */
export function racingActivity(search = '') {
  const p = new URLSearchParams(search);
  if (p.get('mode') === 'online' || p.get('tableId') || p.get('code')) return 'race';
  if (p.get('activity') === 'explore') return 'explore';
  if (p.get('activity') === 'racing-career' || p.get('mode') === 'career') return 'career';
  if (p.get('activity') === 'garage') return 'race';
  return 'alpine';
}
