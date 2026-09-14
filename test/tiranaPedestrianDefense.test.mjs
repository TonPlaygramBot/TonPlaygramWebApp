import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPedestrianDefense, pedestrianDefenseIntent } from '../webapp/src/games/tiranastreets/shared/pedestrianDefense.mjs';

const civilian = (overrides = {}) => ({ id: 'citizen-1', kind: 'civilian',
  motion: 'walk', health: 80, weapon: null, x: 0, z: 0, ...overrides });
const player = (overrides = {}) => ({ id: 'player', health: 100, weapon: null,
  x: 1, z: 0, carId: null, aircraftId: null, ...overrides });
function scene(overrides) {
  const n = civilian(overrides), p = player(), state = { elapsed: 10, players: {} };
  state.players[p.id] = p;
  return { n, p, state };
}
const clear = () => true;

test('pedestrians never attack an unprovoking player', () => {
  const { n, state } = scene();
  for (const time of [0, 10, 100]) {
    state.elapsed = time;
    assert.equal(pedestrianDefenseIntent(n, state, clear), null);
  }
  assert.equal(n.punchedAt, undefined);
});

test('registration requires an actual nearby unarmed, living on-foot player and melee-sized damage', () => {
  for (const overrides of [{ kind: 'gang' }, { health: 0 }, { id: undefined },
    { id: '' }, { weapon: 'ak47VolleyAttack' }, { carId: 'car' },
    { aircraftId: 'jet' }, { x: 2.201 }, { x: NaN }, { failed: true }, { finished: true }]) {
    const n = civilian();
    assert.equal(registerPedestrianDefense(n, player(overrides), 10, 10), false, JSON.stringify(overrides));
    assert.equal(n.defenseAttackerId, undefined);
  }
  for (const amount of [-1, 0, 35.01, Infinity, NaN]) {
    assert.equal(registerPedestrianDefense(civilian(), player(), amount, 10), false);
  }
  for (const weapon of [null, undefined, 'punch']) {
    assert.equal(registerPedestrianDefense(civilian(), player({ weapon, x: 2.2 }), 35, 10), true);
  }
});

test('children, cyclists, drivers, injured civilians and other NPC kinds keep fleeing', () => {
  for (const overrides of [{ role: 'child' }, { motion: 'cycle' }, { motion: 'drive' },
    { kind: 'gang' }, { health: 39 }, { health: 0 }, { carId: 'car' },
    { aircraftId: 'heli' }, { custody: true }, { weapon: 'pistol' }]) {
    assert.equal(registerPedestrianDefense(civilian(overrides), player(), 10, 10), false);
  }
  assert.equal(registerPedestrianDefense(civilian({ health: 40 }), player(), 10, 10), true);
});

test('counterattacks have a visible windup, bounded cadence, and never apply damage in the intent helper', () => {
  const { n, p, state } = scene();
  assert.equal(registerPedestrianDefense(n, p, 12, state.elapsed), true);
  assert.deepEqual(pedestrianDefenseIntent(n, state, clear), { target: p, strike: false });
  state.elapsed = 10.299;
  assert.equal(pedestrianDefenseIntent(n, state, clear).strike, false);
  state.elapsed = 10.31;
  assert.equal(pedestrianDefenseIntent(n, state, clear).strike, true);
  assert.equal(n.punchedAt, state.elapsed);
  assert.equal(n.nextCounterAt, 11.21);
  assert.equal(p.health, 100);
  state.elapsed = 11.20;
  assert.equal(pedestrianDefenseIntent(n, state, clear).strike, false);
  state.elapsed = 11.22;
  assert.equal(pedestrianDefenseIntent(n, state, clear).strike, true);
  assert.equal(p.health, 100);
});

