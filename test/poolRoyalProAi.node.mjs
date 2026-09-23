import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { createShowoodTableGeometry } from '../webapp/src/pages/Games/shared/poolRoyaleShowoodGeometry.js';
import { poolRoyalAiLaneClear, predictPoolRoyalImpact, simulatePoolRoyalPot, refinePoolRoyalPotPlans, scorePoolRoyalLeave } from '../webapp/src/pages/Games/poolRoyalProAi.js';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';

const m = await readPoolRoyalMetrics();
const geometry = createShowoodTableGeometry({ playWidth: m.playW, playLength: m.playL, ballRadius: m.ballR });
const baseSpeed = 3.3 * .3 * 1.65 * 1.5 * .75 * .85 * .8 * 1.3 * .85 * .425 * 2.109375 * 1.5 * .72 * 1.5 * .98;
const config = { radius: m.ballR, width: m.playW, height: m.playL, baseSpeed, pockets: geometry.pockets, segments: geometry.segments };
const ball = (id, x, y) => ({ id, pos: new THREE.Vector2(x, y), active: true });
const context = (cue, target, others = []) => ({ ...config, cuePos: cue.pos, balls: [cue, target, ...others], nextTargets: () => others });
const plan = (target, pocketIndex) => ({ type: 'pot', targetBall: target, pocketIndex, pocketCenter: new THREE.Vector2(geometry.pockets[pocketIndex].x, geometry.pockets[pocketIndex].y), quality: .9, potChance: .9 });

test('route clearance accounts for the full ball diameter', () => {
  assert.equal(poolRoyalAiLaneClear({ x: 0, y: 0 }, { x: 10, y: 0 }, [ball(4, 5, m.ballR * 1.8)], m.ballR), false);
  assert.equal(poolRoyalAiLaneClear({ x: 0, y: 0 }, { x: 10, y: 0 }, [ball(4, 5, m.ballR * 2.1)], m.ballR), true);
});

test('rollout impact matches the live 3D sphere impulse at thin cuts and with spin', () => {
  for (const angle of [-1, -.4, 0, .65, 1.1]) for (const spin of [-.6, 0, .55]) {
    const n = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const aV = new THREE.Vector3(.03, 0, .8), bV = new THREE.Vector3();
    const aW = new THREE.Vector3(spin, spin * .3, -.1), bW = new THREE.Vector3();
    const rA = n.clone().multiplyScalar(m.ballR), rB = rA.clone().negate();
    const relative = bW.clone().cross(rB).add(bV).sub(aW.clone().cross(rA).add(aV));
    const closing = relative.dot(n), jn = -(1 + .984) * closing / 2;
    const impulse = n.clone().multiplyScalar(jn);
    const tangent = relative.clone().addScaledVector(n, -closing);
    const speed = tangent.length(); tangent.normalize();
    const jt = Math.max(-speed / 7, -.105 * jn);
    const friction = tangent.multiplyScalar(jt);
    aV.sub(impulse).sub(friction); bV.add(impulse).add(friction);
    aW.addScaledVector(rA.clone().cross(friction), -2.5 / m.ballR ** 2);
    bW.addScaledVector(rB.clone().cross(friction), 2.5 / m.ballR ** 2);
    const result = predictPoolRoyalImpact({ velocity: { x: .03, y: .8 }, omega: { x: spin, y: spin * .3, z: -.1 } }, { x: n.x, y: n.z }, m.ballR);
    assert.ok(result);
    for (const [actual, v, w] of [[result.cue, aV, aW], [result.object, bV, bW]]) {
      assert.ok(Math.abs(actual.velocity.x - v.x) < 1e-10);
      assert.ok(Math.abs(actual.velocity.y - v.z) < 1e-10);
      assert.ok(Math.abs(actual.omega.x - w.x) < 1e-10);
      assert.ok(Math.abs(actual.omega.y - w.y) < 1e-10);
      assert.ok(Math.abs(actual.omega.z - w.z) < 1e-10);
    }
  }
});

test('power/spin search makes a clear side-pocket pot and rejects a blocked pot', () => {
  const cue = ball('cue', -8, 0), target = ball(1, 10, 0);
  const pocketIndex = geometry.pockets.findIndex(p => p.type === 'side' && p.x > 0);
  const shot = plan(target, pocketIndex), input = context(cue, target);
  const result = refinePoolRoyalPotPlans([shot], input);
  assert.equal(result.length, 1);
  assert.ok(result[0].aiMeta.predictedSafe);
  assert.ok(result[0].power < .88, 'does not default to excessive power');
  assert.ok(result[0].entrySpeed >= .035);
  assert.equal(simulatePoolRoyalPot(shot, context(cue, target, [ball(2, 0, 0)]), result[0].power, result[0].spin), null);
});

