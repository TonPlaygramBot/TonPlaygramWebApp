import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class MatchmakingOrchestrator extends EventEmitter {
  constructor({ matchSize = 2, afkTimeout = 30000 } = {}) {
    super();
    this.matchSize = matchSize;
    this.afkTimeout = afkTimeout;
    this.queue = new Map(); // gameId => [playerIds]
    this.matches = new Map(); // matchId => match object
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  // Queue management
  joinQueue(playerId, gameId) {
    if (!playerId || !gameId) return { error: 'invalid' };
    const q = this.queue.get(gameId) || [];
    if (!q.includes(playerId)) q.push(playerId);
    this.queue.set(gameId, q);
    this.tryMatch(gameId);
    return { queued: true, position: q.length };
  }

  leaveQueue(playerId, gameId) {
    const q = this.queue.get(gameId);
    if (!q) return { left: false };
    const idx = q.indexOf(playerId);
    if (idx !== -1) q.splice(idx, 1);
    return { left: idx !== -1 };
  }

  tryMatch(gameId) {
    const q = this.queue.get(gameId);
    while (q && q.length >= this.matchSize) {
      const players = q.splice(0, this.matchSize);
      const matchId = uuidv4();
      const match = {
        id: matchId,
        gameId,
        status: 'ready',
        players: players.map((id) => ({ id, claimed: false })),
        moves: [],
        turn: 0
      };
      this.matches.set(matchId, match);
      this.emit('match_ready', match);
    }
  }

  // Match lifecycle
  claimMatch(matchId, playerId) {
    const match = this.matches.get(matchId);
    if (!match) return { error: 'not_found' };
    const player = match.players.find((p) => p.id === playerId);
    if (!player) return { error: 'not_in_match' };
    player.claimed = true;
    if (match.players.every((p) => p.claimed)) {
      this.startMatch(matchId);
    }
    return { success: true };
  }

  startMatch(matchId) {
    const match = this.matches.get(matchId);
    if (!match) return { error: 'not_found' };
    if (match.status !== 'ready') return { error: 'invalid_state' };
    match.status = 'active';
    match.players.forEach((p) => this.resetAfkTimer(match, p.id));
    this.emit('match_started', match);
    return { success: true };
  }

  resetAfkTimer(match, playerId) {
    const player = match.players.find((p) => p.id === playerId);
    if (!player) return;
    clearTimeout(player.afkTimer);
    player.deadline = Date.now() + this.afkTimeout;
    player.afkTimer = setTimeout(() => {
      this.forfeit(match.id, playerId);
    }, this.afkTimeout);
  }

  submitMove(matchId, playerId, move) {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'active') return { error: 'not_active' };
    const current = match.players[match.turn % match.players.length];
    if (current.id !== playerId) {
      return { error: 'not_your_turn' };
    }
    match.moves.push({ playerId, move });
    match.turn++;
    match.players.forEach((p) => this.resetAfkTimer(match, p.id));
    this.emit('move', { match, playerId, move });
    return { success: true };
  }

  endMatch(matchId, winnerId = null, reason = 'completed') {
    const match = this.matches.get(matchId);
    if (!match) return { error: 'not_found' };
    match.status = 'ended';
    match.winner = winnerId;
    match.reason = reason;
    match.players.forEach((p) => clearTimeout(p.afkTimer));
    this.emit('match_ended', match);
    this.matches.delete(matchId);
    return { success: true };
  }

  forfeit(matchId, playerId) {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'active') return { error: 'not_active' };
    const winner = match.players.find((p) => p.id !== playerId)?.id || null;
    return this.endMatch(matchId, winner, 'forfeit');
  }

  rejoinMatch(matchId, playerId) {
    const match = this.matches.get(matchId);
    if (!match) return { error: 'not_found' };
    this.resetAfkTimer(match, playerId);
    return { success: true };
  }

  getState(matchId) {
    const match = this.matches.get(matchId);
    if (!match) return null;
    return {
      id: match.id,
      gameId: match.gameId,
      status: match.status,
      turn: match.turn,
      moves: match.moves,
      players: match.players.map((p) => ({ id: p.id }))
    };
  }

  tick() {
    for (const match of this.matches.values()) {
      if (match.status !== 'active') continue;
      const current = match.players[match.turn % match.players.length];
      const remaining = Math.max(0, current.deadline - Date.now());
      this.emit('timer', {
        matchId: match.id,
        playerId: current.id,
        remaining
      });
    }
  }
}
