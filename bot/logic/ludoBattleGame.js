export const LUDO_TOKEN_COUNT = 4;
export const LUDO_GOAL_PROGRESS = 57;

const cloneProgress = (progress) => progress.map((row) => [...row]);

export class LudoBattleGame {
  constructor(playerIds = []) {
    this.players = playerIds.map(String);
    this.progress = this.players.map(() => Array(LUDO_TOKEN_COUNT).fill(-1));
    this.turn = 0;
    this.pendingRoll = null;
    this.revision = 0;
    this.winner = null;
  }

  snapshot() {
    return {
      players: [...this.players],
      progress: cloneProgress(this.progress),
      turn: this.turn,
      currentPlayerId: this.players[this.turn] || null,
      pendingRoll: this.pendingRoll,
      revision: this.revision,
      winner: this.winner
    };
  }

  movableTokens(playerIndex, roll = this.pendingRoll) {
    if (!Number.isInteger(roll) || roll < 1 || roll > 6) return [];
    return this.progress[playerIndex].flatMap((value, token) => {
      if (value < 0) return roll === 6 ? [token] : [];
      return value + roll <= LUDO_GOAL_PROGRESS ? [token] : [];
    });
  }

  roll(playerId, random = Math.random) {
    if (this.winner) return { ok: false, error: 'game_finished' };
    if (this.players[this.turn] !== String(playerId)) return { ok: false, error: 'not_your_turn' };
    if (this.pendingRoll != null) return { ok: false, error: 'move_required' };
    const roll = Math.floor(random() * 6) + 1;
    this.pendingRoll = roll;
    this.revision += 1;
    const movableTokens = this.movableTokens(this.turn, roll);
    if (!movableTokens.length) this.advanceTurn(roll === 6);
    return { ok: true, roll, movableTokens, state: this.snapshot() };
  }

  move(playerId, token, expectedRevision) {
    if (this.winner) return { ok: false, error: 'game_finished' };
    if (this.players[this.turn] !== String(playerId)) return { ok: false, error: 'not_your_turn' };
    if (expectedRevision != null && Number(expectedRevision) !== this.revision) {
      return { ok: false, error: 'stale_revision' };
    }
    if (this.pendingRoll == null) return { ok: false, error: 'roll_required' };
    const tokenIndex = Number(token);
    if (!this.movableTokens(this.turn).includes(tokenIndex)) return { ok: false, error: 'illegal_move' };

    const playerIndex = this.turn;
    const roll = this.pendingRoll;
    const from = this.progress[playerIndex][tokenIndex];
    const to = from < 0 ? 0 : from + roll;
    this.progress[playerIndex][tokenIndex] = to;
    const captures = [];
    // Main-track safe cells and home lanes cannot capture. Progress values are
    // converted to the shared 52-cell ring using each seat's 13-cell offset.
    if (to >= 0 && to < 52) {
      const landingCell = (to + playerIndex * 13) % 52;
      const safe = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
      if (!safe.has(landingCell)) {
        this.progress.forEach((tokens, opponent) => {
          if (opponent === playerIndex) return;
          tokens.forEach((value, opponentToken) => {
            if (value >= 0 && value < 52 && (value + opponent * 13) % 52 === landingCell) {
              tokens[opponentToken] = -1;
              captures.push({ player: opponent, token: opponentToken });
            }
          });
        });
      }
    }

    this.pendingRoll = null;
    if (this.progress[playerIndex].every((value) => value === LUDO_GOAL_PROGRESS)) {
      this.winner = this.players[playerIndex];
    } else {
      this.advanceTurn(roll === 6 || captures.length > 0);
    }
    this.revision += 1;
    return { ok: true, player: playerIndex, token: tokenIndex, from, to, roll, captures, state: this.snapshot() };
  }

  advanceTurn(extraTurn) {
    this.pendingRoll = null;
    if (!extraTurn && this.players.length) this.turn = (this.turn + 1) % this.players.length;
  }
}