test('straight follow into the same pocket is rejected while controlled draw is available', () => {
  const cue = ball('cue', 8, 0), target = ball(1, 17, 0);
  const pocketIndex = geometry.pockets.findIndex(p => p.type === 'side' && p.x > 0);
  const shot = plan(target, pocketIndex), input = context(cue, target);
  assert.equal(simulatePoolRoyalPot(shot, input, .88, { x: 0, y: .5 }), null);
  const result = refinePoolRoyalPotPlans([shot], input);
  assert.equal(result.length, 1);
  assert.ok(result[0].cueAfter.x < config.width / 2 - m.ballR);
});

test('next legal ball controls positioning and blocked next-shot lanes have no positional reward', () => {
  const cue = ball('cue', -8, -8), target = ball(1, 10, 0), next = ball(2, -12, 13);
  const pocketIndex = geometry.pockets.findIndex(p => p.type === 'side' && p.x > 0);
  const input = context(cue, target, [next]);
  const result = refinePoolRoyalPotPlans([plan(target, pocketIndex)], input);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].aiMeta.nextBallIds, [2]);
  assert.ok(result[0].nextShotScore > 0);
  const surrounded = [ball(3, next.pos.x - m.ballR * 2.01, next.pos.y), ball(4, next.pos.x + m.ballR * 2.01, next.pos.y),
    ball(5, next.pos.x, next.pos.y - m.ballR * 2.01), ball(6, next.pos.x, next.pos.y + m.ballR * 2.01)];
  assert.equal(scorePoolRoyalLeave(result[0].cueAfter, [next], [next, ...surrounded], config), 0);
  assert.deepEqual(refinePoolRoyalPotPlans([plan(target, pocketIndex)], { ...input, nextTargets: () => null }), []);
});

test('live planner asks the real rules for the next legal ball in UK, 8-ball and 9-ball', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parse } = await import('@babel/parser');
  const { build } = await import('esbuild');
  const source = await readFile(new URL('../webapp/src/pages/Games/PoolRoyale.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const names = new Set(['toBallColorId', 'normalizeTargetId', 'parseBallNumber', 'mapNumberToGroup', 'matchesTargetId', 'nextTargets']);
  const definitions = new Map();
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && names.has(node.id?.name)) definitions.set(node.id.name, source.slice(node.init.start, node.init.end));
    for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end'].includes(key)) {
      if (Array.isArray(value)) value.forEach(visit); else if (value?.type) visit(value);
    }
  };
  visit(ast);
  assert.equal(definitions.size, names.size);
  const bundled = await build({ entryPoints: ['src/rules/PoolRoyaleRules.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
  const { PoolRoyaleRules } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  const makeNextTargets = new Function('rules', 'state', 'activeBalls', 'cueBall', 'activeVariantId',
    'const nextTargetCache = new Map();' + [...definitions].map(([name, code]) => `const ${name} = ${code};`).join('\n') + '\nreturn nextTargets;');
  for (const variant of ['uk', '8ball', '9ball']) {
    const rules = new PoolRoyaleRules(variant);
    let state = rules.getInitialFrame('A', 'B');
    if (variant === 'uk') {
      state.meta.state.isOpenTable = false;
      state.meta.state.assignments = { A: 'red', B: 'blue' };
      state.meta.state.ballsOnTable.red = ['red1'];
      state.meta.state.ballsOnTable.blue = ['blue1'];
      state.meta.state.ballsOnTable.black8 = true;
      state.meta.state.mustPlayFromBaulk = false;
      state.ballOn = ['RED'];
    } else {
      state.meta.state.breakInProgress = false; state.meta.breakInProgress = false;
      state.meta.state.ballInHand = false;
      state.meta.state.ballsOnTable = variant === '8ball' ? [7, 8, 12] : [2, 5, 9];
      if (variant === '8ball') state.meta.state.assignments = { A: 'SOLID', B: 'STRIPE' };
      state.ballOn = variant === '8ball' ? ['SOLID'] : ['BALL_2'];
    }
    const cue = ball('cue', 0, 0);
    const target = ball(variant === 'uk' ? 'red1' : variant === '8ball' ? 'ball_7' : 'ball_2', 10, 0);
    const expected = ball(variant === 'uk' ? 'black' : variant === '8ball' ? 'ball_8' : 'ball_5', -12, 8);
    const other = ball(variant === 'uk' ? 'blue1' : variant === '8ball' ? 'ball_12' : 'ball_9', -10, -20);
    const nextTargets = makeNextTargets(rules, state, [cue, target, expected, other], cue, variant);
    const targets = nextTargets({ targetBall: target, target: state.ballOn[0], pocketId: 'TM' });
    assert.ok(targets, `${variant} pot is legal`);
    assert.deepEqual(targets.map(b => b.id), [expected.id], `${variant} next target changes after the pot`);
  }
});
