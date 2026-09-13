import {
  LUDO_TOKEN_COUNT,
  LUDO_GOAL_PROGRESS,
  getLudoMovableTokens,
  getLudoCaptureVictims
} from '../../shared/ludoBattleRules.js';
export { LUDO_TOKEN_COUNT, LUDO_GOAL_PROGRESS };

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
    return getLudoMovableTokens(this.progress[playerIndex], roll);
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
    const captures = getLudoCaptureVictims(
      this.progress, playerIndex, to, this.players.map((_, seat) => seat * 13)
    );
    captures.forEach(({ player, token: capturedToken }) => {
      this.progress[player][capturedToken] = -1;
    });

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
