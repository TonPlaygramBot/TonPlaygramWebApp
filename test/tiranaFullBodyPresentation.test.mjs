import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import {normalizePlayableHuman,humanoidBones,hideAuthoredPlayerWeapon} from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';
const webapp = fileURLToPath(new URL('../webapp/', import.meta.url)),
  require = createRequire(join(webapp, 'package.json'));
const { build } = require('esbuild'),
  { JSDOM } = require('jsdom'),
  T = await import(
    pathToFileURL(join(webapp, 'node_modules/three/build/three.module.js'))
  );
const dir = mkdtempSync(join(webapp, '.career-test-'));
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
after(() => rmSync(dir, { recursive: true, force: true }));
const bundle = async (name) => {
  const out = join(dir, name + '.mjs');
  await build({
    entryPoints: [
      join(webapp, 'src/games/tiranastreets/street-career/' + name + '.ts')
    ],
    outfile: out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['three', 'three/*'],
    logLevel: 'silent'
  });
  return import(pathToFileURL(out));
};
const { FirstPersonBody, maskHead } = await bundle('FirstPersonBody'),
  { StreetInput } = await bundle('StreetInput');
const { GLTFLoader } = await import(
  pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js'))
);
const { clone } = await import(
  pathToFileURL(require.resolve('three/examples/jsm/utils/SkeletonUtils.js'))
);
const dom = new JSDOM('<!doctype html><div></div>', {
  url: 'http://localhost'
});
for (const key of [
  'window',
  'document',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'KeyboardEvent'
])
  globalThis[key] = dom.window[key];
globalThis.ProgressEvent = class {
  constructor(type, init) {
    this.type = type;
    Object.assign(this, init);
  }
};
const source = readFileSync(
    join(webapp, 'public/assets/tirana-streets/living/human.glb')
  ),
  length = source.readUInt32LE(12),
  json = JSON.parse(source.subarray(20, 20 + length));
// Read the real skin, skeleton and clips. Texture decoding requires WebGL/browser
// and is deliberately NOT part of these numeric rig tests.
const bin = source.subarray(28 + length);
json.buffers[0].uri =
  'data:application/octet-stream;base64,' + bin.toString('base64');
delete json.images;
delete json.textures;
delete json.materials;
for (const m of json.meshes) for (const p of m.primitives) delete p.material;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
const makeActor = () => {
  const model = clone(gltf.scene),
    root = new T.Group();
  root.add(model);
  model.updateMatrixWorld(true);
  let box = new T.Box3().setFromObject(model),
    c = box.getCenter(new T.Vector3()),
    scale = 1.78 / (box.max.y - box.min.y);
  model.scale.setScalar(scale);
  model.position.set(-c.x * scale, -box.min.y * scale, -c.z * scale);
  const mixer = new T.AnimationMixer(root),
    actor = { group: root, mixer, model: 'character', wheels: [] };
  for (const key of ['idle', 'walk', 'run'])
    actor[key] = mixer.clipAction(
      gltf.animations.find((c) => c.name.toLowerCase() === key)
    );
  return actor;
};
const { createBody } = await import(
  '../webapp/src/games/tiranastreets/street-career/playerCore.mjs'
);

