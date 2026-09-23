import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { SnookerRoyalShotCamera } from '../webapp/src/pages/Games/snookerRoyalShotCamera.ts';
import { PoolRoyalPlayerCamera, applyPoolRoyalPlayerView, POOL_ROYAL_PLAYER_FOV } from '../webapp/src/pages/Games/shared/poolRoyalPlayerCamera.ts';

// Compare the production and playable-preview call sites, including production's
// default orbit blend. Testing a hand-written camera with cueBlend=0 missed this
// regression because the live game actually starts with cueBlend=1.
async function readAst(path, plugins) {
  const source = await readFile(path, 'utf8');
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type) nodes.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc') continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(parse(source, { sourceType: 'module', plugins }).program);
  return { nodes, text: node => source.slice(node.start, node.end),
    variable: name => nodes.find(node => node.type === 'VariableDeclarator' && node.id.name === name) };
}
const [game, preview] = await Promise.all([
  readAst(process.env.POOL_PARITY_GAME_SOURCE || new URL('../webapp/src/pages/Games/PoolRoyale.jsx', import.meta.url), ['jsx']),
  readAst(new URL('../webapp/src/previews/PoolRoyalPlayersPreview.tsx', import.meta.url), ['jsx', 'typescript'])
]);
const implementations = { THREE, PoolRoyalPlayerCamera, SnookerRoyalShotCamera, applyPoolRoyalPlayerView, POOL_ROYAL_PLAYER_FOV };
const evaluate = (ast, node, context) => vm.runInNewContext(`(${ast.text(node)})`, context);
const ref = current => ({ current });
const copyEye = eye => ({ position: eye.position.clone(), target: eye.target.clone(), blend: eye.blend });
const eye = { position: new THREE.Vector3(3, 9, 14), target: new THREE.Vector3(-1, 4, -6), blend: 1 };
const overlay = game.variable('updateCamera').init.body.body.find(node =>
  node.type === 'IfStatement' && node.test.name === 'humanEyePose');
const previewEyeCall = preview.nodes.find(node => node.type === 'CallExpression' &&
  node.callee.object?.name === 'shotCamera' && node.callee.property?.name === 'resolve');
const previewPlayerBranch = preview.nodes.find(node => node.type === 'IfStatement' &&
  preview.text(node.test) === "current.view === 'player' && eye").consequent;

function gameContext(world = new THREE.Group()) {
  const context = { ...implementations, world, activeHumanCueViewRef: ref(copyEye(eye)),
    cueAnimating: false, shootingRef: ref(false), shotImpactPending: false,
    cameraBlendRef: ref(evaluate(game, game.variable('ACTION_CAMERA_START_BLEND').init, {})),
    topViewRef: ref(false), lookModeRef: ref(false), replayPlaybackRef: ref(null),
    cueGalleryStateRef: ref(null), now: 0, humanEyeCamera: new THREE.PerspectiveCamera(),
    STANDING_VIEW_FOV: 66 };
  context.humanShotCamera = evaluate(game, game.variable('humanShotCamera').init, context);
  context.performance = { now: () => context.now };
  context.resolveActiveHumanEyePose = evaluate(game, game.variable('resolveActiveHumanEyePose').init, context);
  context.render = vm.runInNewContext(`(renderCamera, lookTarget) => {
    const humanEyePose = resolveActiveHumanEyePose();
    ${game.text(overlay)}
    return { renderCamera, lookTarget, humanEyePose };
  }`, context);
  return context;
}

function previewFrame(localEye, aspect) {
  const context = { ...implementations, camera: new THREE.PerspectiveCamera(46, aspect, .01, 200),
    players: { eyeView: localEye }, stroke: null, shotTip: { visible: false },
    travel: 0, simulationTime: 0, current: { view: 'player' } };
  context.shotCamera = evaluate(preview, preview.variable('shotCamera').init, context);
  context.eye = evaluate(preview, previewEyeCall, context);
  // Evaluate the existing preview lens selection as well as its player branch.
  const fov = preview.variable('fov');
  if (fov) {
    context.camera.fov = evaluate(preview, fov.init, context);
    context.camera.updateProjectionMatrix();
  }
  vm.runInNewContext(preview.text(previewPlayerBranch), context);
  context.camera.updateMatrixWorld(true);
  return context.camera;
}

function sourceCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(72, aspect, .04, 4000);
  camera.position.set(50, 90, -60); camera.up.set(0, 0, 1);
  camera.zoom = 1.4; camera.filmOffset = 2.3;
  camera.setViewOffset(1000, 1000, 70, 25, 400, 800);
  camera.aspect = aspect; camera.updateProjectionMatrix();
  return camera;
}