test('repeated blows cannot restart the windup or accelerate a pending counterattack', () => {
  const { n, p, state } = scene();
  registerPedestrianDefense(n, p, 10, state.elapsed);
  state.elapsed = 10.2;
  registerPedestrianDefense(n, p, 10, state.elapsed);
  assert.equal(n.nextCounterAt, 10.3);
  state.elapsed = 10.31;
  assert.equal(pedestrianDefenseIntent(n, state, clear).strike, true);
  state.elapsed = 10.4;
  registerPedestrianDefense(n, p, 10, state.elapsed);
  assert.equal(pedestrianDefenseIntent(n, state, clear).strike, false);
  assert.equal(n.nextCounterAt, 11.21);
});

test('only the registered player can be targeted and blocked sight never permits a strike', () => {
  const { n, p, state } = scene();
  registerPedestrianDefense(n, p, 10, state.elapsed);
  state.players.bystander = player({ id: 'bystander', x: 0.1 });
  state.elapsed = 10.5;
  assert.equal(pedestrianDefenseIntent(n, state, () => false), null);
  assert.equal(n.punchedAt, undefined);
  assert.equal(pedestrianDefenseIntent(n, state, clear).target, p);
  assert.equal(n.punchedAt, 10.5);
});

test('pause preserves defense state without striking or consuming the cooldown', () => {
  const { n, p, state } = scene();
  registerPedestrianDefense(n, p, 10, state.elapsed);
  const before = { ...n };
  state.elapsed = 10.5;
  state.paused = true;
  assert.equal(pedestrianDefenseIntent(n, state, clear), null);
  assert.deepEqual(n, before);
  state.paused = false;
  assert.equal(pedestrianDefenseIntent(n, state, clear).strike, true);
});

test('counterattacks remain bounded at the melee engagement boundary', () => {
  const { n, p, state } = scene();
  registerPedestrianDefense(n, p, 10, state.elapsed);
  state.elapsed = 10.5;
  p.x = 2.4;
  assert.equal(pedestrianDefenseIntent(n, state, clear).strike, true);
  p.x = 2.4001;
  state.elapsed = 11.5;
  assert.equal(pedestrianDefenseIntent(n, state, clear), null);
});

test('drawing a gun, withdrawing, entering transport, death or disappearance permanently cancels defense', () => {
  for (const mutate of [p => p.weapon = 'pistol', p => p.x = 2.401,
    p => p.health = 0, p => p.carId = 'car', p => p.aircraftId = 'jet',
    (p, state) => delete state.players[p.id],
    (p, state) => state.players[p.id] = player({ id: 'impostor' })]) {
    const { n, p, state } = scene();
    registerPedestrianDefense(n, p, 10, state.elapsed);
    mutate(p, state);
    state.elapsed = 10.5;
    assert.equal(pedestrianDefenseIntent(n, state, clear), null);
    assert.equal(n.defenseAttackerId, null);
    state.players.player = player();
    state.elapsed = 11;
    assert.equal(pedestrianDefenseIntent(n, state, clear), null);
  }
});

test('defense ends after four seconds or if the pedestrian is badly hurt', () => {
  for (const mutate of [(n, state) => state.elapsed = 14, n => n.health = 39]) {
    const { n, p, state } = scene();
    registerPedestrianDefense(n, p, 10, state.elapsed);
    mutate(n, state);
    assert.equal(pedestrianDefenseIntent(n, state, clear), null);
    assert.equal(n.defenseAttackerId, null);
  }
});

test('personality is stable across peers and most civilians choose flight', () => {
  const responders = [];
  for (let i = 0; i < 16; i++) {
    const id = `citizen-${i}`;
    const a = registerPedestrianDefense(civilian({ id }), player(), 10, 10);
    const b = registerPedestrianDefense(civilian({ id }), player(), 10, 10);
    assert.equal(a, b, id);
    if (a) responders.push(id);
  }
  assert.ok(responders.length > 0 && responders.length < 8);
  assert.ok(responders.includes('citizen-1'));
  assert.ok(!responders.includes('citizen-0'));
});