test('real Mixamo single mesh keeps body triangles and skeleton after head masking', () => {
  const a = makeActor(),
    meshes = [];
  a.group.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  const before = meshes.map((m) => ({
    geometry: m.geometry,
    count: m.geometry.index?.count || m.geometry.attributes.position.count,
    skeleton: m.skeleton,
    bones: m.skeleton.bones.length
  }));
  const release = maskHead(a.group);
  assert.ok(
    meshes.some(
      (m, i) =>
        m.geometry.index.count < before[i].count && m.geometry.index.count > 0
    )
  );
  for (let i = 0; i < meshes.length; i++) {
    assert.equal(meshes[i].skeleton, before[i].skeleton);
    assert.equal(meshes[i].skeleton.bones.length, before[i].bones);
    assert.notEqual(meshes[i].geometry, before[i].geometry);
  }
  release();
});
test('bound real player shows feet below eye and extends a hand during punch', () => {
  const actor = makeActor(),
    scene = new T.Scene();
  scene.add(actor.group);
  const rig = new FirstPersonBody(scene),
    b = createBody(0),
    p = { x: 0, z: 0, health: 100, speed: 0, weapon: '', nextShot: 0 };
  rig.update(actor, p, b, 0, 1 / 60);
  const bone = (name) => {
    let value;
    actor.group.traverse((o) => {
      if (
        o instanceof T.Bone &&
        o.name.replace(/[^A-Za-z]/g, '').endsWith(name)
      )
        value = o;
    });
    return value;
  };
  const leftFoot = bone('LeftFoot'),
    rightHand = bone('RightHand');
  assert.ok(leftFoot && rightHand);
  scene.updateMatrixWorld(true);
  const foot = leftFoot.getWorldPosition(new T.Vector3());
  assert.ok(foot.y < 0.35);
  const camera = new T.PerspectiveCamera(74, 390 / 844, 0.035, 100);
  camera.position.set(0, b.y + b.eye, 0);
  camera.lookAt(0, 0.1, -0.3);
  camera.updateMatrixWorld(true);
  const projected = foot.clone().project(camera);
  assert.ok(
    Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1,
    'foot visible looking down'
  );
  const start = rightHand.getWorldPosition(new T.Vector3());
  b.action = { kind: 'punch', hand: 1, start: 0, duration: 0.42 };
  rig.update(actor, p, b, 0.21, 1 / 60);
  scene.updateMatrixWorld(true);
  const end = rightHand.getWorldPosition(new T.Vector3());
  assert.ok(end.z < start.z - 0.08, `hand reach ${start.z} -> ${end.z}`);
  rig.dispose();
});
test('crouch lowers the actual rig and kick raises the actual foot', () => {
  const a = makeActor(),
    scene = new T.Scene(),
    rig = new FirstPersonBody(scene),
    b = createBody(0),
    p = { x: 0, z: 0, health: 100, speed: 0, weapon: '', nextShot: 0 };
  scene.add(a.group);
  let foot, hips;
  a.group.traverse((o) => {
    if (o.name.endsWith('RightFoot')) foot = o;
    if (o.name.endsWith('Hips')) hips = o;
  });
  rig.update(a, p, b, 0, 0.1);
  scene.updateMatrixWorld(true);
  const start = foot.getWorldPosition(new T.Vector3()),
    height = hips.getWorldPosition(new T.Vector3()).y;
  b.crouched = true;
  b.height = 1.08;
  b.eye = 0.94;
  rig.update(a, p, b, 0.1, 0.1);
  scene.updateMatrixWorld(true);
  assert.ok(hips.getWorldPosition(new T.Vector3()).y < height - 0.3);
  assert.ok(
    foot.getWorldPosition(new T.Vector3()).y > -0.18,
    'crouched foot should not sink below street'
  );
  b.crouched = false;
  b.height = 1.78;
  b.eye = 1.62;
  b.action = { kind: 'kick', start: 0, duration: 0.68 };
  rig.update(a, p, b, 0.34, 0.1);
  scene.updateMatrixWorld(true);
  const end = foot.getWorldPosition(new T.Vector3());
  assert.ok(end.y > start.y + 0.25);
  assert.ok(end.z < start.z - 0.3);
  rig.dispose();
});
test('body rig does not mutate shared source animation tracks', () => {
  const sourceClips = gltf.animations.map((c) =>
      c.tracks.map((t) => Array.from(t.values))
    ),
    actor = makeActor(),
    scene = new T.Scene(),
    rig = new FirstPersonBody(scene),
    b = createBody(0);
  scene.add(actor.group);
  rig.update(
    actor,
    { x: 0, z: 0, health: 100, speed: 2, weapon: '', nextShot: 0 },
    b,
    1,
    1 / 60
  );
  assert.deepEqual(
    gltf.animations.map((c) => c.tracks.map((t) => Array.from(t.values))),
    sourceClips
  );
  rig.dispose();
});
for (const id of ['tactical','polish','agent-47']) test(`${id} supplied body walks, crouches and punches through the actual player presentation`,async()=>{
  const data=readFileSync(join(webapp,`public/assets/tirana-streets/players/${id}.glb`)),loader=new GLTFLoader();
  loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
  const source=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const group=normalizePlayableHuman(source.scene);hideAuthoredPlayerWeapon(group);
  const mixer=new T.AnimationMixer(group),clips=Object.fromEntries(source.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
  const actor={group,mixer,clips,idle:Object.values(clips)[0],model:'local-player',wheels:[]},scene=new T.Scene();
  scene.add(group);
  const rig=new FirstPersonBody(scene),body=createBody(0),p={x:0,z:0,health:100,speed:3,weapon:'',nextShot:0},bones=humanoidBones(group);
  body.gait=Math.PI/2;rig.update(actor,p,body,0,1/60);scene.updateMatrixWorld(true);
  const foot=bones.get('leftfoot'),forward=foot.getWorldPosition(new T.Vector3());
  body.gait=3*Math.PI/2;rig.update(actor,p,body,.1,1/60);scene.updateMatrixWorld(true);
  assert.ok(foot.getWorldPosition(new T.Vector3()).z>forward.z+.2,'original uploaded legs must walk');
  p.speed=0;body.crouched=true;body.eye=.94;
  rig.update(actor,p,body,.2,1/60);scene.updateMatrixWorld(true);
  assert.ok(bones.get('hips').getWorldPosition(new T.Vector3()).y<.85,'uploaded pelvis lowers when crouching');
  assert.ok(foot.getWorldPosition(new T.Vector3()).y>-.18,'crouched foot stays above the street');
  body.crouched=false;body.eye=1.62;rig.update(actor,p,body,.3,1/60);scene.updateMatrixWorld(true);
  const hand=bones.get('righthand'),before=hand.getWorldPosition(new T.Vector3());
  body.action={kind:'punch',hand:1,start:0,duration:.42};rig.update(actor,p,body,.21,1/60);scene.updateMatrixWorld(true);
  assert.ok(hand.getWorldPosition(new T.Vector3()).z<before.z-.08,'uploaded arm follows attack action');
  if(id==='polish')assert.equal(group.getObjectByName('WZ96_Beryl_0').visible,false);
  rig.dispose();
});
test('two fingers can move and fire-drag, cancellation only clears its owner', () => {
  const actions = [],
    looks = [],
    input = new StreetInput(
      (a) => actions.push(a),
      (x, y) => looks.push([x, y])
    );
  assert.equal(input.pointerDown(1, 'move', 20, 700), true);
  input.touch.x = 0.5;
  input.touch.y = 0.7;
  assert.equal(input.pointerDown(2, 'fire', 300, 650), true);
  input.pointerMove(2, 310, 630);
  assert.deepEqual(looks, [[10, -20]]);
  let i = input.readStreet(0, 0.5, false);
  assert.equal(i.fire, true);
  assert.equal(i.x, 0.5);
  assert.equal(i.pitch, 0.5);
  input.pointerUp(2);
  i = input.readStreet(0, 0.5, false);
  assert.equal(i.fire, false);
  assert.equal(i.x, 0.5);
  assert.equal(input.pointerDown(3, 'move', 0, 0), false);
  input.pointerUp(99);
  assert.equal(input.touch.x, 0.5);
  input.pointerUp(1);
  assert.equal(input.touch.x, 0);
  input.destroy();
});
test('pause/blur releases held inputs and desktop emits the same action IDs', () => {
  const actions = [],
    input = new StreetInput(
      (a) => actions.push(a),
      () => {}
    );
  for (const [key, code] of [
    [' ', 'Space'],
    ['c', 'KeyC'],
    ['v', 'KeyV'],
    ['z', 'KeyZ'],
    ['b', 'KeyB']
  ])
    window.dispatchEvent(new KeyboardEvent('keydown', { key, code }));
  assert.ok(
    ['jump', 'crouch', 'kick', 'aim', 'guard'].every((id) =>
      actions.includes(id)
    )
  );
  input.pointerDown(4, 'fire', 10, 10);
  input.setEnabled(false);
  assert.equal(input.readStreet(0, 0, false).fire, false);
  input.setEnabled(true);
  assert.equal(input.pointerDown(4, 'fire', 10, 10), true);
  window.dispatchEvent(new dom.window.Event('blur'));
  assert.equal(input.readStreet(0, 0, false).fire, false);
  input.destroy();
});

test('real driver hands stay at the canonical cabin wheel while looking sideways', async () => {
  const { carPoint, vehicleAnchors } = await import(
    '../webapp/src/games/tiranastreets/street-career/vehicleCore.mjs'
  );
  const { driverEye } = await import(
    '../webapp/src/games/tiranastreets/shared/driverView.mjs'
  );
  const car = {
    id: 'car',
    x: 30,
    z: 20,
    heading: 0.7,
    steering: 0,
    model: 'city-car'
  };
  const actor = makeActor(),
    scene = new T.Scene();
  scene.add(actor.group);
  const rig = new FirstPersonBody(scene),
    b = createBody(0);
  const p = {
    x: car.x,
    z: car.z,
    health: 100,
    speed: 0,
    weapon: '',
    nextShot: 0,
    carId: car.id
  };
  b.yaw = car.heading;
  rig.update(actor, p, b, 0, 0, car);
  actor.group.updateMatrixWorld(true);
  const hands = [];
  actor.group.traverse((o) => {
    if (o instanceof T.Bone && /(?:Left|Right)Hand$/.test(o.name))
      hands.push(o);
  });
  assert.equal(hands.length, 2);
  const before = hands.map((o) => o.getWorldPosition(new T.Vector3()));
  const wheel = carPoint(car, vehicleAnchors(car).wheel);
  assert.deepEqual(carPoint(car, vehicleAnchors(car).eye), driverEye(car));
  for (const point of before)
    assert.ok(
      point.distanceTo(new T.Vector3(wheel.x, wheel.y, wheel.z)) < 0.26,
      'hand must reach wheel rim'
    );
  b.yaw += 1.2;
  b.pitch = 0.4;
  rig.update(actor, p, b, 0, 0, car);
  actor.group.updateMatrixWorld(true);
  for (let i = 0; i < hands.length; i++)
    assert.ok(
      hands[i].getWorldPosition(new T.Vector3()).distanceTo(before[i]) < 0.001,
      'look must not move steering grip'
    );
  car.steering = 0.45;
  rig.update(actor, p, b, 0, 0, car);
  actor.group.updateMatrixWorld(true);
  for (let i = 0; i < hands.length; i++) {
    const steered = hands[i].getWorldPosition(new T.Vector3());
    assert.ok(steered.distanceTo(before[i]) > 0.05, 'hand follows steering');
    assert.ok(
      steered.distanceTo(new T.Vector3(wheel.x, wheel.y, wheel.z)) < 0.26,
      'steering keeps hand at rim'
    );
  }
  rig.dispose();
});

test('four fingers preserve move, look and duplicate fire ownership across release and blur',()=>{
 const looks=[],input=new StreetInput(()=>{},(x,y)=>looks.push([x,y]));
 input.pointerDown(1,'move',20,700);input.touch.x=.6;input.touch.y=.8;
 input.pointerDown(2,'look',200,400);input.pointerDown(3,'fire',330,650);input.pointerDown(4,'fire',332,648);
 input.pointerMove(3,350,620);input.pointerMove(2,220,380);
 assert.deepEqual(looks,[[20,-20]],'a separate look finger prevents double camera movement');
 input.pointerUp(3);assert.equal(input.readStreet(0,0,false).fire,true);
 input.pointerUp(2);input.pointerMove(4,342,638);assert.deepEqual(looks.at(-1),[10,-10]);
 input.pointerUp(4);assert.equal(input.readStreet(0,0,false).fire,false);assert.equal(input.touch.x,.6);
 window.dispatchEvent(new dom.window.Event('blur'));assert.equal(input.pointerDown(1,'move',20,700),true);
 input.pointerDown(5,'gas',0,0);input.pointerDown(6,'reverse',0,0);input.pointerDown(7,'brake',0,0);
 assert.equal(input.readStreet(0,0,true).y,0);assert.equal(input.readStreet(0,0,true).brake,true);
 input.pointerUp(6);assert.equal(input.readStreet(0,0,true).y,1);input.destroy();
});

test('battlefield look release cannot stop fire held with another finger',async()=>{
 const out=join(dir,'battlefield-input.mjs');await build({entryPoints:[join(webapp,'src/games/blackwater/input.ts')],outfile:out,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 const {GameInput}=await import(pathToFileURL(out)),surface=document.createElement('div');surface.setPointerCapture=()=>{};
 const input=new GameInput(surface);input.active=true;input.firing=true;
 const event=(type,id,x)=>{const e=new dom.window.Event(type);Object.assign(e,{pointerId:id,pointerType:'touch',clientX:x,clientY:10});surface.dispatchEvent(e);};
 const looks=[];input.onLook=(x,y)=>looks.push([x,y]);event('pointerdown',1,20);event('pointerdown',2,50);event('pointermove',1,30);assert.deepEqual(looks,[[10,0]]);
 event('pointerup',1,30);assert.equal(input.firing,true);input.dispose();assert.equal(input.firing,false);
});

test('mapped window storeys and batched facade normals remain correct on elevated ground',async()=>{
 const out=join(dir,'building-windows.mjs');await build({entryPoints:[join(webapp,'src/games/tirana-neighbourhood/MappedBuildingCells.ts')],outfile:out,bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
 const {MappedBuildingCells}=await import(pathToFileURL(out));
 const {groundHeight,buildingGround}=await import('../webapp/src/games/tirana-east/terrainCore.mjs');
 const material=new T.MeshStandardMaterial(),layer=new MappedBuildingCells([],material,material,false,false);
 const b={id:'test',p:[[5000,5000],[5016,5000],[5016,5016],[5000,5016]],h:9.6,tags:{'building:levels':'3'}};
 const group=layer.build([b],true),glass=group.children.find(m=>m.userData.windows),p=glass.geometry.getAttribute('position'),norm=glass.geometry.getAttribute('normal');
 assert.equal(p.count,4*4*3*6);const base=buildingGround(b);assert.ok(Number.isFinite(groundHeight(5000,5000)));
 for(let i=0;i<p.count;i+=6){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);assert.ok(a.y>base&&a.y<base+9.6);assert.ok(b.sub(a).cross(c.sub(a)).dot(new T.Vector3().fromBufferAttribute(norm,i))>0);}
 group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});layer.dispose();material.dispose();
});
