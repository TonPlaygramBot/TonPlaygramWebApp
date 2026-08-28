const BASE_SECURITY_CONTROLS = Object.freeze([
  'tpg_account_number_required',
  'authoritative_lobby_server',
  'socket_identity_binding',
  'seat_request_rate_limit',
  'max_players_enforced',
  'stake_validation',
  'ready_membership_validation'
]);

const GAME_ONLINE_POLICY = Object.freeze({
  chess: {
    maxPlayers: [2],
    allowMatchMeta: ['preferredSide', 'mode', 'token']
  },
  checkers: {
    maxPlayers: [2],
    allowMatchMeta: ['preferredSide', 'mode', 'token']
  },
  poolroyale: {
    maxPlayers: [2],
    allowMatchMeta: [
      'variant',
      'mode',
      'playType',
      'tableSize',
      'ballSet',
      'token'
    ]
  },
  snookerroyale: {
    maxPlayers: [2],
    allowMatchMeta: ['mode', 'playType', 'tableSize', 'token']
  },
  snake: { maxPlayers: [2, 3, 4], allowMatchMeta: ['mode', 'token'] },
  chessbattleroyal: {
    maxPlayers: [2],
    allowMatchMeta: ['preferredSide', 'mode', 'token']
  },
  checkersbattleroyal: { maxPlayers: [2], allowMatchMeta: ['mode', 'token'] },
  fourinrow: {
    maxPlayers: [2],
    allowMatchMeta: ['boardSize', 'mode', 'token']
  },
  'domino-royal': {
    maxPlayers: [2, 3, 4],
    allowMatchMeta: ['variant', 'targetPoints', 'mode', 'token']
  },
  ludobattleroyal: {
    // The portrait lobby exposes 2, 3, and 4-seat tables. Keep the socket
    // contract aligned so a three-player quick match is not rejected before
    // it can enter the shared queue.
    maxPlayers: [2, 3, 4],
    allowMatchMeta: ['variant', 'mode', 'token']
  },
  texasholdem: {
    maxPlayers: [2, 3, 4, 5, 6, 7, 8],
    allowMatchMeta: ['tableSize', 'gameMode', 'buyIn', 'mode', 'token']
  },
  airhockey: {
    maxPlayers: [2],
    allowMatchMeta: ['winScore', 'arena', 'mode', 'token']
  },
  backgammon: { maxPlayers: [2], allowMatchMeta: ['mode', 'token'] },
  murlanroyale: {
    maxPlayers: [2, 3, 4],
    allowMatchMeta: [
      'variant',
      'targetPoints',
      'players',
      'rules',
      'mode',
      'token'
    ]
  },
  tabletennis: { maxPlayers: [2], allowMatchMeta: ['rules', 'mode', 'token'] },
  tenpinbowling: { maxPlayers: [2], allowMatchMeta: ['rules', 'mode', 'token'] },
  darts: { maxPlayers: [2], allowMatchMeta: ['rules', 'mode', 'token'] },
  carrom: { maxPlayers: [2], allowMatchMeta: ['rules', 'mode', 'token'] },
  archery: { maxPlayers: [2], allowMatchMeta: ['rules', 'mode', 'token'] },
  penaltyshootout: { maxPlayers: [2], allowMatchMeta: ['rules', 'mode', 'token'] },
  basketball: { maxPlayers: [2], allowMatchMeta: ['rules', 'mode', 'token'] },
  gocrazykart: { maxPlayers: [4], allowMatchMeta: ['rules', 'mode', 'token'] }
});

const GAME_TYPE_ALIASES = Object.freeze({
  chessbattle: 'chess',
  chessbattleroyal: 'chess',
  chessbattleroyale: 'chess',
  checkersbattle: 'checkers',
  checkersbattleroyal: 'checkers',
  checkersbattleroyale: 'checkers',
  fourinrowroyale: 'fourinrow',
  fourinarowroyale: 'fourinrow'
});

export function normalizeOnlineGameType(gameType) {
  const normalized = String(gameType || '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  if (GAME_TYPE_ALIASES[normalized]) return GAME_TYPE_ALIASES[normalized];

  const compact = normalized.replace(/[^a-z0-9]+/g, '');
  return GAME_TYPE_ALIASES[compact] || normalized;
}

function sanitizeMetaValue(value) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value.slice(0, 48);
  return String(value).slice(0, 48);
}

