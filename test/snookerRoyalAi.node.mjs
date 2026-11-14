import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Vector2 } from '../webapp/node_modules/three/build/three.module.js';
import { build } from 'esbuild';
import { snookerAiColor, snookerAiMatchesTarget, snookerAiLaneClear, snookerAiNextTargets,
  scoreSnookerAiPosition, selectSnookerAiPlans } from '../webapp/src/pages/Games/snookerRoyalAi.js';

const bundle = await build({ entryPoints: ['src/rules/SnookerRoyalRules.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { SnookerRoyalRules } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rules = new SnookerRoyalRules();
const ball = (id, x, y) => ({ id, active: true, pos: new Vector2(x, y) });
const radius = 0.5;
const pockets = [{ x: -10, y: -20, id: 'TL' }, { x: 10, y: -20, id: 'TR' },
  { x: -10, y: 20, id: 'BL' }, { x: 10, y: 20, id: 'BR' },
  { x: -10, y: 0, id: 'TM' }, { x: 10, y: 0, id: 'BM' }];
const config = { radius, width: 20, height: 40, limitX: 9.5, limitY: 19.5, pockets, cueId: 'cue' };
// Circle sweep comparable to the live first-ball test. A blocked lane must
// hit the obstacle even when the candidate claims another target.
function trace(cue, direction, balls) {
  let result = { tHit: Infinity, targetBall: null };
  const dir = direction.clone().normalize();
  for (const target of balls) {
    if (target === cue || target.id === cue.id || !target.active) continue;
    const relative = target.pos.clone().sub(cue.pos), projection = relative.dot(dir);
    const offsetSq = relative.lengthSq() - projection ** 2;
    if (projection <= 0 || offsetSq > (radius * 2) ** 2 + 1e-8) continue;
    const distance = projection - Math.sqrt(Math.max(0, (radius * 2) ** 2 - offsetSq));
    if (distance < result.tHit) result = { targetBall: target, tHit: distance, impact: cue.pos.clone().addScaledVector(dir, distance) };
  }
  return result;
}
const state = () => { const s = rules.getInitialFrame('A', 'B'); s.meta.state.ballInHand = false; return s; };
const select = (balls, s = state(), extra = {}) => selectSnookerAiPlans({ ...config, cue: balls[0], balls, state: s, rules, trace,
  powerFromDistance: d => 0.3 + Math.min(d / 100, 0.5), ...extra });

test('snooker colour clearance distinguishes blue from yellow and red identifiers', () => {
  assert.equal(snookerAiMatchesTarget(ball('blue', 0, 0), 'YELLOW'), false);
  assert.equal(snookerAiMatchesTarget(ball('yellow', 0, 0), 'BLUE'), false);
  assert.equal(snookerAiMatchesTarget(ball('red12', 0, 0), 'RED'), true);
  assert.equal(snookerAiColor('RED_12'), 'RED');
  assert.equal(snookerAiMatchesTarget({ id: 'cue' }, 'RED'), false);
});

test('swept route rejects overlap missed by the old 1.65-radius clearance', () => {
  assert.equal(snookerAiLaneClear(new Vector2(0, 0), new Vector2(8, 0), [ball('black', 4, 0.9)], radius), false);
  assert.equal(snookerAiLaneClear(new Vector2(0, 0), new Vector2(8, 0), [ball('black', 4, 1.1)], radius), true);
});

test('rules drive red-to-colour, colour-to-red, last red and ordered-colour positioning', () => {
  const cue = ball('cue', -4, 0), red = ball('red_1', 4, 0), secondRed = ball('red_2', -2, 10);
  const yellow = ball('yellow', -3, -12), green = ball('green', 3, -12), black = ball('black', 0, 15);
  const balls = [cue, red, secondRed, yellow, green, black];
  const next = (s, targetBall) => snookerAiNextTargets({ rules, state: s, balls, cue, plan: { targetBall, pocketId: 'BM' } });
  assert.deepEqual(next(state(), red).map(b => b.id), ['yellow', 'green', 'black']);
  const onColour = state(); onColour.colorOnAfterRed = true; onColour.ballOn = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];
  assert.deepEqual(next(onColour, black).map(b => b.id), ['red_1', 'red_2']);
  const lastRed = state(); lastRed.redsRemaining = 1;
  assert.deepEqual(next(lastRed, red).map(b => b.id), ['yellow', 'green', 'black']);
  const ordered = state(); ordered.phase = 'COLORS_ORDER'; ordered.redsRemaining = 0; ordered.ballOn = ['YELLOW'];
  assert.deepEqual(next(ordered, yellow).map(b => b.id), ['green']);
  assert.equal(next(ordered, black), null, 'illegal pot cannot be rewarded for its leave');
});

test('open red pot is exact, bounded, deterministic and plans the next colour on the first visit shot', () => {
  const cue = ball('cue', -4, 0), red = ball('red_1', 4, 0), black = ball('black', -1, 9);
  const first = select([cue, red, black]), second = select([cue, red, black]);
  assert.ok(first.bestPot);
  assert.equal(first.bestPot.targetBall, red);
  assert.deepEqual(first.bestPot.aiMeta.nextBallIds, ['black']);
  assert.equal(first.bestPot.aimDir.x, second.bestPot.aimDir.x);
  assert.equal(first.bestPot.power, second.bestPot.power);
  assert.ok(first.bestPot.power >= 0.25 && first.bestPot.power <= 0.9);
  assert.equal(first.bestPot.spin.x, 0);
  assert.equal(trace(cue, first.bestPot.aimDir, [cue, red, black]).targetBall, red);
});

test('yellow clearance never selects the tempting blue and obstructed pots cannot survive selection', () => {
  const cue = ball('cue', -4, 0), blue = ball('blue', 4, 0), yellow = ball('yellow', -5, -7);
  const s = state(); s.phase = 'COLORS_ORDER'; s.redsRemaining = 0; s.ballOn = ['YELLOW'];
  const options = select([cue, blue, yellow], s);
  for (const plan of [options.bestPot, options.bestSafety].filter(Boolean)) {
    assert.equal(plan.targetBall, yellow);
    assert.equal(trace(cue, plan.aimDir, [cue, blue, yellow]).targetBall, yellow);
  }
  const red = ball('red_1', 4, 0), blocker = ball('black', 0, 0);
  const blocked = select([cue, red, blocker], state(), { pockets: [{ x: 10, y: 0, id: 'BM' }] });
  assert.equal(blocked.bestPot, null);
});

test('impossible reverse cuts and scratched leaves are rejected', () => {
  const cue = ball('cue', 8, 0), red = ball('red_1', 4, 0);
  const backwards = select([cue, red], state(), { pockets: [{ x: 10, y: 0, id: 'BM' }] });
  assert.equal(backwards.bestPot, null);
  const normalCue = ball('cue', -4, 0);
  const scratched = select([normalCue, red], state(), { pockets: [{ x: 10, y: 0, id: 'BM', radius: 20 }] });
  assert.equal(scratched.bestPot, null);
});

test('positional evaluation requires a clear next-ball pot, not just proximity', () => {
  const next = ball('black', 4, 0), cuePos = new Vector2(-4, 0);
  const direct = { ...config, pockets: [{ x: 10, y: 0 }] };
  assert.ok(scoreSnookerAiPosition(cuePos, [next], [next], direct) > 0.7);
  assert.equal(scoreSnookerAiPosition(cuePos, [next], [next, ball('red_1', 7, 0)], direct), 0);
});

test('full-table search stays bounded and does not mutate the live snapshot', () => {
  const cue = ball('cue', -4, -12);
  const balls = [cue, ...Array.from({ length: 15 }, (_, i) => ball(`red_${i + 1}`, -6 + (i % 5) * 3, 2 + Math.floor(i / 5) * 3)),
    ball('yellow', -3, -12), ball('green', 3, -12), ball('brown', 0, -12), ball('blue', 0, -3), ball('pink', 0, 0), ball('black', 0, 15)];
  const s = state(), before = JSON.stringify({ balls, s });
  let calls = 0;
  const started = performance.now();
  const result = select(balls, s, { trace: (...args) => { calls++; return trace(...args); } });
  assert.ok(result.bestPot || result.bestSafety);
  assert.ok(calls < 250, `bounded live raycasts: ${calls}`);
  assert.equal(JSON.stringify({ balls, s }), before);
  console.log(`22-ball planning ${Math.round(performance.now() - started)} ms, ${calls} live raycasts`);
});

test('free-ball attacks explicitly nominate a substitute; normal legal pots may decline the free ball', () => {
  const cue = ball('cue', -4, 0), black = ball('black', 4, 0), red = ball('red_1', -5, 11);
  const s = state(); s.freeBall = true; s.meta.freeBall = true;
  const options = select([cue, black, red], s, { pockets: [{ x: 10, y: 0, id: 'BM' }] });
  assert.ok(options.bestPot);
  assert.equal(options.bestPot.target, 'BLACK');
  assert.equal(options.bestPot.nomination, 'BLACK');
  const next = snookerAiNextTargets({ rules, state: s, balls: [cue, red, black], cue,
    plan: { targetBall: red, pocketId: 'BM' } });
  assert.deepEqual(next.map(b => b.id), ['black']);
});

test('live SnookerRoyal planner uses material-colour entities and production first-contact geometry', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parse } = await import('@babel/parser');
  const THREE = await import('../webapp/node_modules/three/build/three.module.js');
  const { readSnookerViewMetrics } = await import('../scripts/read-snooker-view-metrics.mjs');
  const source = await readFile(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const wanted = new Set(['evaluateUncachedShotOptions', 'computePowerFromDistance', 'matchesTargetId']);
  const found = new Map();
  let traceSource, idSource;
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && wanted.has(node.id?.name)) found.set(node.id.name, source.slice(node.init.start, node.init.end));
    if (node.type === 'FunctionDeclaration' && node.id.name === 'calcTarget') traceSource = source.slice(node.start, node.end);
    if (node.type === 'FunctionDeclaration' && node.id.name === 'getPoolBallId') idSource = source.slice(node.start, node.end);
    for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end'].includes(key)) {
      if (Array.isArray(value)) value.forEach(visit); else if (value?.type) visit(value);
    }
  };
  visit(ast);
  assert.equal(found.size, wanted.size);
  const metrics = await readSnookerViewMetrics();
  const BALL_R = metrics.ballR, PLAY_W = metrics.playW, PLAY_H = metrics.playL;
  const RAIL_LIMIT_X = PLAY_W / 2 - BALL_R, RAIL_LIMIT_Y = PLAY_H / 2 - BALL_R;
  const getId = new Function(`${idSource}; return getPoolBallId;`)();
  const cue = { ...ball('cue', -PLAY_W * 0.22, 0), color: 0xffffff };
  const red = { ...ball(getId({ id: 'snooker' }, 0), PLAY_W * 0.22, 0), color: 0xff0000 };
  const black = { ...ball('black', 0, PLAY_H * 0.25), color: '#000000' };
  const liveBalls = [cue, red, black];
  const pocketEntranceCenters = () => pockets.map(p => new Vector2(p.x * PLAY_W / 20, p.y * PLAY_H / 40));
  const values = { THREE, BALL_R, PLAY_W, PLAY_H, RAIL_LIMIT_X, RAIL_LIMIT_Y,
    selectSnookerAiPlans, snookerAiMatchesTarget, rules, cue, balls: liveBalls,
    cueRef: { current: cue }, ballsRef: { current: liveBalls },
    frameRef: { current: state() }, frameState: state(), activeVariantRef: { current: { id: 'snooker' } },
    variantKey: 'snooker', careerMatch: null, baulkZ: -PLAY_H * 0.3,
    POCKET_IDS: pockets.map(p => p.id), pocketEntranceCenters,
    resolvePocketEntranceForTarget: (_position, index) => pocketEntranceCenters()[index],
    MAX_ROUTE_DISTANCE: Math.hypot(PLAY_W, PLAY_H) + Math.max(PLAY_W, PLAY_H),
    evaluateShotOptionsBaseline: () => { throw Error('Snooker must not use the pool-alias baseline'); } };
  const planner = new Function(...Object.keys(values), `${traceSource}\n${[...found].map(([name, body]) => `const ${name} = ${body};`).join('\n')}\nreturn { evaluate: evaluateUncachedShotOptions, matchesTargetId, calcTarget };`)(...Object.values(values));
  assert.equal(planner.matchesTargetId({ id: 'blue', color: 0x0000ff }, 'YELLOW'), false);
  const result = planner.evaluate();
  assert.ok(result.bestPot, 'actual red ID + numeric material colour produces a legal attack');
  assert.equal(result.bestPot.targetBall, red);
  assert.deepEqual(result.bestPot.aiMeta.nextBallIds, ['black']);
  assert.equal(planner.calcTarget(cue, result.bestPot.aimDir, liveBalls).targetBall, red);
});

