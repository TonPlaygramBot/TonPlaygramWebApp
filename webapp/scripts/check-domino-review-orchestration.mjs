/**
 * Offline check of the real Domino review controller, Ready Player Me mesh/rig,
 * and production motion factory. WebGL/PMREM, DOM canvas, RAF, resize and audio
 * output are stubbed; geometry, skeletons, skin weights and motion are real.
 * This checks orchestration, finite transforms and actual hand-bone camera
 * framing in portrait viewports, not rendered pixels.
 * Run from any directory: node <repo>/webapp/scripts/check-domino-review-orchestration.mjs
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const scriptsDir = dirname(fileURLToPath(import.meta.url));
const app = resolve(scriptsDir, '..');
const {
  build
} = require('esbuild');
const original = fs.readFileSync(resolve(app, 'public/assets/pool-royale/readyplayer.me.glb'));
const jsonLength = original.readUInt32LE(12);
const gltf = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
// Keep all original vertices, skin weights, bones and inverse binds. Only
// image-backed material references are removed for an offline Node loader.
for (const mesh of gltf.meshes || []) for (const primitive of mesh.primitives || []) delete primitive.material;
for (const key of ['materials', 'textures', 'images', 'samplers']) delete gltf[key];
const rawJson = Buffer.from(JSON.stringify(gltf));
const padding = (4 - rawJson.length % 4) % 4;
const json = Buffer.concat([rawJson, Buffer.alloc(padding, 32)]);
const bin = original.subarray(20 + jsonLength);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const packed = gzipSync(Buffer.concat([header, json, bin])).toString('base64');
const fakeThree = `import * as Real from 'real-three';\nexport * from 'real-three';\nexport class WebGLRenderer { constructor(){this.domElement={remove(){}};this.shadowMap={};}setPixelRatio(){}setSize(){}dispose(){}render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);globalThis.__reviewScene=scene;globalThis.__reviewCamera=camera;globalThis.__renderCount++;}}\nexport class PMREMGenerator {constructor(){}fromScene(){return {texture:new Real.Texture(),dispose(){}};}dispose(){}}`;
const result = await build({
  entryPoints: [resolve(scriptsDir, 'domino-royal-motion-preview.tsx')],
  absWorkingDir: app,
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  target: 'es2022',
  logLevel: 'silent',
  define: {
    __DOMINO_REVIEW_MODEL_GZIP__: JSON.stringify(packed)
  },
  plugins: [{
    name: 'offline-render-only',
    setup(build) {
      build.onResolve({
        filter: /^three$/
      }, () => ({
        path: 'three-render-stub',
        namespace: 'render-stub'
      }));
      build.onResolve({
        filter: /^real-three$/
      }, () => ({
        path: require.resolve('three'),
        external: true
      }));
      build.onLoad({
        filter: /.*/,
        namespace: 'render-stub'
      }, () => ({
        contents: fakeThree,
        loader: 'js'
      }));
      build.onLoad({
        filter: /domino-royal-motion-preview\.tsx$/
      }, ({
        path
      }) => {
        let source = fs.readFileSync(path, 'utf8');
        source = source.slice(0, source.indexOf('\nfunction MotionReview()'));
        source = source.replace(/^import React.*\n/m, '').replace(/^import \{ createRoot \}.*\n/m, '').replace('function buildReview(', 'export function buildReview(').replace('  const motion = createProductionDominoMotion(env);', '  globalThis.__reviewEnv = env;\n  const motion = createProductionDominoMotion(env);\n  globalThis.__reviewMotion = motion;');
        return {
          contents: source,
          loader: 'tsx',
          resolveDir: dirname(path)
        };
      });
    }
  }]
});
const temporaryDirectory = fs.mkdtempSync(join(tmpdir(), 'domino-review-orchestration-'));
process.once('exit', () => fs.rmSync(temporaryDirectory, {
  recursive: true,
  force: true
}));
const output = join(temporaryDirectory, 'review-bundle.cjs');
fs.writeFileSync(output, result.outputFiles[0].text);
let clock = 0,
  nextFrame = 1;
