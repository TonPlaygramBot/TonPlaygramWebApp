import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as sim from '../webapp/src/games/kartroyale/simulation.mjs';
import { WEAPONS } from '../webapp/src/games/kartroyale/suppliedWeaponCatalog.mjs';
import * as combat from '../webapp/src/games/kartroyale/raceCombat.mjs';
import * as road from '../webapp/src/games/kartroyale/racingRoadCore.mjs';
import {
  racingVegetationSites,
  footprintFits,
  VEGETATION_BUDGETS
} from '../webapp/src/games/kartroyale/racingVegetationCore.mjs';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import { clipParkGround } from '../webapp/src/games/tirana-environment/parkGroundCore.mjs';
const require = createRequire(
  new URL('../webapp/package.json', import.meta.url)
);
const clipping = require('polygon-clipping');
const area = (polygons) =>
  Math.abs(
    polygons.reduce(
      (sum, polygon) =>
        sum +
        polygon.reduce(
          (s, ring) =>
            s +
            ring
              .slice(1)
              .reduce(
                (a, p, i) => a + (ring[i][0] * p[1] - p[0] * ring[i][1]) / 2,
                0
              ),
          0
        ),
      0
    )
  );

test('the original Tirana entry point and mode selection are preserved byte for byte', () => {
  for (const [file, expected] of [
    ['KartRoyale.tsx', 'dc5ef155f798e1680eec12f5102356418464bea8'],
    ['racingModeCore.mjs', '331d1a0e5f19ae756839495b470aaeccff7887b7']
  ]) {
    const b = readFileSync(
      new URL('../webapp/src/games/kartroyale/' + file, import.meta.url)
    );
    assert.equal(
      createHash('sha1')
        .update('blob ' + b.length + '\0')
        .update(b)
        .digest('hex'),
      expected
    );
  }
});
for (const config of sim.TRACKS)
  test(
    config.id + ': joined road, curbs, tires and city facades stay clear',
    () => {
      const track = sim.makeTrack(config.id),
        asphalt = road.roadFootprint(track),
        curbs = road.roadCurbFootprint(track);
      assert.equal(track.width, 24);
      assert.ok(area(asphalt) > track.length * 18);
      assert.ok(area(curbs) > 0);
      assert.ok(
        area(clipping.intersection(asphalt, curbs)) < 1e-7,
        'curbs cannot cover asphalt'
      );
      for (const p of track.points)
        assert.equal(
          clipping.intersection(asphalt, [
            [
              [p.x - 0.01, p.z - 0.01],
              [p.x + 0.01, p.z - 0.01],
              [p.x + 0.01, p.z + 0.01],
              [p.x - 0.01, p.z + 0.01]
            ]
          ]).length,
          1
        );
      const tires = road.racingTireLayout(track),
        cells = new Map();
      assert.ok(tires.length > 2000);
      for (const p of tires) {
        assert.ok(
          road.centerlineDistance(track, p.x, p.z) -
            track.width / 2 -
            road.TIRE_RADIUS >
            0.49,
          'tire edge must clear asphalt and curb'
        );
        assert.ok(
          Math.abs(p.distance / p.spacing - 0.5 - p.seed) < 1e-8,
          'uniform arc spacing'
        );
        const x = Math.floor(p.x),
          z = Math.floor(p.z);
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++)
            for (const other of cells.get([x + dx, z + dz].join()) || [])
              assert.ok(
                Math.hypot(p.x - other.x, p.z - other.z) >= 0.695 - 1e-8,
                'tires cannot overlap at turns or seams'
              );
        const key = [x, z].join();
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(p);
      }
      const original = JSON.stringify(WORLD.buildings),
        buildings = road.raceCityBuildings(track, WORLD.buildings);
      for (const b of buildings)
        assert.ok(
          area(clipping.intersection([b.p], road.roadFootprint(track, 1.3))) <
            1e-7
        );
      assert.equal(
        JSON.stringify(WORLD.buildings),
        original,
        'race widening never edits the shared city map'
      );
      const errors = [];
      const parks = clipParkGround(WORLD, track, errors);
      assert.deepEqual(errors, [], 'real map clipping must not discard parks');
      const sites = racingVegetationSites(parks, track);
      assert.ok(sites.trees.length > 50 && sites.grass.length > 500);
      for (const points of Object.values(sites))
        for (const p of points)
          assert.ok(parks.some((poly) => footprintFits(poly, p.x, p.z, 0.1)));
    }
  );

