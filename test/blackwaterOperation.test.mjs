import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { createCanvas } = process.env.BLACKWATER_ENGINE_BUNDLE ? createRequire(import.meta.url)('@napi-rs/canvas') : {};
const { GameEngine } = process.env.BLACKWATER_ENGINE_BUNDLE
  ? await import(process.env.BLACKWATER_ENGINE_BUNDLE)
  : {};
const operationTest = process.env.BLACKWATER_ENGINE_BUNDLE ? test : test.skip;
import {
  lineClear,
  findPath,
  createRng
} from '../webapp/src/games/blackwater/shared/physics.mjs';
import { EXTRACTION } from '../webapp/src/games/blackwater/shared/layout.mjs';
import {
  makeMatch,
  publicMatch,
  sanitizeInput,
  stepMatch
} from '../webapp/src/games/blackwater/shared/match.mjs';

const windowEvents = new EventTarget();
windowEvents.devicePixelRatio = 1;
globalThis.window = windowEvents;
const documentEvents = new EventTarget();
documentEvents.hidden = false;
documentEvents.createElement = () => createCanvas(512, 512);
documentEvents.exitPointerLock = () => {};
globalThis.document = documentEvents;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
function harness() {
  const canvas = createCanvas(390, 844),
    surface = new EventTarget();
  canvas.parentElement = { clientWidth: 390, clientHeight: 844 };
  canvas.addEventListener = () => {};
  canvas.removeEventListener = () => {};
  canvas.style = {};
  canvas.setAttribute = () => {};
  const ctx = canvas.getContext.bind(canvas);
  canvas.getContext = (kind, ...rest) =>
    kind === 'webgl2' ? null : ctx(kind, ...rest);
  const game = new GameEngine(
    canvas,
    surface,
    () => {},
    (message) => {
      throw new Error(message);
    }
  );
  for (const method of Object.getOwnPropertyNames(
    Object.getPrototypeOf(game.audio)
  ))
    if (method !== 'constructor') game.audio[method] = () => {};
  return { game, canvas };
}
const step = (game, n) => {
  for (let i = 0; i < n; i++) game.physics(1 / 60);
};
operationTest(
  'drag directions match the phone screen',
  () => {
    const { game } = harness();
    game.start('ar', 'recruit');
    const yaw = game.yaw,
      pitch = game.pitch;
    game.look(20, 0);
    assert.ok(game.yaw < yaw);
    game.look(0, -20);
    assert.ok(game.pitch > pitch);
    game.dispose();
  }
);
operationTest(
  'the online client consumes authoritative ammo/results and sends neutral input while paused',
  () => {
    const { game } = harness(),
      match = makeMatch([
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' }
      ]);
    match.players.forEach((p) => (p.connected = true));
    const packets = [];
    game.weapon = 'smg';
    game.connectOnline({
      playerId: 'A',
      send: (packet) => {
        packets.push(packet);
        match.players[0].input = sanitizeInput(packet);
      }
    });
    match.players[0].weapon = 'smg';
    match.players[0].ammo = 36;
    const state = (status) => ({
      tableId: 'qa',
      status,
      startsAt: 3500,
      serverNow: 0,
      stake: 100,
      settlement: null,
      ...publicMatch(match)
    });
    game.acceptOnlineState(state('countdown'));
    game.pause();
    game.resume();
    assert.equal(game.input.active, false);
    game.acceptOnlineState(state('playing'));
    assert.equal(game.ammo, 36);
    game.beginFire();
    assert.equal(game.ammo, 36, 'ammunition is server owned');
    stepMatch(match);
    game.acceptOnlineState(state('playing'));
    assert.equal(game.ammo, 35);
    game.input.move = { x: 1, y: -1 };
    game.pause();
    const last = packets.at(-1);
    assert.equal(last.rx, 0);
    assert.equal(last.forward, 0);
    assert.equal(last.fire, false);
    match.done = true;
    match.winnerAccountId = 'A';
    game.acceptOnlineState({
      ...state('finished'),
      settlement: { status: 'paid', amount: 200 }
    });
    assert.equal(game.phase, 'won');
    assert.equal(game.snapshot().online.settlement.amount, 200);
    game.dispose();
  }
);
operationTest(
  'a quick tap fires immediately; pause clears movement and fire; restart resets score and ammunition',
  () => {
    const { game } = harness();
    game.start('ar', 'recruit');
    game.beginFire();
    assert.equal(game.ammo, 29);
    assert.equal(game.shots, 1);
    game.input.move = { x: 1, y: 0 };
    game.pause();
    assert.equal(game.phase, 'paused');
    assert.equal(game.input.firing, false);
    assert.deepEqual(game.input.move, { x: 0, y: 0 });
    game.resume();
    assert.equal(game.phase, 'playing');
    game.start('smg', 'recruit');
    assert.equal(game.ammo, 36);
    assert.equal(game.kills, 0);
    assert.equal(game.score, 0);
    assert.equal(game.enemies.length, 4);
    game.dispose();
  }
);
operationTest(
  'reload completes, ammo is conserved, and firing is blocked during reload',
  () => {
    const { game } = harness();
    game.start('ar', 'recruit');
    game.beginFire();
    game.input.firing = false;
    game.reload();
    game.beginFire();
    game.input.firing = false;
    assert.equal(game.ammo, 29);
    step(game, 105);
    assert.equal(game.ammo, 30);
    assert.equal(game.reserve, 149);
    game.dispose();
  }
);
operationTest(
  'health loss, field treatment, defeat and replay are complete states',
  () => {
    const { game } = harness();
    game.start('ar', 'recruit');
    game.damage(45);
    assert.equal(game.health, 55);
    game.heal();
    assert.equal(game.health, 100);
    assert.equal(game.medkits, 0);
    game.damage(200);
    assert.equal(game.phase, 'lost');
    game.start('ar', 'recruit');
    assert.equal(game.phase, 'playing');
    assert.equal(game.health, 100);
    assert.equal(game.medkits, 1);
    game.dispose();
  }
);
operationTest(
  'real scene constructs and compatibility renderer produces a frame',
  () => {
    const { game, canvas } = harness();
    game.start('ar', 'recruit');
    game.updateCamera(1 / 60);
    const t = performance.now();
    game.renderer.render(game.scene, game.camera);
    const duration = performance.now() - t;
    const data = canvas.getContext('2d').getImageData(190, 420, 10, 10).data;
    assert.ok(data.some((v, i) => i % 4 !== 3 && v > 15));
    console.log(
      `Compatibility render: ${duration.toFixed(1)} ms; world obstacles: ${game.world.obstacles.length}`
    );
    game.dispose();
  }
);
operationTest(
  'a deterministic agent clears all waves with normal damage, chooses upgrades, and extracts',
  () => {
    const { game } = harness();
    game.start('ar', 'recruit');
    game.rng = createRng(238);
    let ticks = 0,
      route = [],
      routeCooldown = 0;
    while (game.phase !== 'won' && game.phase !== 'lost' && ticks < 60 * 420) {
      if (game.phase === 'upgrade') {
        game.upgrade('armor');
        route = [];
        routeCooldown = 0;
      }
      if (game.phase !== 'playing') break;
      game.input.firing = false;
      game.input.move = { x: 0, y: 0 };
      game.input.aiming = false;
      if (game.health < 55 && game.medkits > 0) game.heal();
      const living = game.enemies
        .filter((e) => e.hp > 0)
        .sort(
          (a, b) =>
            a.group.position.distanceTo(game.camera.position) -
            b.group.position.distanceTo(game.camera.position)
        );
      const visible = living.find((e) =>
        lineClear(
          game.camera.position,
          game.camera.position
            .clone()
            .set(e.group.position.x, 1.26, e.group.position.z),
          game.world.obstacles
        )
      );
      if (visible) {
        const p = visible.group.position,
          dx = p.x - game.player.x,
          dz = p.z - game.player.z;
        game.yaw = Math.atan2(-dx, -dz);
        game.pitch =
          Math.atan2(1.26 - game.camera.position.y, Math.hypot(dx, dz)) -
          game.recoil;
        game.input.aiming = true;
        game.input.firing = true;
        route = [];
      } else {
        const goal = game.extraction ? EXTRACTION : living[0]?.group.position;
        if (goal) {
          if (--routeCooldown <= 0 || !route.length) {
            route = findPath(game.player, goal, game.world.obstacles);
            routeCooldown = 50;
          }
          let next = route[0] ?? goal;
          const distance = Math.hypot(
            next.x - game.player.x,
            next.z - game.player.z
          );
          if (distance < 0.3) {
            route.shift();
            next = route[0] ?? goal;
          }
          const dx = next.x - game.player.x,
            dz = next.z - game.player.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.15) {
            game.yaw = Math.atan2(-dx, -dz);
            game.pitch = 0;
            game.input.move = { x: 0, y: -1 };
          }
        }
      }
      game.physics(1 / 60);
      ticks++;
    }
    console.log(
      JSON.stringify({
        phase: game.phase,
        kills: game.kills,
        wave: game.wave,
        time: Math.floor(game.elapsed),
        score: game.score,
        health: Math.ceil(game.health),
        shots: game.shots,
        hits: game.hits,
        position: game.player
      })
    );
    assert.equal(game.phase, 'won');
    assert.equal(game.kills, 18);
    assert.equal(game.wave, 3);
    assert.ok(game.score >= 2800);
    game.start('ar', 'recruit');
    assert.equal(game.kills, 0);
    assert.equal(game.wave, 1);
    assert.equal(game.extraction, false);
    game.dispose();
  }
);