const frames = new Map();
globalThis.__renderCount = 0;
Object.defineProperty(globalThis, 'performance', {
  value: {
    now: () => clock
  },
  configurable: true
});
globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = callback => {
  const id = nextFrame++;
  frames.set(id, callback);
  return id;
};
globalThis.cancelAnimationFrame = id => frames.delete(id);
globalThis.ResizeObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
};
const ctx = new Proxy({}, {
  get(target, key) {
    return target[key] ?? (() => {});
  },
  set(target, key, value) {
    target[key] = value;
    return true;
  }
});
globalThis.document = {
  createElement(kind) {
    assert.equal(kind, 'canvas');
    return {
      width: 0,
      height: 0,
      getContext: () => ctx
    };
  }
};
globalThis.self = globalThis;
globalThis.fetch = () => {
  throw new Error('Network access is disabled in this offline check.');
};
globalThis.AudioContext = class {
  sampleRate = 44100;
  destination = {};
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
  createBuffer(channels, length) {
    const data = new Float32Array(length);
    return {
      getChannelData: () => data
    };
  }
  createBufferSource() {
    return {
      connect() {
        return this;
      },
      start() {}
    };
  }
  createGain() {
    return {
      gain: {
        value: 0
      },
      connect() {
        return this;
      }
    };
  }
};
const errors = [];
const savedError = console.error;
console.error = (...args) => {
  errors.push(args);
  savedError(...args);
};
const states = [];
const viewport = { width: 390, height: 600 };
const host = {
  appendChild() {},
  getBoundingClientRect: () => ({ ...viewport })
};
const {
  buildReview
} = require(output);
const engine = buildReview(host, state => states.push({
  ...state
}));
for (let i = 0; i < 1000 && !states.at(-1)?.ready; i++) await new Promise(resolve => setTimeout(resolve, 10));
assert.equal(states.at(-1)?.ready, true, 'Actual avatar must load into preview');
assert.equal(errors.length, 0, 'No initialization errors');
assert.equal(globalThis.__reviewEnv.seatedHumanActors.length, 4);
for (const actor of globalThis.__reviewEnv.seatedHumanActors) {
  assert.ok(actor?.rig?.hips);
  assert.ok(actor.rig.leftHand);
  assert.ok(actor.rig.rightHand);
}
function frame(ms = 16) {
  clock += ms;
  const pending = [...frames.values()];
  frames.clear();
  for (const fn of pending) fn(clock);
}
function finiteScene() {
  frame(0);
  assert.ok(globalThis.__reviewScene);
  let skinned = 0;
  globalThis.__reviewScene.traverse(object => {
    if (object.isSkinnedMesh) skinned++;
    for (const v of [...object.position, ...object.quaternion, ...object.scale]) assert.ok(Number.isFinite(v), 'Nonfinite transform: ' + object.name);
    for (const v of object.matrixWorld.elements) assert.ok(Number.isFinite(v), 'Nonfinite world matrix: ' + object.name);
  });
  assert.ok(skinned >= 4, 'Actual skinned avatar meshes remain present');
}
finiteScene();
console.log('Actual GLB loaded: four complete seated rigs; scene transforms finite.');
let samples = 0;
for (const kind of ['hold', 'place', 'draw', 'knock', 'opening']) {
  engine.select(kind);
  assert.equal(states.at(-1).kind, kind);
  for (const progress of [0, .18, .34, .5, .74, .92, 1]) {
    engine.seek(progress);
    assert.ok(Math.abs(states.at(-1).progress - progress) < 1e-8);
    finiteScene();
    samples++;
  }
  console.log('Actual Engine ' + kind + ': seven seek samples pass; phase=' + states.at(-1).phase);
}
assert.ok(globalThis.__reviewEnv.openingSequence === null, 'Opening completes: ' + JSON.stringify({
  phase: globalThis.__reviewEnv.openingSequence?.phase,
  clock: globalThis.__reviewEnv.dominoMotionTime,
  pendingDraws: globalThis.__reviewEnv.drawAnimations.map(anim => ({
    startTime: anim.startTime,
    duration: anim.duration,
    progress: globalThis.__reviewMotion.sampleDominoActionProgress(globalThis.__reviewEnv.dominoMotionTime - anim.startTime, anim.duration)
  }))
}));
for (const player of globalThis.__reviewEnv.players) assert.equal(player.hand.length, 7);
for (const n of [7, 8, 10, 14, 21]) {
  engine.count(n);
  assert.equal(states.at(-1).count, n);
  assert.equal(states.at(-1).kind, 'hold');
  assert.equal(globalThis.__reviewEnv.players[0].hand.length, n);
  assert.equal(globalThis.__reviewEnv.activeHandMeshes.size, n + 21);
  finiteScene();
}
console.log('Hand-count controls 7/8/10/14/21 preserve actual rack mesh counts.');