test('all 18 supplied weapon tuning values are retained', () => {
  assert.deepEqual(
    WEAPONS.map((w) => [w.id, w.ammo, w.power, w.speed, w.cooldown]),
    [
      ['shotgun', 6, 2.2, 24, 0.52],
      ['assault', 18, 1.2, 30, 0.18],
      ['pistol', 12, 1, 28, 0.28],
      ['revolver', 8, 1.55, 27, 0.45],
      ['sawed', 5, 2.5, 22, 0.62],
      ['silver', 8, 1.6, 27, 0.42],
      ['longshot', 6, 2.1, 24, 0.52],
      ['pump', 7, 2, 24, 0.5],
      ['smg', 24, 0.85, 31, 0.12],
      ['ak47', 20, 1.35, 30, 0.18],
      ['krsv', 18, 1.25, 30, 0.18],
      ['smith', 10, 1.15, 27, 0.3],
      ['mosin', 5, 3.2, 36, 0.8],
      ['uzi', 26, 0.75, 32, 0.1],
      ['sig', 12, 1.1, 28, 0.28],
      ['awp', 4, 4, 40, 0.95],
      ['mrtk', 12, 1.4, 30, 0.24],
      ['fps', 6, 2.4, 24, 0.58]
    ]
  );
});
function fixture() {
  const track = sim.makeTrack(),
    owner = sim.createRacer(track, 'owner', 'Owner'),
    target = sim.createRacer(track, 'target', 'Target', 1);
  Object.assign(owner, { x: 0, z: 0, yaw: 0, speed: 0 });
  Object.assign(target, { x: 0, z: 12, yaw: 0, speed: 0 });
  const racers = [owner, target],
    state = combat.createCombatState(track);
  state.pickups = [];
  return { track, owner, target, racers, state };
}
test('firing uses finite owned ammunition, travels, and respects cooldown and target range', () => {
  const { track, owner, target, racers, state } = fixture();
  combat.equipCombat(owner, 2);
  assert.equal(combat.fireRaceWeapon(state, owner, racers), true);
  assert.equal(owner.ammunition, 1);
  assert.equal(target.health, 100);
  assert.equal(state.shots.length, 1);
  assert.equal(combat.fireRaceWeapon(state, owner, racers), false);
  assert.equal(owner.ammunition, 1);
  for (let i = 0; i < 100 && state.shots.length; i++)
    combat.stepCombat(state, racers, track, sim.STEP, i * sim.STEP, () => ({
      distance: 0
    }));
  assert.ok(target.health < 100);
  assert.equal(owner.missileHits, 1);
  assert.equal(state.shots.length, 0);
  owner.fireCooldown = 0;
  owner.weaponId = 'awp';
  assert.equal(
    combat.fireRaceWeapon(state, owner, racers),
    false,
    'unowned weapon rejected'
  );
  owner.weaponId = 'pistol';
  target.z = 100;
  assert.equal(
    combat.fireRaceWeapon(state, owner, racers),
    false,
    'out of range'
  );
  target.z = 12;
  owner.inventory[0].ammo = 0;
  assert.equal(
    combat.fireRaceWeapon(state, owner, racers),
    false,
    'empty magazine'
  );
});
test('shots strike an intervening kart and swept movement prevents tunnelling', () => {
  const { track, owner, target, racers, state } = fixture();
  combat.fireRaceWeapon(state, owner, racers);
  const between = sim.createRacer(track, 'between', 'Between', 2);
  Object.assign(between, { x: 0, z: 6, speed: 0 });
  racers.push(between);
  for (let i = 0; i < 100 && state.shots.length; i++)
    combat.stepCombat(state, racers, track, sim.STEP, i * sim.STEP, () => ({
      distance: 0
    }));
  assert.ok(between.health < 100);
  assert.equal(target.health, 100);
  assert.notEqual(
    combat.shotContact(
      { x: -10, z: 0 },
      { x: 10, z: 0 },
      { x: 0, z: 3 },
      { x: 0, z: -3 }
    ),
    null
  );
});
test('passive and active shields absorb hits; disabled karts repair without earning a lap', () => {
  const track = sim.makeTrack(),
    weapon = WEAPONS.find((w) => w.id === 'pistol');
  const bare = sim.createRacer(track, 'b', 'Bare'),
    passive = sim.createRacer(track, 'p', 'Passive'),
    active = sim.createRacer(track, 'a', 'Active');
  bare.shield = 0;
  active.shieldActive = true;
  [bare, passive, active].forEach((r) => combat.applyWeaponHit(r, weapon));
  assert.ok(active.health > passive.health && passive.health > bare.health);
  const crash = sim.createRacer(track, 'c', 'Crash');
  crash.shieldActive = true;
  sim.damageRacer(crash, 10);
  assert.equal(crash.health, 98);
  assert.equal(crash.shield, 72);
  bare.health = 1;
  const progress = {
    lap: bare.lap,
    gates: bare.gates,
    nextGate: bare.nextGate
  };
  combat.applyWeaponHit(bare, weapon);
  assert.equal(bare.retired, false);
  assert.equal(bare.respawn, 2.2);
  for (let i = 0; i < 134 && bare.respawn > 0; i++)
    sim.stepRacer(bare, bare.input, track, sim.STEP, i * sim.STEP);
  assert.equal(bare.health, 75);
  assert.equal(bare.respawn, 0);
  assert.deepEqual(
    { lap: bare.lap, gates: bare.gates, nextGate: bare.nextGate },
    progress
  );
});
test('pickups respawn, repairs are bounded, and snapshots cannot mutate simulation state', () => {
  const { track, owner, target, racers, state } = fixture();
  const p = {
    id: 0,
    weaponId: 'uzi',
    x: 0,
    z: 0,
    yaw: 0,
    cooldown: 0,
    special: false
  };
  state.pickups = [p];
  owner.input.weaponId = 'awp';
  combat.stepCombat(state, racers, track, sim.STEP, 1, () => ({ distance: 0 }));
  assert.equal(owner.weaponId, 'pistol');
  assert.equal(owner.inventory.find((w) => w.id === 'uzi').ammo, 26);
  assert.equal(p.cooldown, 10);
  combat.stepCombat(state, racers, track, sim.STEP, 1, () => ({ distance: 0 }));
  assert.equal(owner.inventory.find((w) => w.id === 'uzi').ammo, 26);
  p.cooldown = 0;
  owner.input.weaponId = 'uzi';
  combat.stepCombat(state, racers, track, sim.STEP, 1, () => ({ distance: 0 }));
  assert.equal(owner.weaponId, 'uzi');
  assert.equal(owner.ammunition, 52);
  owner.health = 95;
  owner.boost = 90;
  p.special = true;
  p.cooldown = 0;
  combat.stepCombat(state, racers, track, sim.STEP, 1, () => ({ distance: 0 }));
  assert.equal(owner.health, 100);
  assert.equal(owner.boost, 100);
  const snap = combat.combatSnapshot(racers, track);
  snap.pickups[0].cooldown = 999;
  assert.equal(combat.raceCombat(racers, track).pickups[0].cooldown, 0);
  assert.equal(combat.validWeaponId('__proto__'), '');
  assert.equal(combat.validWeaponId({ id: 'uzi' }), '');
});
test('vegetation is deterministic, bounded and keeps its full footprint out of holes and roads', () => {
  const polygon = [
    [
      [0, 0],
      [240, 0],
      [240, 240],
      [0, 240],
      [0, 0]
    ],
    [
      [90, 90],
      [90, 150],
      [150, 150],
      [150, 90],
      [90, 90]
    ]
  ];
  const track = {
    width: 24,
    points: [
      { x: 0, z: 35 },
      { x: 240, z: 35 },
      { x: 240, z: 55 },
      { x: 0, z: 55 }
    ]
  };
  const a = racingVegetationSites([polygon], track),
    b = racingVegetationSites([polygon], track);
  assert.deepEqual(a, b);
  const radii = { trees: 5.2, shrubs: 1.9, grass: 0.75, flowers: 0.65 };
  for (const kind of Object.keys(a)) {
    assert.ok(a[kind].length > 0 && a[kind].length <= VEGETATION_BUDGETS[kind]);
    for (const p of a[kind]) {
      assert.ok(footprintFits(polygon, p.x, p.z, radii[kind]));
      assert.ok(
        road.centerlineDistance(track, p.x, p.z) >=
          track.width / 2 + radii[kind]
      );
    }
  }
});
test('new local kart and all weapon presentation models are shipped', () => {
  for (const name of [
    'apex',
    'apex-lod',
    'kenney-oobi',
    'kenney-oodi',
    'kenney-ooli',
    'kenney-oopi',
    'kenney-oozi'
  ]) {
    const bytes = readFileSync(
      new URL(
        '../webapp/public/assets/kart-royale/' + name + '.glb',
        import.meta.url
      )
    );
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
  }
  for (const name of [
    'shotgun',
    'q-rifle',
    'q-pistol',
    'q-shotgun',
    'q-smg',
    'ak47',
    'krsv',
    'smith',
    'mosin',
    'uzi',
    'sigsauer',
    'q-marksman'
  ])
    assert.ok(
      existsSync(
        new URL(
          '../webapp/public/assets/tirana-streets/living/' + name + '.glb',
          import.meta.url
        )
      )
    );
});
