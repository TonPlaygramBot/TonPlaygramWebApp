export const ALBANIAN_61_ID = 'albanian61';

export function isAlbanian61Variant(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return ['albanian61', 'albanian', '61', '61points', 'rotation61', 'race61'].includes(key);
}

export const ALBANIAN_61_RULES = 'Rotation 61: hit the lowest-numbered ball first. Each legal pot scores its number; combinations count. Reach 61 points to win. A legal pot on the break keeps your turn. No solids/stripes groups; the 8 is worth 8 points. Foul pots are re-spotted without scoring, and the opponent places the cue ball behind the head string. At 60–60, the last legal potter gets 1 bonus point. These are this mode’s house rules; local Albanian rules can vary.';

export const POOL_ROYALE_LOBBY_VARIANTS = Object.freeze([
  { id: 'uk', label: '8Ball' },
  { id: '9ball', label: '9-Ball' },
  { id: ALBANIAN_61_ID, label: 'Albanian 61', subtitle: '61 pikë · Rotation' }
]);

export function resolvePoolLobbyVariant(value) {
  if (isAlbanian61Variant(value)) return ALBANIAN_61_ID;
  const key = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return key === '9ball' || key === 'nineball' || key === '9' ? '9ball' : 'uk';
}

export function arePoolVariantsCompatible(existing = '', requested = '') {
  // Older clients omit the variant. Never put one in a 61-point table: its
  // client would adjudicate a different game. Preserve other legacy queues.
  const existing61 = isAlbanian61Variant(existing);
  const requested61 = isAlbanian61Variant(requested);
  if (existing61 || requested61) return existing61 && requested61;
  return !existing || !requested || existing === requested;
}