// Verify the active right hand and supporting left hand from the actual rig,
// including every finger bone, remain within the rendered portrait camera.
// This does not test occlusion, hand surface pixels or aesthetic composition.
let projectionSamples = 0;
let projectedBones = 0;
let widestHandNdc = 0;
let tallestHandNdc = 0;
const projectionFailures = [];
engine.count(7);
for (const width of [320, 390]) {
  Object.assign(viewport, { width, height: 524 });
  engine.view('hands');
  for (const kind of ['hold', 'place', 'draw', 'knock']) {
    engine.select(kind);
    for (const progress of [0, .18, .34, .5, .74, .92, 1]) {
      engine.seek(progress);
      finiteScene();
      const camera = globalThis.__reviewCamera;
      assert.ok(Math.abs(camera.aspect - width / 524) < 1e-12, 'Camera must use the actual portrait viewport aspect');
      const rig = globalThis.__reviewEnv.seatedHumanActors[1].rig;
      for (const side of ['left', 'right']) {
        const hand = rig[side + 'Hand'];
        let sideBones = 0;
        hand.traverse(bone => {
          if (!bone.isBone) return;
          sideBones++;
          projectedBones++;
          const world = bone.getWorldPosition(bone.position.clone());
          const ndc = world.clone().project(camera);
          const cameraSpace = world.clone().applyMatrix4(camera.matrixWorldInverse);
          widestHandNdc = Math.max(widestHandNdc, Math.abs(ndc.x));
          tallestHandNdc = Math.max(tallestHandNdc, Math.abs(ndc.y));
          if (![ndc.x, ndc.y, ndc.z].every(Number.isFinite) || Math.abs(ndc.x) >= .97 || Math.abs(ndc.y) >= .97 || ndc.z < -1 || ndc.z > 1 || cameraSpace.z >= 0) {
            projectionFailures.push({
              viewport: width + 'x524', kind, progress, side, bone: bone.name,
              ndc: ndc.toArray().map(value => Number(value.toFixed(4)))
            });
          }
        });
        assert.ok(sideBones >= 10, side + ' hand must include the real finger skeleton');
      }
      projectionSamples++;
    }
  }
}
assert.equal(projectionFailures.length, 0,
  'Active/supporting hand bones cropped by portrait camera: ' + JSON.stringify(projectionFailures.slice(0, 12)));
console.log('Portrait hand framing passes: ' + projectionSamples + ' samples, ' + projectedBones + ' actual hand/finger bones; max |NDC x|=' + widestHandNdc.toFixed(3) + ', |NDC y|=' + tallestHandNdc.toFixed(3) + '.');
for (const view of ['hands', 'table']) {
  engine.view(view);
  assert.equal(states.at(-1).view, view);
  finiteScene();
}
engine.select('place');
engine.seek(.34);
engine.togglePlay();
assert.equal(states.at(-1).playing, true);
frame(16);
assert.ok(states.at(-1).progress > .34);
engine.togglePlay();
assert.equal(states.at(-1).playing, false);
const paused = states.at(-1).progress;
frame(32);
assert.equal(states.at(-1).progress, paused);
engine.mute();
assert.equal(states.at(-1).sound, false);
engine.mute();
assert.equal(states.at(-1).sound, true);
engine.seek(1);
engine.togglePlay();
assert.equal(states.at(-1).playing, true);
assert.equal(states.at(-1).progress, 0);
frame(16);
finiteScene();
engine.dispose();
assert.equal(frames.size, 0);
assert.equal(errors.length, 0);
console.log(JSON.stringify({
  result: 'PASS',
  actualSeekSamples: samples,
  handCounts: 5,
  views: 2,
  projectionSamples,
  projectedBones,
  maxHandNdc: { x: widestHandNdc, y: tallestHandNdc },
  renderInvocations: globalThis.__renderCount,
  reportedStates: states.length,
  errors: errors.length,
  validation: 'Offline scene/rig/orchestration only; WebGL pixel rendering is not tested.'
}));
