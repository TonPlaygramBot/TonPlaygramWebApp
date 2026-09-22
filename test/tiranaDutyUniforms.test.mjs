import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from '../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import * as humanoid from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';
import {FORCE_ASSET_BY_ID} from '../webapp/src/games/tiranastreets/shared/albanianForces.mjs';

const assets = process.env.TIRANA_FORCE_ASSET_ROOT || fileURLToPath(new URL('../webapp/public/assets/tirana-streets/albanian-forces/glb', import.meta.url));
const uniforms = ['shqiponja_officer', 'fnsh_officer', 'renea_officer'];
function load(path, dependencies = {}, globals = {}) {
  const module = {exports:{}};
  const output = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(output, {module, exports:module.exports, require:key=>dependencies[key] || {}, console, setTimeout, clearTimeout, AbortController, ...globals});
  return module.exports;
}
class HeadlessLoader extends GLTFLoader {
  constructor() { super(); this.register(()=>({name:'HEADLESS_TEXTURES', loadTexture:async()=>new T.Texture()})); }
}
function runtime(fetch) {
  return load('webapp/src/games/tiranastreets/cityBaseRenderer.ts', {
    three:T, './street-career/humanoidRig.mjs':humanoid, './shared/albanianForces.mjs':{FORCE_ASSET_BY_ID},
    './shared/vehicleCollection.mjs':{CIVILIAN_VEHICLE_MODELS:{}}, './rollingWheels':{prepareLegacyWheels:()=>[]},
    'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:HeadlessLoader}, 'three/examples/jsm/utils/SkeletonUtils.js':{clone}
  }, {fetch, console:{...console, warn(){}}});
}
function fixture(CityRenderer) {
  const soldier = new T.Group(); soldier.add(new T.Mesh(new T.BoxGeometry(1, 1.78, 1), new T.MeshStandardMaterial()));
  const renderer = Object.assign(Object.create(CityRenderer.prototype), {
    playerModel:'selected-soldier', playerAnimations:[], animations:[], models:new Map([['selected-soldier', soldier]]),
    dutyAnimations:new Map(), dutyPending:new Map(), dutyRetryAt:new Map(), actors:new Map(), scene:new T.Scene(), clock:0, disposed:false
  });
  renderer.actor('selected-soldier', 'player-local');
  return renderer;
}
const readModel = id => {
  const bytes = readFileSync(join(assets, id + '.glb'));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};
const response = id => ({ok:true, arrayBuffer:async()=>readModel(id)});

test('all original duty uniforms normalize, animate independent skeletons, and mask only the first-person head', async () => {
  const {CityRenderer, prepareDutyPlayerModel} = runtime();
  const {maskHead, FirstPersonBody} = load('webapp/src/games/tiranastreets/street-career/FirstPersonBody.ts', {three:T, './humanoidRig.mjs':humanoid});
  for (const id of uniforms) {
    const gltf = await new HeadlessLoader().parseAsync(readModel(id), '');
    const originalTrackNames = gltf.animations.flatMap(clip=>clip.tracks.map(track=>track.name));
    const {model, clips} = prepareDutyPlayerModel(gltf.scene, gltf.animations);
    assert.equal(humanoid.inspectHumanoidRig(model).valid, true, id);
    const bounds = new T.Box3().setFromObject(model);
    assert.ok(Math.abs(bounds.min.y) < 1e-5, 'feet remain grounded');
    assert.ok(Math.abs(bounds.max.y - 1.78) < 1e-5, 'uniform uses the established player height');
    assert.deepEqual(gltf.animations.flatMap(clip=>clip.tracks.map(track=>track.name)), originalTrackNames, 'source animation bindings remain untouched');
    for (const clip of clips) for (const track of clip.tracks) assert.ok(model.getObjectByName(T.PropertyBinding.parseTrackName(track.name).nodeName), track.name);
    const renderer = fixture(CityRenderer), key = 'duty-player:' + id;
    renderer.models.set(key, model); renderer.dutyAnimations.set(key, clips);
    const first = renderer.actor(key, 'player-local'), second = renderer.actor(key, 'other');
    assert.ok(first.importedRig && first.walk && first.run);
    const a = first.importedRig.bones.get('leftupleg'), b = second.importedRig.bones.get('leftupleg'), rest = b.quaternion.clone();
    assert.notEqual(a, b); first.idle.stop(); first.walk.play(); first.mixer.update(.31);
    assert.ok(a.quaternion.angleTo(rest) > .001, 'the remapped Walk clip still drives the correct joint');
    assert.ok(b.quaternion.angleTo(rest) < 1e-7, 'actor clones do not share their pose');
    const skins = []; first.group.traverse(node=>{if(node instanceof T.SkinnedMesh)skins.push(node);});
    const geometry = skins.map(mesh=>mesh.geometry), restore = maskHead(first.group);
    assert.ok(skins.some((mesh,index)=>mesh.geometry.index.count < geometry[index].index.count), 'camera masking removes head triangles');
    restore(); skins.forEach((mesh,index)=>assert.equal(mesh.geometry,geometry[index]));
    const body = new FirstPersonBody(new T.Scene());
    body.bind(first, true); body.bind(second, true); body.bind(second, false);
    assert.equal(first.group.getObjectByName('full-body-shadow-only'), undefined, 'switching uniforms releases the previous camera mask');
    assert.equal(second.group.getObjectByName('full-body-shadow-only'), undefined, 'third person restores the complete uniform');
    assert.ok(second.run && second.run.getClip().name === 'Run', 'body rebinding keeps a locomotion fallback for sprinting');
  }
});

