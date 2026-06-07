const MATCH_META_KEYS = ['mode', 'playType', 'variant', 'targetPoints', 'tableSize', 'ballSet', 'token'];
const STRICT_MATCH_META_KEYS = new Set(['mode', 'token', 'targetPoints']);

export function normalizeTableSizeMeta(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'pro') return '9ft';
  if (normalized.includes('9') && normalized.includes('ft')) return '9ft';
  if (normalized.includes('8') && normalized.includes('ft')) return '8ft';
  if (normalized.includes('tournament')) return '9ft';
  return normalized;
}

export function normalizeBallSetMeta(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'us' || normalized === 'usa') return 'american';
  if (normalized === 'english') return 'uk';
  return normalized;
}

export function normalizeVariantMeta(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const compact = normalized.replace(/[\s_-]+/g, '');
  if (normalized === 'us' || normalized === 'usa') return 'american';
  if (normalized === 'english') return 'uk';
  if (compact === 'eightball' || compact === '8ball') return '8ball';
  if (compact === 'nineball' || compact === '9ball') return '9ball';
  return normalized;
}

export function normalizeMatchMetaValue(key, value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (key === 'tableSize') return normalizeTableSizeMeta(normalized);
  if (key === 'ballSet') return normalizeBallSetMeta(normalized);
  if (key === 'variant') return normalizeVariantMeta(normalized);
  return normalized;
}

export function normalizeMatchMeta(rawMeta = {}) {
  const normalized = {};
  MATCH_META_KEYS.forEach((key) => {
    const value = rawMeta[key];
    if (typeof value === 'string' && value.trim()) {
      const normalizedValue = normalizeMatchMetaValue(key, value);
      if (normalizedValue) normalized[key] = normalizedValue;
    }
  });
  return normalized;
}

export function isMatchMetaCompatible(existing = {}, requested = {}, gameType = '') {
  const normalizedGameType = String(gameType || '').trim().toLowerCase();

  if (normalizedGameType === 'poolroyale') {
    const existingVariant = existing?.variant || '';
    const requestedVariant = requested?.variant || '';
    // Pool Royale quick matchmaking now only partitions by stake + variant.
    // Stake is checked outside this helper (see getAvailableTable).
    // Keep missing variants as wildcards for backward compatibility.
    if (!existingVariant || !requestedVariant) return true;
    return existingVariant === requestedVariant;
  }

  const allKeys = new Set([
    ...Object.keys(existing || {}),
    ...Object.keys(requested || {})
  ]);
  for (const key of allKeys) {
    if (key === 'preferredSide') {
      // Side is a seat preference, not a matchmaking partition. Keep players
      // in the same queue even when they pick opposite colors.
      continue;
    }
    const existingValue = existing?.[key];
    const requestedValue = requested?.[key];
    if (!existingValue || !requestedValue) {
      // Core lobby criteria must match exactly. This prevents Chess Battle
      // Royal players with different tokens/modes from being seated together.
      if (STRICT_MATCH_META_KEYS.has(key)) return false;
      // Treat non-core missing keys as wildcards so players can still pair when
      // one client sends less detailed lobby metadata (for example tableSize).
      continue;
    }
    if (existingValue !== requestedValue) return false;
  }
  return true;
}

export function buildLobbyMatchKey({ gameType, stake = 0, maxPlayers = 4, matchMeta = {}, forcedTableId = '' } = {}) {
  const normalizedMeta = normalizeMatchMeta(matchMeta);
  const normalizedStake = Number(stake) || 0;
  const normalizedGameType = String(gameType || '').trim().toLowerCase();
  const metaKeys = Object.keys(normalizedMeta).sort();
  const metaKey = metaKeys.map((key) => `${key}:${normalizedMeta[key]}`).join('|');
  return [
    normalizedGameType,
    Number(maxPlayers) || 0,
    normalizedStake,
    forcedTableId ? `private:${String(forcedTableId).trim()}` : 'quick',
    metaKey
  ].join('::');
}