test('AI spin sign follows the production control: negative draws and positive follows', async () => {
  const { mapSpinForPhysics } = await import('../webapp/src/pages/Games/snookerRoyalSpinUtils.js');
  assert.ok(mapSpinForPhysics({ x: 0, y: -0.22 }).y < 0);
  assert.ok(mapSpinForPhysics({ x: 0, y: 0.22 }).y > 0);
});

test('live AI entry and delayed strike cannot shoot during a human turn or after the frame ends', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parse } = await import('@babel/parser');
  const source = await readFile(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let entry, delayed, begin;
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'beginCueView') begin = source.slice(node.init.start, node.init.end);
    if (node.type === 'AssignmentExpression' && node.left?.object?.name === 'aiShoot' && node.left?.property?.name === 'current') entry = source.slice(node.right.start, node.right.end);
    if (node.type === 'CallExpression' && node.callee?.object?.name === 'window' && node.callee?.property?.name === 'setTimeout' && node.arguments[0]?.type === 'ArrowFunctionExpression') {
      const callback = source.slice(node.arguments[0].start, node.arguments[0].end);
      if (callback.includes('fire();') && callback.includes('shootingRef.current')) delayed = callback;
    }
    for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end'].includes(key)) {
      if (Array.isArray(value)) value.forEach(visit); else if (value?.type) visit(value);
    }
  };
  visit(ast);
  assert.ok(entry); assert.ok(delayed); assert.ok(begin);
  // Only the guard dependencies are supplied: continuing into planning throws.
  for (const [enabled, hud] of [[true, { turn: 0 }], [true, { turn: 1, over: true }], [false, { turn: 1 }]]) {
    new Function('disposed', 'aiOpponentEnabled', 'hudRef', `return (${entry});`)(false, enabled, { current: hud })();
  }
  new Function('disposed', 'aiOpponentEnabled', 'hudRef', `return (${entry});`)(true, true, { current: { turn: 1 } })();
  for (const [disposed, hud, shooting] of [[true, { turn: 1 }, false], [false, { turn: 0 }, false], [false, { turn: 1, over: true }, false], [false, { turn: 1 }, true]]) {
    new Function('disposed', 'hudRef', 'shootingRef', `return (${begin});`)(disposed, { current: hud }, { current: shooting })();
  }
  let strikes = 0;
  const hudRef = { current: { turn: 0 } }, shootingRef = { current: false };
  const env = { disposed: false, hudRef, shootingRef, aiShotTimeoutRef: { current: 3 },
    aiCueViewBlendRef: { current: 0 }, AI_CAMERA_DROP_BLEND: 0,
    aiPlanRef: { current: { spin: { x: 0, y: -0.22 } } },
    spinRef: { current: {} }, spinRequestRef: { current: {} },
    applyCameraBlend: () => {}, updateCamera: () => {}, fire: () => {
      strikes++;
      assert.deepEqual(env.spinRef.current, { x: 0, y: -0.22 }, 'planned draw survives preview UI resets at actual strike');
      assert.deepEqual(env.spinRequestRef.current, env.spinRef.current);
    } };
  const callback = new Function(...Object.keys(env), `return (${delayed});`)(...Object.values(env));
  callback(); assert.equal(strikes, 0);
  hudRef.current = { turn: 1, over: true }; callback(); assert.equal(strikes, 0);
  hudRef.current = { turn: 1 }; shootingRef.current = true; callback(); assert.equal(strikes, 0);
  shootingRef.current = false; callback(); assert.equal(strikes, 1);
});
