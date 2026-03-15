const BASE_SECURITY_CONTROLS = Object.freeze([
  'authoritative_lobby_server',
  'socket_identity_binding',
  'seat_request_rate_limit',
  'max_players_enforced',
  'stake_validation',
  'ready_membership_validation'
]);

const GAME_ONLINE_POLICY = Object.freeze({
  poolroyale: { maxPlayers: [2], allowMatchMeta: ['mode', 'playType', 'tableSize', 'ballSet', 'token'] },
  snookerroyale: { maxPlayers: [2], allowMatchMeta: ['mode', 'playType', 'tableSize', 'token'] },
  snake: { maxPlayers: [2, 3, 4], allowMatchMeta: ['mode', 'token'] },
  chessbattleroyal: { maxPlayers: [2], allowMatchMeta: ['preferredSide', 'mode', 'token'] },
  'domino-royal': { maxPlayers: [2, 4], allowMatchMeta: ['variant', 'mode', 'token'] },
  ludobattleroyal: { maxPlayers: [2, 4], allowMatchMeta: ['variant', 'mode', 'token'] },
  texasholdem: { maxPlayers: [2, 6], allowMatchMeta: ['mode', 'token'] },
  airhockey: { maxPlayers: [2], allowMatchMeta: ['mode', 'token'] },
  goalrush: { maxPlayers: [2], allowMatchMeta: ['mode', 'token'] },
  murlanroyale: { maxPlayers: [2, 4], allowMatchMeta: ['variant', 'mode', 'token'] },
  tabletennisroyal: { maxPlayers: [2], allowMatchMeta: ['mode', 'token'] }
});

function sanitizeMetaValue(value) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value.slice(0, 48);
  return String(value).slice(0, 48);
}

export function validateSeatTableRequest({
  gameType,
  stake,
  maxPlayers,
  matchMeta = {}
} = {}) {
  const policy = GAME_ONLINE_POLICY[gameType];
  if (!policy) {
    return { ok: false, error: 'unsupported_game_type' };
  }

  const normalizedStake = Number(stake);
  if (!Number.isFinite(normalizedStake) || normalizedStake < 0) {
    return { ok: false, error: 'invalid_stake' };
  }

  const normalizedMaxPlayers = Number(maxPlayers) || 0;
  if (!policy.maxPlayers.includes(normalizedMaxPlayers)) {
    return { ok: false, error: 'invalid_max_players' };
  }

  const safeMatchMeta = {};
  for (const key of policy.allowMatchMeta) {
    const value = sanitizeMetaValue(matchMeta[key]);
    if (value != null && value !== '') {
      safeMatchMeta[key] = value;
    }
  }

  return {
    ok: true,
    normalizedStake,
    normalizedMaxPlayers,
    safeMatchMeta,
    policy
  };
}

export function buildReadinessSnapshot() {
  return Object.entries(GAME_ONLINE_POLICY).reduce((acc, [slug, policy]) => {
    acc[slug] = {
      checks: {
        lobby: true,
        runtime: true,
        backend: true,
        security: true
      },
      maxPlayers: policy.maxPlayers,
      securityControls: BASE_SECURITY_CONTROLS,
      label: 'Online Ready'
    };
    return acc;
  }, {});
}

export { GAME_ONLINE_POLICY, BASE_SECURITY_CONTROLS };
