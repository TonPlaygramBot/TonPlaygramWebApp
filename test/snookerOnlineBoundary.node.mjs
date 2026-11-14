import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeSnookerActor, isValidSnookerAim, isValidSnookerLayout, validateSnookerShotState
} from '../bot/utils/snookerRealtimeValidation.js';
import { buildSnookerRemoteHud, shouldApplySnookerRevision } from '../webapp/src/pages/Games/snookerRoyalMatchQuality.js';

const table = { gameType: 'snookerroyale', started: true, players: [{ id: 'first' }, { id: 'second' }], currentTurn: 'first' };
const balls = [
  ...Array.from({ length: 15 }, (_, i) => ({ id: `RED_${i + 1}`, color: 'RED', onTable: true, potted: false })),
  ...['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK', 'CUE'].map(color => ({ id: color, color, onTable: true, potted: false }))
];
const initial = () => ({ balls: structuredClone(balls), activePlayer: 'A', players: { A: { score: 0 }, B: { score: 0 } }, phase: 'REDS_AND_COLORS', redsRemaining: 15, ballOn: ['RED'], frameOver: false });
const layout = () => balls.map(ball => ({ id: ball.id.toLowerCase(), active: true, pos: { x: 0, y: 0 }, mesh: null }));

test('only the started table active roster seat may send shots or live frames', () => {
  assert.deepEqual(authorizeSnookerActor(table, {}, 'first'), { ok: true, seat: 'A' });
  assert.equal(authorizeSnookerActor(table, {}, 'second').error, 'not_your_turn');
  assert.equal(authorizeSnookerActor(table, {}, 'outsider').error, 'seat_required');
  assert.equal(authorizeSnookerActor({ ...table, started: false }, {}, 'first').ok, false);
  assert.equal(authorizeSnookerActor({ ...table, gameType: 'poolroyale' }, {}, 'first').ok, false);
});

test('accepted next active seat governs ownership, independent of mutable HUD', () => {
  const state = { ...initial(), activePlayer: 'B' };
  assert.equal(authorizeSnookerActor(table, { state }, 'first').error, 'not_your_turn');
  assert.equal(authorizeSnookerActor(table, { state }, 'second').seat, 'B');
  state.frameOver = true;
  assert.equal(authorizeSnookerActor(table, { state }, 'second').error, 'frame_over');
});

test('shot boundary rejects malformed state, nonfinite scores and impossible score resets', () => {
  const state = initial();
  assert.equal(validateSnookerShotState(state), true);
  for (const bad of [
    { ...state, activePlayer: 'C' }, { ...state, redsRemaining: 20 },
    { ...state, balls: state.balls.slice(1) },
    { ...state, players: { A: { score: NaN }, B: { score: 0 } } },
    { ...state, players: { A: { score: 99999 }, B: { score: 0 } } },
    { ...state, frameOver: true }, { ...state, ballOn: ['PINK', {}] }
  ]) assert.equal(validateSnookerShotState(bad), false);
  const previous = initial(); previous.players.A.score = 20;
  assert.equal(validateSnookerShotState(state, previous), false);
});

test('live layout requires all 22 distinct balls and finite coordinates', () => {
  assert.equal(isValidSnookerLayout(layout()), true);
  assert.equal(isValidSnookerLayout([]), false);
  const invalid = layout(); invalid[0].pos.x = Infinity;
  assert.equal(isValidSnookerLayout(invalid), false);
  const duplicate = layout(); duplicate[1].id = duplicate[0].id;
  assert.equal(isValidSnookerLayout(duplicate), false);
  const unknown = layout(); unknown[0].id = 'invented';
  assert.equal(isValidSnookerLayout(unknown), false);
  const wrongCase = layout(); wrongCase[0].id = 'RED_1';
  assert.equal(isValidSnookerLayout(wrongCase), false);
});

test('live aim can be relayed without layout and only contains finite bounded inputs', () => {
  const aim = { dir: { x: 0, y: 1 }, power: 0.6, spin: { x: 0, y: -0.5 }, cueBall: { x: 1, y: 2 } };
  assert.equal(isValidSnookerAim(aim), true);
  assert.equal(isValidSnookerAim({ ...aim, power: 2 }), false);
  assert.equal(isValidSnookerAim({ ...aim, dir: { x: 0, y: 0 } }), false);
  assert.equal(isValidSnookerAim({ ...aim, spin: { x: NaN, y: 0 } }), false);
});

test('remote live HUD cannot enable the waiting player controls or rewrite scores', () => {
  const state = initial(); state.players.A.score = 12;
  const incomingHud = { turn: 0, A: 999, B: 999, inHand: true, over: true };
  const remote = buildSnookerRemoteHud({ state, incomingHud, localSeat: 'B' });
  assert.equal(remote.turn, 1);
  assert.equal(remote.A, 12);
  assert.equal(remote.B, 0);
  assert.equal(remote.inHand, false);
  assert.equal(remote.over, false);
  assert.equal(buildSnookerRemoteHud({ state, incomingHud, localSeat: 'A' }).turn, 0);
});

test('explicit equal-revision resync restores a rejected optimistic result without accepting stale traffic', () => {
  const state = initial();
  assert.equal(shouldApplySnookerRevision({ revision: 12, state }, 12), false);
  assert.equal(shouldApplySnookerRevision({ revision: 12, state, resync: true }, 12), true);
  assert.equal(shouldApplySnookerRevision({ revision: 11, state, resync: true }, 12), false);
  assert.equal(shouldApplySnookerRevision({ revision: 12, resync: true }, 12), false);
  assert.equal(shouldApplySnookerRevision({ revision: Infinity, state, resync: true }, 12), false);
  assert.equal(shouldApplySnookerRevision({ revision: 13, state }, 12), true);
});