test('actual production default and touch-adjusted orbit blends match the playable player lens exactly', () => {
  for (const aspect of [320 / 740, 390 / 844, 412 / 915]) {
    const c = gameContext();
    const expected = previewFrame(copyEye(eye), aspect);
    for (const orbitBlend of [c.cameraBlendRef.current, .2, .55, .94, 0, 1]) {
      c.cameraBlendRef.current = orbitBlend;
      const source = sourceCamera(aspect);
      const before = source.toJSON();
      const result = c.render(source, new THREE.Vector3(5, 2, -1));
      assert.ok(result.humanEyePose, `player view must exist with live orbit blend ${orbitBlend}`);
      assert.notEqual(result.renderCamera, source, 'do not replace the broadcast source transform');
      assert.ok(result.renderCamera.position.distanceTo(expected.position) < 1e-10);
      assert.ok(result.renderCamera.quaternion.angleTo(expected.quaternion) < 1e-7);
      assert.equal(result.renderCamera.fov, expected.fov);
      assert.equal(result.renderCamera.zoom, expected.zoom);
      assert.equal(result.renderCamera.filmOffset, expected.filmOffset);
      assert.ok(!result.renderCamera.view?.enabled, 'stale replay/view offsets cannot crop the player view');
      assert.equal(result.renderCamera.aspect, aspect);
      assert.equal(result.renderCamera.near, source.near);
      assert.equal(result.renderCamera.far, source.far);
      assert.deepEqual(source.toJSON(), before, 'eye rendering leaves the source camera intact');
    }
  }
});

test('portrait screen positions agree between normalized preview and translated/scaled production worlds', () => {
  const aspect = 390 / 844, floorY = -4;
  const normalize = point => point.clone().sub(new THREE.Vector3(0, floorY, 0)).divideScalar(12);
  const previewEye = { position: normalize(eye.position), target: normalize(eye.target), blend: 1 };
  const previewCamera = previewFrame(previewEye, aspect);
  const samples = [eye.target.clone(), new THREE.Vector3(2, 4, 2), new THREE.Vector3(-3, 5, -9)];
  for (const [scale, yaw, translation] of [
    [1, 0, [0, 0, 0]], [.315085, .7, [11, -4, 5]], [.23, -1.2, [-8, 17, 4]]
  ]) {
    const world = new THREE.Group();
    world.scale.setScalar(scale); world.rotation.y = yaw; world.position.fromArray(translation);
    world.updateMatrixWorld(true);
    const c = gameContext(world);
    const result = c.render(sourceCamera(aspect), new THREE.Vector3());
    result.renderCamera.updateMatrixWorld(true);
    assert.ok(result.renderCamera.position.distanceTo(world.localToWorld(eye.position.clone())) < 1e-9);
    for (const sample of samples) {
      const live = world.localToWorld(sample.clone()).project(result.renderCamera);
      const expected = normalize(sample).project(previewCamera);
      assert.ok(Math.abs(live.x - expected.x) * 195 < 1e-6, 'same horizontal phone pixel');
      assert.ok(Math.abs(live.y - expected.y) * 422 < 1e-6, 'same vertical phone pixel');
    }
  }
});

test('manual camera modes remain available and returning to player view ignores stale orbit state', () => {
  const c = gameContext();
  for (const [name, value] of [['topViewRef', true], ['lookModeRef', true],
    ['replayPlaybackRef', {}], ['cueGalleryStateRef', { active: true }]]) {
    c[name].current = value;
    const source = sourceCamera(390 / 844);
    assert.equal(c.render(source, new THREE.Vector3()).renderCamera, source, name);
    c[name].current = null;
    c.cameraBlendRef.current = 1;
    assert.ok(c.render(source, new THREE.Vector3()).renderCamera.position.distanceTo(eye.position) < 1e-10);
  }
  c.activeHumanCueViewRef.current = null;
  assert.equal(c.resolveActiveHumanEyePose(), null, 'the ordinary scene remains usable while the rig loads');
});

test('preview framing remains fixed through the live strike and resumes after broadcast', () => {
  const c = gameContext();
  c.humanShotCamera.beginShot(c.activeHumanCueViewRef.current, c.activeHumanCueViewRef.current);
  c.shootingRef.current = c.cueAnimating = c.shotImpactPending = true;
  c.activeHumanCueViewRef.current.position.set(90, -15, -70);
  c.now = 4500;
  assert.ok(c.resolveActiveHumanEyePose().position.distanceTo(eye.position) < 1e-10);
  c.humanShotCamera.markImpact(c.now);
  c.shotImpactPending = c.cueAnimating = false;
  c.activeHumanCueViewRef.current = null;
  c.now = 5399;
  assert.ok(c.resolveActiveHumanEyePose().position.distanceTo(eye.position) < 1e-10);
  c.topViewRef.current = true; c.now = 5400;
  assert.equal(c.resolveActiveHumanEyePose(), null);
  c.topViewRef.current = false;
  assert.equal(c.resolveActiveHumanEyePose(), null, 'manual view changes do not restart the shot hold');
  c.shootingRef.current = false; c.activeHumanCueViewRef.current = copyEye(eye);
  const restored = c.resolveActiveHumanEyePose();
  assert.ok(restored, 'the next aiming turn restores the player view with the default orbit blend');
  assert.ok(restored.position.distanceTo(eye.position) < 1e-10);
});