test('duty loads once in the background, preserves the current actor, caches three uniforms, and restores the selected soldier', async () => {
  let release, requests = 0;
  const gate = new Promise(resolve=>{release=resolve;});
  const {CityRenderer} = runtime(async url=>{requests++;await gate;return response(url.split('/').pop().split('.')[0]);});
  const renderer = fixture(CityRenderer), player = {id:'local', forceCharacter:uniforms[0]};
  assert.equal(renderer.localPlayerModel(player), 'selected-soldier');
  assert.equal(renderer.localPlayerModel(player), 'selected-soldier');
  assert.equal(requests, 1); assert.equal(renderer.dutyPending.size, 1);
  release();
  while(renderer.dutyPending.size)await new Promise(resolve=>setTimeout(resolve, 5));
  assert.equal(renderer.localPlayerModel(player), 'duty-player:' + uniforms[0]);
  renderer.actor(renderer.localPlayerModel(player), 'player-local');
  for (const id of uniforms.slice(1)) {
    const current = renderer.actors.get('player-local').model;
    player.forceCharacter = id;
    assert.equal(renderer.localPlayerModel(player), current, 'switching departments keeps the prior uniform until ready');
    while(renderer.dutyPending.size)await new Promise(resolve=>setTimeout(resolve, 5));
    renderer.actor(renderer.localPlayerModel(player), 'player-local');
  }
  assert.equal(renderer.dutyAnimations.size, 3); assert.equal(requests, 3);
  player.forceCharacter = 'patrol_hatch'; assert.equal(renderer.localPlayerModel(player), 'selected-soldier');
  player.forceCharacter = 'https://unexpected.test/player.glb'; assert.equal(renderer.localPlayerModel(player), 'selected-soldier');
  delete player.forceCharacter; assert.equal(renderer.localPlayerModel(player), 'selected-soldier');
  assert.equal(requests, 3, 'only whitelisted person assets can be requested');
});

test('failed uniforms back off and a completed download cannot attach after renderer destruction', async () => {
  let requests = 0;
  const {CityRenderer} = runtime(async()=>{requests++;return {ok:false,status:503};});
  const renderer = fixture(CityRenderer), player = {id:'local', forceCharacter:uniforms[0]};
  await renderer.loadDutyPlayer(uniforms[0]);
  assert.equal(renderer.localPlayerModel(player), 'selected-soldier'); assert.equal(requests, 1);
  renderer.clock = 31; await renderer.loadDutyPlayer(uniforms[0]); assert.equal(requests, 2);
  let release;
  const gate = new Promise(resolve=>{release=resolve;});
  const late = fixture(runtime(async()=>{await gate;return response(uniforms[1]);}).CityRenderer);
  const pending = late.loadDutyPlayer(uniforms[1]); late.disposed = true; release(); await pending;
  assert.equal(late.dutyAnimations.size, 0); assert.equal(late.dutyPending.size, 0);
  assert.equal(late.models.size, 1, 'late models never reattach to a destroyed scene');
});
