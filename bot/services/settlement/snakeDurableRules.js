import { createHash } from 'node:crypto';
import { SnakeGame as SnakeGameV1, FINAL_TILE as FROZEN_FINAL_TILE } from './rules/snakeV1.js';
export const SNAKE_JOURNAL_RULES_VERSION = 'snake-server-single-die-v1';
function engine(version, board) {
  if (version !== SNAKE_JOURNAL_RULES_VERSION) throw new Error('unsupported_rules_version');
  return new SnakeGameV1(board);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const journalHash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function need(ok, code) { if (!ok) throw new Error(code); }
export function snakeJournalRulesHash(version, board) {
  need(version === SNAKE_JOURNAL_RULES_VERSION, 'unsupported_rules_version');
  return journalHash({ snakes: board.snakes, ladders: board.ladders, diceCells: board.diceCells, finalTile: FROZEN_FINAL_TILE, version: 1 });
}
function snapshot(game) {
  return { currentTurn: game.currentTurn, finished: game.finished, players: game.players.map(p => ({ ...p })), diceCells: { ...game.diceCells } };
}
function gameFrom(initial, current) {
  const game = engine(initial.rulesVersion, { snakes: structuredClone(initial.board.snakes), ladders: structuredClone(initial.board.ladders), diceCells: structuredClone(current.diceCells) });
  game.players = structuredClone(current.players); game.currentTurn = current.currentTurn; game.finished = current.finished; return game;
}
function validateBoard(board) {
  need(board && typeof board === 'object', 'invalid_initial_board');
  for (const kind of ['snakes', 'ladders', 'diceCells']) {
    const map = board[kind]; need(map && typeof map === 'object' && !Array.isArray(map) && Object.keys(map).length <= 1000, 'invalid_initial_board');
    for (const [from, raw] of Object.entries(map)) {
      const cell = Number(from); const end = kind === 'ladders' && raw && typeof raw === 'object' ? raw.end : raw;
      need(/^[1-9][0-9]*$/.test(from) && Number.isSafeInteger(cell) && cell <= 1000 && Number.isSafeInteger(end), 'invalid_initial_board');
      if (kind === 'diceCells') need(end >= 1 && end <= 6, 'invalid_initial_board');
      else need(cell !== 50 && end >= 0 && end <= (cell < 50 ? 50 : 1000), 'invalid_initial_board');
    }
  }
}
export function initializeSnakeJournal(match, board, turnOrder, at) {
  validateBoard(board);
  need(Array.isArray(turnOrder) && Array.isArray(match.turnOrder) && journalHash(turnOrder) === journalHash(match.turnOrder), 'turn_order_not_accepted');
  need(Array.isArray(turnOrder) && turnOrder.length >= 2 && turnOrder.length <= 4 && new Set(turnOrder).size === turnOrder.length &&
    journalHash([...turnOrder].sort()) === journalHash(match.reservations.map(r => r.accountId).sort()), 'invalid_turn_order');
  need(snakeJournalRulesHash(match.rulesVersion, board) === match.rulesHash && Number.isSafeInteger(at), 'invalid_initial_rules');
  const game = engine(match.rulesVersion, structuredClone(board)); turnOrder.forEach(id => { game.addPlayer(id, id); game.players.at(-1).playerId = id; game.players.at(-1).lastRollTime = 0; });
  const initial = { matchId: match.matchId, roomId: match.roomId, rulesHash: match.rulesHash, rulesVersion: match.rulesVersion, board: structuredClone(board), turnOrder: [...turnOrder] };
  const current = snapshot(game);
  const genesis = { _id: journalHash([match.matchId, 0, 'genesis']), matchId: match.matchId, sequence: 0, kind: 'genesis', at, initial, stateHash: journalHash(current) };
  genesis.hash = journalHash(genesis);
  return { state: { _id: match.matchId, matchId: match.matchId, initial, current, version: 0, lastHash: genesis.hash, updatedAt: at }, genesis };
}
export function applySnakeJournalRoll(state, { actor, requestId, dice, at }) {
  need(!state.current.finished, 'game_already_finished');
  need(Number.isSafeInteger(state.version) && state.version >= 0 && state.version < 10000, 'journal_move_limit');
  need(state.current.players[state.current.currentTurn]?.playerId === actor, 'not_your_turn');
  need(Number.isInteger(dice) && dice >= 1 && dice <= 6, 'invalid_server_die');
  need(Number.isSafeInteger(at) && at >= state.updatedAt, 'invalid_move_time');
  const game = gameFrom(state.initial, state.current);
  need(at - (game.players[game.currentTurn].lastRollTime || 0) >= 1000, 'roll_cooldown');
  game.players[game.currentTurn].lastRollTime = at;
  const result = game.rollDice([dice]); need(result, 'roll_rejected');
  const current = snapshot(game);
  const move = { _id: journalHash([state.matchId, requestId]), matchId: state.matchId, sequence: state.version + 1, kind: 'roll', requestId, actor,
    expectedVersion: state.version, dice, at, previousHash: state.lastHash, result, stateHash: journalHash(current) };
  move.hash = journalHash(move);
  return { state: { ...state, current, version: state.version + 1, lastHash: move.hash, updatedAt: at }, move };
}
export function replaySnakeJournal(match, records, persistedState) {
  need(Array.isArray(records) && records.length > 0 && records.length <= 10001, 'journal_missing_or_too_large');
  const genesis = records[0];
  need(genesis?.kind === 'genesis' && genesis.sequence === 0 && genesis.matchId === match.matchId && genesis.initial.rulesHash === match.rulesHash &&
    genesis.initial.roomId === match.roomId && journalHash(genesis.initial.turnOrder) === journalHash(match.turnOrder), 'journal_genesis_mismatch');
  let { state, genesis: expectedGenesis } = initializeSnakeJournal(match, genesis.initial.board, genesis.initial.turnOrder, genesis.at);
  need(journalHash(genesis) === journalHash(expectedGenesis), 'journal_genesis_corrupt');
  for (let i = 1; i < records.length; i++) {
    const record = records[i]; need(record?.kind === 'roll' && record.sequence === i && record.expectedVersion === i - 1 && record.previousHash === state.lastHash, 'journal_sequence_corrupt');
    const applied = applySnakeJournalRoll(state, { actor: record.actor, requestId: record.requestId, dice: record.dice, at: record.at });
    need(journalHash(record) === journalHash(applied.move), 'journal_move_corrupt'); state = applied.state;
  }
  need(journalHash(state) === journalHash(persistedState), 'journal_snapshot_corrupt');
  return state;
}
export function snakeRoomFromJournal(match, state) {
  need(state.current.finished, 'game_not_finished'); const game = gameFrom(state.initial, state.current);
  return { id: match.roomId, settlementMatchId: match.matchId, gameType: 'snake', status: 'finished', game, players: game.players,
    snakes: state.initial.board.snakes, ladders: state.initial.board.ladders, initialDiceCells: state.initial.board.diceCells };
}

export function captureSnakeJournalResult(match, state) {
  need(match.rulesVersion === SNAKE_JOURNAL_RULES_VERSION && state.initial.rulesVersion === match.rulesVersion, 'unsupported_rules_version');
  need(state.matchId === match.matchId && state.current.finished, 'game_not_finished');
  const players = state.current.players;
  need(players.every(p => Number.isInteger(p.position) && p.position >= 0 && p.position <= FROZEN_FINAL_TILE), 'invalid_result_position');
  const winners = players.filter(p => p.position === FROZEN_FINAL_TILE);
  need(winners.length === 1 && players[state.current.currentTurn] === winners[0], 'invalid_finish_winner');
  const result = { matchId: match.matchId, gameType: 'snake', kind: 'winner', winnerAccountId: winners[0].playerId,
    rulesHash: match.rulesHash, rulesVersion: match.rulesVersion, journalHash: state.lastHash,
    positions: players.map(p => ({ accountId: p.playerId, position: p.position })) };
  const digest = journalHash(result);
  return { ...result, decisionId: `snake-decision:${digest}`, evidenceId: `snake-result:${digest}` };
}
