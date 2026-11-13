import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from '../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { TURI_CHARACTER, TURI_MODEL_URL } from '../webapp/src/config/playerCharacter.js';
import { MURLAN_CHARACTER_THEMES, DEFAULT_MURLAN_CHARACTER_INDEX } from '../webapp/src/config/murlanCharacterThemes.js';
import { MURLAN_ROYALE_DEFAULT_UNLOCKS } from '../webapp/src/config/murlanInventoryConfig.js';
import { applyTuriSeatedPose } from '../webapp/src/games/shared/turiSeatedPose.js';
import { humanoidBones } from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';

const sources = new Map();
function loadFunctions(path, names, context = {}) {
  let entry = sources.get(path);
  if (!entry) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    entry = { source, ast: parse(source, {sourceType:'module', plugins:['jsx']}) };
    sources.set(path, entry);
  }
  const code = names.map(name => {
    const declaration = entry.ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
    assert.ok(declaration, `Missing ${name}`);
    return entry.source.slice(declaration.start, declaration.end);
  }).join('\n');
  return Function(...Object.keys(context), `${code}; return {${names.join(',')}};`)(...Object.values(context));
}
const bytes = readFileSync(new URL(`../webapp/public${TURI_MODEL_URL}`, import.meta.url));
const loader = new GLTFLoader();
loader.register(() => ({ name:'HEADLESS_TEXTURES', loadTexture:async () => new THREE.Texture() }));
const template = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
const murlan = 'webapp/src/pages/Games/MurlanRoyaleArena.jsx';
const texas = 'webapp/src/pages/Games/TexasHoldemArena.jsx';
const domino = 'webapp/public/domino-royal-game.js';

test('Murlan adds free, default Turi without shifting existing saved character indexes', () => {
  assert.equal(MURLAN_CHARACTER_THEMES[0].id, 'rpm-current');
  const turi = MURLAN_CHARACTER_THEMES[DEFAULT_MURLAN_CHARACTER_INDEX];
  assert.equal(turi.id, TURI_CHARACTER.id);
  assert.equal(turi.url, TURI_MODEL_URL);
  assert.equal(turi.price, 0);
  assert.equal(turi.preserveOriginalMaterials, true);
  assert.ok(MURLAN_ROYALE_DEFAULT_UNLOCKS.characters.includes(turi.id));
});

test('all three card rigs resolve actual Turi joints rather than head/finger descendants', () => {
  for (const [path, name] of [[murlan,'findBoneByHints'], [texas,'findTexasCharacterBone'], [domino,'findDominoBone']]) {
    const find = loadFunctions(path,[name])[name];
    for (const [hint, expected] of [['head','mixamorigHead'],['righthand','mixamorigRightHand'],['rightindex','mixamorigRightHandIndex1'],['leftleg','mixamorigLeftLeg']])
      assert.equal(find(template,[hint])?.name, expected, `${path} ${hint}`);
  }
});

test('Turi seated IK keeps knees ahead, feet lower and hands separated under rotated, scaled seats', () => {
  const instance = cloneSkeleton(template);
  const seat = new THREE.Group();
  seat.position.set(8, 3, -11); seat.rotation.y = 1.2; seat.scale.setScalar(3.13); seat.add(instance);
  const bones = humanoidBones(instance);
  // Existing RPM calf axes turn Turi's feet upwards; the adapter must correct them.
  for (const side of ['left','right']) {
    bones.get(side+'upleg').rotation.x -= Math.PI/2;
    bones.get(side+'leg').rotation.x -= Math.PI/2;
  }
  for (let frame=0; frame<20; frame++) applyTuriSeatedPose(instance);
  const local = name => instance.worldToLocal(bones.get(name).getWorldPosition(new THREE.Vector3()));
  for (const side of ['left','right']) {
    const hip=local(side+'upleg'), knee=local(side+'leg'), foot=local(side+'foot');
    assert.ok(knee.z > hip.z + .2, `${side} knee must point towards table`);
    assert.ok(foot.y < knee.y - .2, `${side} foot must hang below knee`);
    assert.ok(Math.abs(foot.x-hip.x) < .1);
    assert.ok(local(side+'hand').z > local('hips').z + .15);
  }
  assert.ok(local('lefthand').x > local('righthand').x + .2);
});

test('legs-only seating leaves an existing two-hand action pose intact', () => {
  const instance=cloneSkeleton(template), bones=humanoidBones(instance);
  const before=new Map(['leftarm','leftforearm','rightarm','rightforearm'].map(name=>[name,bones.get(name).quaternion.clone()]));
  applyTuriSeatedPose(instance,{arms:false});
  for(const [name,rotation] of before) assert.ok(rotation.angleTo(bones.get(name).quaternion)<1e-6);
});

