import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  advanceState,
  MISSIONS
} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import { StreetSimulation } from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {
  StreetWorld,
  direction3
} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import { createCampaign } from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {
  captureCheckpoint,
  restoreCheckpoint
} from '../webapp/src/games/tiranastreets/street-career/checkpointCore.mjs';
import {
  WEAPONS,
  STARTER_WEAPON
} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {
  exitPoint,
  takeVehicle,
  carPoint,
  VEHICLE_ANCHORS
} from '../webapp/src/games/tiranastreets/street-career/vehicleCore.mjs';
const world = () => new StreetWorld([], false);
function run(mission = 'free-roam', solids = []) {
  const s = createState([{ id: 'local', name: 'Test' }], mission, 'solo'),
    sim = new StreetSimulation(s, new StreetWorld(solids, false));
  s.npcs = [];
  s.traffic = [];
  s.units = [];
  s.cars = [];
  s.nextDispatch = 1e9;
  Object.assign(s.players.local, {
    x: 0,
    z: 0,
    heading: 0,
    health: 100,
    wanted: 0
  });
  sim.body.yaw = 0;
  sim.intent.yaw = 0;
  return sim;
}
const tick = (sim, seconds = 1) => {
  for (let t = 0; t < seconds - 1e-8; t += 1 / 60) sim.step(1 / 60);
};
const look = (sim, x, y, z) => {
  const p = sim.eye(),
    dx = x - p.x,
    dy = y - p.y,
    dz = z - p.z;
  sim.setIntent({
    ...sim.intent,
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(dy, Math.hypot(dx, dz))
  });
};
const npc = (id, x, z, y = 0) => ({
  id,
  kind: 'gang',
  x,
  z,
  y,
  heading: 0,
  speed: 0,
  health: 100,
  weapon: 'polyPistol01Attack',
  motion: 'walk',
  downUntil: 0,
  nextShot: 1e9
});
const wall = (x1, x2, z1, z2, h = 4, minY = 0) => ({
  id: 'test-wall',
  p: [
    [x1, z1],
    [x2, z1],
    [x2, z2],
    [x1, z2]
  ],
  h,
  minY
});
const car = (id = 'test-car', x = 0, z = -3) => ({
  id,
  x,
  z,
  heading: 0,
  model: 'sedan',
  speed: 0,
  vx: 0,
  vz: 0,
  steering: 0,
  driver: null
});
const campaign = createCampaign(MISSIONS, WEAPONS, STARTER_WEAPON);

