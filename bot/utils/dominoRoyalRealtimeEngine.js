const DOMINO_MAX_PIP = 6;
const DEFAULT_HAND_SIZE = 7;

function normalizeSeed(seed = '') {
  const value = String(seed || 'domino-royal');
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let state = normalizeSeed(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canonicalTile(tile) {
  if (!tile || !Number.isInteger(tile.a) || !Number.isInteger(tile.b)) return null;
  if (tile.a < 0 || tile.a > DOMINO_MAX_PIP || tile.b < 0 || tile.b > DOMINO_MAX_PIP) return null;
  return tile.a <= tile.b ? { a: tile.a, b: tile.b } : { a: tile.b, b: tile.a };
}

function tileKey(tile) {
  const normalized = canonicalTile(tile);
  return normalized ? `${normalized.a}|${normalized.b}` : '';
}

function createDeck() {
  const deck = [];
  for (let a = 0; a <= DOMINO_MAX_PIP; a += 1) {
    for (let b = a; b <= DOMINO_MAX_PIP; b += 1) {
      deck.push({ a, b });
    }
  }
  return deck;
}

function shuffleDeck(deck, seed) {
  const rng = seededRandom(seed);
  const copy = deck.map((tile) => ({ ...tile }));
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function highestDoubleIndex(hand = []) {
  let index = -1;
  let best = -1;
  hand.forEach((tile, idx) => {
    if (tile?.a === tile?.b && tile.a > best) {
      best = tile.a;
      index = idx;
    }
  });
  return index;
}

function pipSum(hand = []) {
  return hand.reduce((sum, tile) => sum + (tile?.a || 0) + (tile?.b || 0), 0);
}

function canPlayTile(tile, ends) {
  const t = canonicalTile(tile);
  if (!t) return false;
  if (!ends) return true;
  return t.a === ends.L || t.b === ends.L || t.a === ends.R || t.b === ends.R;
}

function validSidesFor(tile, ends) {
  const t = canonicalTile(tile);
  if (!t || !ends) return { L: false, R: false };
  return {
    L: t.a === ends.L || t.b === ends.L,
    R: t.a === ends.R || t.b === ends.R
  };
}

function orientForSide(tile, side, ends) {
  const t = canonicalTile(tile);
  if (!t || !ends) return null;
  const key = side === 'L' ? 'L' : 'R';
  const want = ends[key];
  if (key === 'L') {
    if (t.b === want) return { a: t.a, b: t.b };
    if (t.a === want) return { a: t.b, b: t.a };
  } else {
    if (t.a === want) return { a: t.a, b: t.b };
    if (t.b === want) return { a: t.b, b: t.a };
  }
  return null;
}

function nextActiveSeat(state, fromSeat = state.currentSeat) {
  const count = state.players.length;
  for (let offset = 1; offset <= count; offset += 1) {
    const idx = (fromSeat - offset + count) % count;
    if (!state.players[idx]?.disconnected) return idx;
  }
  return fromSeat;
}

function sanitizePlayer(player, index) {
  return {
    id: String(player?.id || `seat-${index}`),
    name: String(player?.name || `Player ${index + 1}`).slice(0, 60),
    avatar: String(player?.avatar || '').slice(0, 500),
    hand: []
  };
}

export function createDominoRoyalState({ tableId, players = [], seed = '' } = {}) {
  const safePlayers = players.slice(0, 4).map(sanitizePlayer);
  const playerCount = Math.max(2, Math.min(4, safePlayers.length || 2));
  while (safePlayers.length < playerCount) {
    safePlayers.push(sanitizePlayer(null, safePlayers.length));
  }

  const state = {
    tableId: String(tableId || ''),
    players: safePlayers,
    boneyard: shuffleDeck(createDeck(), seed || tableId || Date.now()),
    chain: [],
    ends: null,
    currentSeat: 0,
    moveSeq: 0,
    status: 'playing',
    winnerSeat: null,
    reason: '',
    lastAction: null,
    passStreak: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const handSize = DEFAULT_HAND_SIZE;
  for (let round = 0; round < handSize; round += 1) {
    state.players.forEach((player) => {
      const tile = state.boneyard.shift();
      if (tile) player.hand.push(tile);
    });
  }

  let starterSeat = 0;
  let starterTileIndex = -1;
  let bestDouble = -1;
  state.players.forEach((player, seat) => {
    const index = highestDoubleIndex(player.hand);
    if (index >= 0 && player.hand[index].a > bestDouble) {
      bestDouble = player.hand[index].a;
      starterSeat = seat;
      starterTileIndex = index;
    }
  });
  if (starterTileIndex < 0) {
    let bestPips = -1;
    state.players.forEach((player, seat) => {
      player.hand.forEach((tile, index) => {
        const sum = tile.a + tile.b;
        if (sum > bestPips) {
          bestPips = sum;
          starterSeat = seat;
          starterTileIndex = index;
        }
      });
    });
  }

  const openingTile = state.players[starterSeat].hand.splice(starterTileIndex, 1)[0];
  const tile = canonicalTile(openingTile);
  state.chain.push({ tile, side: 'START', seat: starterSeat, seq: 0 });
  state.ends = { L: tile.a, R: tile.b };
  state.currentSeat = nextActiveSeat(state, starterSeat);
  state.lastAction = { type: 'start', seat: starterSeat, tile, nextSeat: state.currentSeat };
  return state;
}

export function getSeatForPlayer(state, playerId) {
  const id = String(playerId || '');
  return state?.players?.findIndex((player) => String(player.id) === id) ?? -1;
}

function concludeIfNeeded(state) {
  const winner = state.players.findIndex((player) => player.hand.length === 0);
  if (winner >= 0) {
    state.status = 'finished';
    state.winnerSeat = winner;
    state.reason = `${state.players[winner].name} played every tile.`;
    return true;
  }

  const nobodyCanPlay = state.players.every((player) => !player.hand.some((tile) => canPlayTile(tile, state.ends)));
  if (state.boneyard.length === 0 && nobodyCanPlay) {
    let bestSeat = 0;
    let bestScore = Infinity;
    state.players.forEach((player, seat) => {
      const score = pipSum(player.hand);
      if (score < bestScore) {
        bestScore = score;
        bestSeat = seat;
      }
    });
    state.status = 'finished';
    state.winnerSeat = bestSeat;
    state.reason = `Blocked game. Lowest hand: ${state.players[bestSeat].name} (${bestScore}).`;
    return true;
  }
  return false;
}

export function applyDominoRoyalAction(state, action = {}, actorId = '') {
  if (!state || state.status !== 'playing') return { ok: false, error: 'match_not_active' };
  const seat = getSeatForPlayer(state, actorId);
  if (seat < 0) return { ok: false, error: 'seat_required' };
  if (seat !== state.currentSeat) return { ok: false, error: 'not_your_turn' };

  const type = String(action.type || '').toLowerCase();
  let acceptedAction = null;

  if (type === 'play') {
    const side = action.side === 'L' || action.side === -1 || action.side === 'left' ? 'L' : 'R';
    const requestedKey = tileKey(action.tile);
    const handIndex = state.players[seat].hand.findIndex((tile) => tileKey(tile) === requestedKey);
    if (!requestedKey || handIndex < 0) return { ok: false, error: 'tile_not_in_hand' };
    const tile = state.players[seat].hand[handIndex];
    const sides = validSidesFor(tile, state.ends);
    if (!sides[side]) return { ok: false, error: 'illegal_tile_side' };
    const oriented = orientForSide(tile, side, state.ends);
    if (!oriented) return { ok: false, error: 'illegal_tile_side' };
    state.players[seat].hand.splice(handIndex, 1);
    if (side === 'L') state.ends.L = oriented.a;
    else state.ends.R = oriented.b;
    state.moveSeq += 1;
    acceptedAction = { type: 'play', seat, side, tile: oriented, seq: state.moveSeq };
    state.chain.push(acceptedAction);
    state.passStreak = 0;
  } else if (type === 'draw') {
    if (state.players[seat].hand.some((tile) => canPlayTile(tile, state.ends))) {
      return { ok: false, error: 'play_available' };
    }
    const drawn = [];
    while (state.boneyard.length) {
      const tile = state.boneyard.shift();
      state.players[seat].hand.push(tile);
      drawn.push(tile);
      if (canPlayTile(tile, state.ends)) break;
    }
    if (!drawn.length) return { ok: false, error: 'boneyard_empty' };
    state.moveSeq += 1;
    acceptedAction = { type: 'draw', seat, count: drawn.length, seq: state.moveSeq };
    state.passStreak = 0;
  } else if (type === 'pass') {
    if (state.players[seat].hand.some((tile) => canPlayTile(tile, state.ends))) {
      return { ok: false, error: 'play_available' };
    }
    if (state.boneyard.length > 0) return { ok: false, error: 'must_draw' };
    state.moveSeq += 1;
    state.passStreak += 1;
    acceptedAction = { type: 'pass', seat, seq: state.moveSeq };
  } else {
    return { ok: false, error: 'unknown_action' };
  }

  state.lastAction = acceptedAction;
  if (!concludeIfNeeded(state)) {
    state.currentSeat = nextActiveSeat(state, seat);
  }
  state.updatedAt = Date.now();
  return { ok: true, state, action: acceptedAction };
}

export function publicDominoRoyalState(state, viewerId = '') {
  const viewerSeat = getSeatForPlayer(state, viewerId);
  return {
    tableId: state.tableId,
    players: state.players.map((player, seat) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      hand: seat === viewerSeat || state.status === 'finished' ? player.hand.map((tile) => ({ ...tile })) : [],
      handCount: player.hand.length
    })),
    boneyardCount: state.boneyard.length,
    chain: state.chain.map((entry) => ({ ...entry, tile: { ...entry.tile } })),
    ends: state.ends ? { ...state.ends } : null,
    currentSeat: state.currentSeat,
    currentPlayerId: state.players[state.currentSeat]?.id || null,
    moveSeq: state.moveSeq,
    status: state.status,
    winnerSeat: state.winnerSeat,
    reason: state.reason,
    lastAction: state.lastAction ? { ...state.lastAction, tile: state.lastAction.tile ? { ...state.lastAction.tile } : undefined } : null,
    viewerSeat,
    updatedAt: state.updatedAt
  };
}