test('Texas mounts the original Turi model for the human seat and preserves all source materials', async () => {
  let requested = null, repaintCalls=0;
  const context = {
    THREE, cloneSkeleton, applyTuriSeatedPose, MODEL_SCALE:.75,
    TURI_CHARACTER, TEXAS_PLAYER_CHARACTER:{...TURI_CHARACTER,urls:[TURI_MODEL_URL],scale:1},
    TEXAS_DOMINO_CHARACTER_PROPORTION_SCALE:1.82,TEXAS_DOMINO_HUMAN_CHARACTER_SCALE_BOOST:0,
    TEXAS_MURLAN_SEATED_OFFSET_Y:-.92,TEXAS_MURLAN_SEATED_OFFSET_Z:-.24,
    TEXAS_HUMAN_CHARACTER_EXTRA_LOWER_OFFSET:.24,TEXAS_HUMAN_CHARACTER_TABLE_INWARD_OFFSET:1,
    TEXAS_MURLAN_CHARACTER_EXTRA_LOWER_OFFSET:.28,TEXAS_MURLAN_CHARACTER_EXTRA_OUTWARD_OFFSET:.88,
    TEXAS_CHARACTER_TABLE_INWARD_OFFSET:1.2,
    enhanceTexasDominoCharacterMaterials(){repaintCalls++;},
    getTexasDominoCharacterThemeForSeat(){throw Error('Human must not use random opponent theme');},
    loadTexasDominoCharacterTemplate:async theme=>{requested=theme;return template;},
    loadAnyTexasDominoCharacterTemplate(){throw Error('Turi must not silently fall back to another model');}
  };
  const api=loadFunctions(texas,['findTexasCharacterBone','captureTexasCharacterPose','addTexasBoneOffset','normalizeTexasCharacterRoot','createTexasCharacterRig','attachTexasDominoCharacterToSeat'],context);
  const group=new THREE.Group();new THREE.Scene().add(group);
  const actor=await api.attachTexasDominoCharacterToSeat({group,isHuman:true},3,null);
  assert.equal(requested.id,'turi'); assert.equal(repaintCalls,0);
  assert.ok(actor.rig.bones.rightIndexFinger);
  const sourceMaterials=[];template.traverse(mesh=>{if(mesh.isMesh)sourceMaterials.push(mesh.material);});
  const mountedMaterials=[];actor.rig.instance.traverse(mesh=>{if(mesh.isMesh)mountedMaterials.push(mesh.material);});
  assert.equal(mountedMaterials.length,sourceMaterials.length);
  mountedMaterials.forEach((material,index)=>{
    assert.notEqual(material,sourceMaterials[index]);
    assert.equal(material.map,sourceMaterials[index].map);
    assert.equal(material.color.getHex(),sourceMaterials[index].color.getHex());
  });
});

test('Domino resolves the local Turi descriptor and never substitutes a placeholder on load failure', async () => {
  const opponent={id:'opponent'};
  const context={human:0,HUMAN_SEAT_INDEX:0,DOMINO_PLAYER_CHARACTER:TURI_CHARACTER,DOMINO_CHARACTER_THEMES:[opponent],dominoCharacterThemeOrder:[0]};
  const {getDominoCharacterThemeForSeat}=loadFunctions(domino,['getDominoCharacterThemeForSeat'],context);
  assert.equal(getDominoCharacterThemeForSeat(0).id,'turi');
  assert.equal(getDominoCharacterThemeForSeat(1),opponent);
  let attempts=0;
  const {loadDominoSeatCharacterTemplate}=loadFunctions(domino,['loadDominoSeatCharacterTemplate'],{
    ...context,getDominoCharacterThemeForSeat,console:{warn(){}},
    loadDominoCharacterTemplate:async()=>{attempts++;throw Error('network offline');},
    buildDominoFallbackCharacterTemplate(){throw Error('No procedural Turi fallback');}
  });
  assert.equal(await loadDominoSeatCharacterTemplate(0),null);
  assert.equal(attempts,1);
});


test('Domino assigns Turi to the actual local online seat from one through four', () => {
  const opponents=Array.from({length:4},(_,index)=>({id:`opponent-${index}`}));
  for(let localSeat=0;localSeat<4;localSeat++) {
    const {getDominoCharacterThemeForSeat}=loadFunctions(domino,['getDominoCharacterThemeForSeat'],{
      human:localSeat,HUMAN_SEAT_INDEX:0,DOMINO_PLAYER_CHARACTER:TURI_CHARACTER,
      DOMINO_CHARACTER_THEMES:opponents,dominoCharacterThemeOrder:[0,1,2,3]
    });
    for(let seat=0;seat<4;seat++) {
      assert.equal(getDominoCharacterThemeForSeat(seat),seat===localSeat?TURI_CHARACTER:opponents[seat]);
    }
  }
});