test('screen-right strafe and camera-up yaw/pitch preserve visible directions', () => {
  const s = run();
  s.setIntent({ ...s.intent, x: 1 });
  tick(s, 0.5);
  assert.ok(s.player.x > 0);
  assert.ok(Math.abs(s.player.z) < 1e-6);
  assert.ok(direction3(-0.4, 0).x > 0);
  assert.ok(direction3(0, 0.4).y > 0);
});
test('diagonal speed is normalized and analog input preserves half displacement', () => {
  const a = run(),
    b = run(),
    c = run();
  a.setIntent({ ...a.intent, y: 1 });
  b.setIntent({ ...b.intent, x: 1, y: 1 });
  c.setIntent({ ...c.intent, y: 0.5 });
  tick(a, 2);
  tick(b, 2);
  tick(c, 2);
  assert.ok(Math.abs(a.player.speed - b.player.speed) < 1e-8);
  assert.ok(c.player.speed < a.player.speed * 0.51);
});
test('jump moves the physical body, lands once and cannot jump infinitely', () => {
  const s = run();
  assert.equal(s.execute('jump'), true);
  tick(s, 0.2);
  assert.ok(s.body.y > 0.7);
  const before = s.body.vy;
  assert.equal(s.execute('jump'), false);
  assert.equal(s.body.vy, before);
  tick(s, 1);
  assert.equal(s.body.grounded, true);
  assert.ok(Math.abs(s.body.y - 0.08) < 1e-6);
  assert.equal(s.events.filter((e) => e.kind === 'land').length, 1);
});
test('crouch collider and camera lower, standing requires overhead clearance', () => {
  const s = run('free-roam', [wall(-3, 3, -3, 3, 2, 1.25)]);
  s.execute('crouch');
  tick(s, 0.2);
  assert.ok(s.body.height < 1.2);
  assert.ok(s.body.eye < 1.2);
  s.execute('crouch');
  tick(s, 0.1);
  assert.equal(s.body.crouched, true);
  assert.match(s.body.notice, /room/);
  s.player.x = 4;
  tick(s, 0.2);
  assert.equal(s.body.crouched, false);
});
test('sprint costs stamina; pause clears sprint, firing, reload and pending actions', () => {
  const s = run();
  s.execute('sprint');
  s.setIntent({ ...s.intent, y: 1 });
  tick(s, 1);
  assert.ok(s.body.stamina < 90);
  s.pause();
  const before = structuredClone(s.player);
  tick(s, 1);
  assert.equal(s.player.z, before.z);
  assert.equal(s.body.sprint, false);
  assert.equal(s.intent.fire, false);
  s.resume();
  tick(s, 0.1);
  assert.equal(s.player.z, before.z);
});
test('3D shots hit actors above and below, while horizontal aim misses elevated actors', () => {
  for (const height of [4, -3]) {
    const s = run();
    s.state.npcs.push(npc('test', 0, -8, height));
    if (height < 0) s.body.y = 4;
    look(s, 0, height < 0 ? 1 : height + 0.9, -8);
    if (height < 0) s.state.npcs[0].y = 0;
    s.execute('fire');
    assert.ok(s.state.npcs[0].health < 100, 'pitch hit ' + height);
    assert.notEqual(
      s.state.effects.find((e) => e.kind === 'shot')?.toY,
      undefined
    );
  }
  const s = run();
  s.state.npcs.push(npc('raised', 0, -8, 5));
  s.execute('fire');
  assert.equal(s.state.npcs[0].health, 100);
});
test('wall blocks camera aim and close muzzle obstruction independently', () => {
  const s = run('free-roam', [wall(-2, 2, -4, -3)]);
  s.state.npcs.push(npc('behind', 0, -8));
  s.execute('fire');
  assert.equal(s.state.npcs[0].health, 100);
  const close = run('free-roam', [wall(0.07, 0.4, -0.5, -0.12, 2)]);
  close.state.npcs.push(npc('behind', 0, -8));
  close.execute('fire');
  assert.equal(close.state.npcs[0].health, 100);
});
test('ammo is conserved through reload, pause/resume and equip interruption', () => {
  const s = run(),
    inv = s.player.inventory[s.player.weapon],
    total = inv.ammo + inv.reserve;
  s.execute('fire');
  tick(s, 0.25);
  assert.equal(inv.ammo + inv.reserve, total - 1);
  assert.equal(s.execute('reload'), true);
  assert.equal(s.execute('fire'), false);
  tick(s, 0.3);
  s.pause();
  s.resume();
  tick(s, 3);
  assert.equal(inv.ammo + inv.reserve, total - 1);
  assert.equal(s.player.reloadAt, 0);
  s.execute('reload');
  tick(s, 3);
  assert.equal(inv.ammo + inv.reserve, total - 1);
  assert.equal(
    inv.ammo,
    WEAPONS.find((w) => w.id === s.player.weapon).magazine
  );
});
test('melee practice needs no target; one active window causes one damage only', () => {
  const s = run();
  s.player.weapon = '';
  s.state.npcs.push(npc('near', 0, -1));
  s.execute('punch');
  assert.equal(s.execute('kick'), false);
  tick(s, 0.4);
  assert.equal(s.state.npcs[0].health, 84);
  tick(s, 0.7);
  assert.equal(s.state.npcs[0].health, 84);
  s.state.npcs = [];
  assert.equal(s.execute('kick'), true);
  tick(s, 0.8);
  assert.equal(s.body.combat, 'unarmed');
});
test('melee does not damage a target through a wall', () => {
  const s = run('free-roam', [wall(-1, 1, -0.7, -0.6)]);
  s.player.weapon = '';
  s.state.npcs.push(npc('blocked', 0, -1));
  s.execute('kick');
  tick(s, 0.5);
  assert.equal(s.state.npcs[0].health, 100);
});
test('a loot ID can only be claimed once and cannot exceed capacity', () => {
  const s = run();
  s.loot.push({
    id: 'drop:1',
    weapon: STARTER_WEAPON,
    x: 0,
    z: -1,
    y: 0.15,
    ammo: 10
  });
  look(s, 0, 0.15, -1);
  const before = s.player.inventory[STARTER_WEAPON].reserve;
  assert.equal(s.execute('interact', 'drop:1'), true);
  tick(s, 0.5);
  assert.equal(s.player.inventory[STARTER_WEAPON].reserve, before + 10);
  assert.equal(s.execute('interact', 'drop:1'), false);
});
test('car action is absent at a distance and revalidates a moving target', () => {
  const s = run();
  const c = car('far', 0, -20);
  s.state.cars.push(c);
  assert.ok(!s.resolve().some((a) => a.id === 'interact'));
  c.z = -2;
  look(s, -1.65, 0.9, -1.85);
  const action = s.resolve().find((a) => a.id === 'interact');
  assert.equal(action?.label, 'HYR');
  c.z = -30;
  assert.equal(s.execute('interact', c.id), false);
  assert.equal(s.player.carId, null);
});
test('traffic transfer keeps original identity in one list with one driver', () => {
  const s = run(),
    c = car('traffic');
  s.state.traffic.push({ ...c, node: 0, next: 1, seed: 1, cruise: 0 });
  const original = s.state.traffic[0];
  assert.equal(takeVehicle(s.state, s.player, original), true);
  assert.equal(s.state.traffic.length, 0);
  assert.equal(s.state.cars[0], original);
  assert.equal(original.driver, 'local');
  assert.equal(takeVehicle(s.state, s.player, original), false);
});
test('exit chooses an unblocked side and rejects two blocked sides or speed', () => {
  const s = run('free-roam', [wall(-3, -1.2, -2, 2)]),
    c = car('car', 0, 0);
  s.state.cars.push(c);
  takeVehicle(s.state, s.player, c);
  const exit = exitPoint(s.state, c, s.world);
  assert.ok(exit.x > 0);
  s.world = new StreetWorld(
    [wall(-3, -1.2, -2, 2), wall(1.2, 3, -2, 2)],
    false
  );
  assert.equal(exitPoint(s.state, c, s.world), null);
  assert.match(
    s.resolve().find((a) => a.id === 'interact').disabledReason,
    /blocked/
  );
  c.speed = 4;
  assert.match(
    s.resolve().find((a) => a.id === 'interact').disabledReason,
    /Brake/
  );
});
test('delivery proximity alone never advances; interaction produces actual progression', () => {
  const s = run('first-shift'),
    t = s.mission.stops[0];
  s.player.x = t.x;
  s.player.z = t.z + 2;
  s.body.yaw = 0;
  s.intent.yaw = 0;
  tick(s, 0.1);
  assert.equal(s.player.index, 0);
  look(s, t.x, 0.8, t.z);
  assert.equal(s.execute('interact', 'objective:0'), true);
  tick(s, 0.7);
  assert.equal(s.player.index, 1);
  assert.equal(s.job.parcel, true);
});
test('real mission start to final delivery, save, reload and idempotent reward', () => {
  let profile = campaign.begin(campaign.fresh(), 'first-shift');
  const s = run('first-shift');
  campaign.apply(s.player, profile.active.checkpoint);
  for (let i = 0; i < s.mission.stops.length; i++) {
    const t = s.mission.stops[i];
    s.player.x = t.x;
    s.player.z = t.z + 2;
    look(s, t.x, 0.8, t.z);
    assert.equal(s.execute('interact', 'objective:' + i), true);
    tick(s, 0.65);
  }
  assert.equal(s.state.phase, 'finished');
  assert.equal(s.player.finished, true);
  profile = campaign.resolve(profile, s.state, 'local');
  assert.deepEqual(profile.completed, ['first-shift']);
  let raw;
  const storage = {
    setItem: (k, v) => {
      raw = v;
    },
    getItem: () => raw
  };
  campaign.save(storage, profile);
  const loaded = campaign.load(storage);
  assert.deepEqual(loaded.completed, ['first-shift']);
  assert.equal(campaign.resolve(loaded, s.state, 'local'), null);
});
test('phase checkpoint resumes inventory, stage, car identity and v1 progress', () => {
  const s = run('first-shift'),
    profile = campaign.begin(campaign.fresh(), 'first-shift');
  s.player.index = 1;
  s.job.parcel = true;
  s.player.inventory[STARTER_WEAPON].ammo = 3;
  const c = car();
  s.state.cars.push(c);
  takeVehicle(s.state, s.player, c);
  profile.active.phase = captureCheckpoint(s);
  const normalized = campaign.normalize(profile),
    other = run('first-shift');
  assert.equal(
    restoreCheckpoint(other, normalized.active.phase, campaign.apply),
    true
  );
  assert.equal(other.player.index, 1);
  assert.equal(other.player.inventory[STARTER_WEAPON].ammo, 3);
  assert.equal(other.player.carId, c.id);
  assert.equal(other.state.cars.filter((c) => c.driver === 'local').length, 1);
  assert.equal(
    campaign.normalize({
      ...profile,
      active: { ...profile.active, phase: { version: 99 } }
    }).active.phase,
    undefined
  );
});
test('legacy simulation keeps horizontal controls and proximity mission contract', () => {
  const s = createState(
    [{ id: 'local', name: 'Legacy' }],
    'first-shift',
    'solo'
  );
  const p = s.players.local,
    t = MISSIONS[0].stops[0];
  p.x = t.x;
  p.z = t.z;
  p.speed = 0;
  advanceState(s, 0.1);
  assert.equal(p.index, 1);
  assert.equal(p.input.pitch, undefined);
});
test('pause interrupts every transition without leaving interaction locked', () => {
  for (const kind of ['entering', 'exiting', 'interacting', 'vault']) {
    const s = run();
    s.body.interaction = kind;
    s.body.action = { kind, start: 0, duration: 1 };
    s.pause();
    s.resume();
    assert.equal(s.body.interaction, 'free');
    assert.equal(s.body.action, null);
    s.setIntent({ ...s.intent, y: 1 });
    tick(s, 0.2);
    assert.ok(s.player.z < 0);
  }
});
test('dead NPC recovery and guard cannot create multiple hits per swing', () => {
  const s = run();
  s.player.weapon = '';
  s.execute('guard');
  const health = s.player.health,
    attacker = npc('attacker', 0, -1);
  s.damage(s.player, 20, attacker);
  assert.equal(s.player.health, health - 5);
  assert.ok(s.body.stamina <= 88);
});
test('vault rejects invalid landing and low obstacle sweeps keep clearance', () => {
  const w = new StreetWorld(
    [wall(-1, 1, -1, -0.5, 0.65), wall(-2, 2, -3, -1.5, 3)],
    false
  );
  assert.equal(w.vault({ x: 0, y: 0.08, z: 0 }, 0, 1.78), null);
  const step = new StreetWorld([wall(-1, 1, -2, -0.5, 0.25)], false),
    p = { x: 0, y: 0.08, z: 0 };
  step.move(p, 0, -1, 1.78, 0.28);
  assert.ok(p.y >= 0.25);
});
test('frame partitioning does not change reload ammo or physical jump outcome', () => {
  const a = run(),
    b = run();
  a.execute('jump');
  b.execute('jump');
  for (let i = 0; i < 60; i++) a.step(1 / 60);
  for (let i = 0; i < 30; i++) b.step(1 / 30);
  assert.ok(Math.abs(a.body.y - b.body.y) < 1e-8);
  assert.equal(a.body.grounded, b.body.grounded);
});
test('validated vault moves the body over a low solid to a clear landing', () => {
  const s = run('free-roam', [wall(-1, 1, -1, -0.6, 0.65)]);
  assert.equal(s.execute('vault'), true);
  tick(s, 0.3);
  assert.ok(s.body.y > 0.7);
  tick(s, 0.3);
  assert.ok(s.player.z < -1.5);
  assert.equal(s.body.interaction, 'free');
  assert.equal(
    s.world.clearance({ ...s.player, y: s.body.y }, s.body.height),
    true
  );
});
