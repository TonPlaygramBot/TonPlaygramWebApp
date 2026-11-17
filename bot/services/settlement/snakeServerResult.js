import { createHash } from 'node:crypto';
import { SNAKE_FINAL_TILE } from '../../../lib/snakeRules.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function snakeRulesHash({ snakes, ladders, diceCells }) {
  return createHash('sha256').update(JSON.stringify(canonical({ snakes, ladders, diceCells, finalTile: SNAKE_FINAL_TILE, version: 1 }))).digest('hex');
}

/** Trusted in-process GameRoom only. Never call with a socket/HTTP payload. */
export function captureSnakeServerResult(room, match) {
  if (!room || room.gameType !== 'snake' || match.gameType !== 'snake' || room.id !== match.roomId || room.settlementMatchId !== match.matchId ||
      room.status !== 'finished' || room.game?.finished !== true || room.players !== room.game.players) {
    throw new Error('not_server_snake_finish');
  }
  const roster = match.reservations.map(r => r.accountId).sort();
  const actual = room.players.map(p => p.playerId).sort();
  if (actual.length !== roster.length || new Set(actual).size !== actual.length || actual.some((id, i) => id !== roster[i])) {
    throw new Error('result_roster_mismatch');
  }
  if (snakeRulesHash({ snakes: room.snakes, ladders: room.ladders, diceCells: room.initialDiceCells }) !== match.rulesHash) {
    throw new Error('result_rules_mismatch');
  }
  if (room.players.some(p => !Number.isInteger(p.position) || p.position < 0 || p.position > SNAKE_FINAL_TILE)) {
    throw new Error('invalid_result_position');
  }
  const winners = room.players.filter(p => p.position === SNAKE_FINAL_TILE);
  if (winners.length !== 1 || room.players[room.game.currentTurn] !== winners[0]) throw new Error('invalid_finish_winner');
  const result = { matchId: match.matchId, gameType: 'snake', kind: 'winner', winnerAccountId: winners[0].playerId,
    rulesHash: match.rulesHash, positions: Object.freeze(room.players.map(p => Object.freeze({ accountId: p.playerId, position: p.position }))) };
  const digest = createHash('sha256').update(JSON.stringify(canonical(result))).digest('hex');
  // A digest binds stored bytes; it is NOT an authentication signature.
  return Object.freeze({ ...result, evidenceId: `snake-result:${digest}`, decisionId: `snake-decision:${digest}` });
}