function validateDominoRoyalCriteria(matchMeta = {}) {
  const variant = String(matchMeta.variant || '')
    .trim()
    .toLowerCase();
  if (!['single', 'points'].includes(variant)) {
    return { ok: false, error: 'invalid_game_variant' };
  }

  const token = String(matchMeta.token || '')
    .trim()
    .toUpperCase();
  if (token !== 'TPG') {
    return { ok: false, error: 'invalid_stake_token' };
  }

  const mode = String(matchMeta.mode || '')
    .trim()
    .toLowerCase();
  if (mode !== 'online') {
    return { ok: false, error: 'invalid_game_mode' };
  }

  const safeMatchMeta = { variant, mode, token };
  if (variant === 'points') {
    const targetPoints = Number(matchMeta.targetPoints);
    if (![51, 101].includes(targetPoints)) {
      return { ok: false, error: 'invalid_target_points' };
    }
    safeMatchMeta.targetPoints = String(targetPoints);
  }

  return { ok: true, safeMatchMeta };
}

export function validateSeatTableRequest({
  gameType,
  stake,
  maxPlayers,
  matchMeta = {}
} = {}) {
  const normalizedGameType = normalizeOnlineGameType(gameType);
  const policy = GAME_ONLINE_POLICY[normalizedGameType];
  if (!policy) {
    return { ok: false, error: 'unsupported_game_type' };
  }

  const normalizedStake = Number(stake);
  if (!Number.isSafeInteger(normalizedStake) || normalizedStake <= 0) {
    return { ok: false, error: 'invalid_stake' };
  }

  const normalizedMaxPlayers = Number(maxPlayers) || 0;
  if (!policy.maxPlayers.includes(normalizedMaxPlayers)) {
    return { ok: false, error: 'invalid_max_players' };
  }

  if (normalizedGameType === 'domino-royal') {
    const dominoCriteria = validateDominoRoyalCriteria(matchMeta);
    if (!dominoCriteria.ok) return dominoCriteria;
    return {
      ok: true,
      normalizedGameType,
      normalizedStake,
      normalizedMaxPlayers,
      safeMatchMeta: dominoCriteria.safeMatchMeta,
      policy
    };
  }

  const token = String(matchMeta.token || '')
    .trim()
    .toUpperCase();
  if (token !== 'TPG') {
    return { ok: false, error: 'invalid_stake_token' };
  }

  const mode = String(matchMeta.mode || '')
    .trim()
    .toLowerCase();
  if (mode !== 'online') {
    return { ok: false, error: 'invalid_game_mode' };
  }

  const safeMatchMeta = {};
  for (const key of policy.allowMatchMeta) {
    const value = sanitizeMetaValue(matchMeta[key]);
    if (value != null && value !== '') {
      safeMatchMeta[key] =
        key === 'token'
          ? String(value).toUpperCase()
          : key === 'mode'
            ? String(value).toLowerCase()
            : value;
    }
  }

  return {
    ok: true,
    normalizedGameType,
    normalizedStake,
    normalizedMaxPlayers,
    safeMatchMeta,
    policy
  };
}

export function buildReadinessSnapshot() {
  const snapshot = Object.entries(GAME_ONLINE_POLICY).reduce((acc, [slug, policy]) => {
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
  // The public Games catalog uses the royale slug while sockets use the short
  // authoritative game type.
  snapshot.fourinrowroyale = snapshot.fourinrow;
  snapshot.tabletennisroyal = snapshot.tabletennis;
  snapshot.tenpinbowlingroyal = snapshot.tenpinbowling;
  snapshot.dartsroyal = snapshot.darts;
  snapshot.carromroyal = snapshot.carrom;
  snapshot.archeryroyal = snapshot.archery;
  snapshot.penaltyshootoutroyal = snapshot.penaltyshootout;
  snapshot.basketballroyal = snapshot.basketball;
  snapshot.gocrazykartarena = snapshot.gocrazykart;
  return snapshot;
}

export { GAME_ONLINE_POLICY, BASE_SECURITY_CONTROLS, GAME_TYPE_ALIASES };
