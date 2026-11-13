import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from '../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { TURI_CHARACTER, TURI_MODEL_URL } from '../webapp/src/config/playerCharacter.js';
import { CHESS_HUMAN_CHARACTER_OPTIONS, CHESS_DEFAULT_HUMAN_CHARACTER_INDEX, normalizeChessHumanCharacterSelection } from '../webapp/src/config/chessBattleInventoryConfig.js';
import { HUMAN_CHARACTER_OPTIONS } from '../webapp/src/config/ludoBattleOptions.js';
import { getChessBattleInventory } from '../webapp/src/utils/chessBattleInventory.js';
import { getLudoBattleInventory, isLudoOptionUnlocked } from '../webapp/src/utils/ludoBattleInventory.js';
import { createSeatedHumanModelLibrary } from '../webapp/src/games/chess/seatedHumanModel.js';
import { loadSeatedHumanTemplate, saveSeatedHumanBoneRig, applySeatedHumanPose, createRestoredSeatedHumanActor } from '../webapp/src/pages/Games/shared/seatedHumanActors.js';
import { saveBoneRig, applySeatedBoardPose } from '../webapp/src/games/chess/seatedHumanRig.ts';
import { createFirstPersonArms, createCheckersHumanActor, updateCheckersHumanMove, setCheckersHumanView, disposeCheckersHuman } from '../webapp/src/games/checkers/checkersHumanActors.ts';
import { applyTuriSeatedPose } from '../webapp/src/games/shared/turiSeatedPose.js';

const bytes = readFileSync(new URL(`../webapp/public${TURI_MODEL_URL}`, import.meta.url));
const loader = new GLTFLoader();
loader.register(() => ({ name: 'HEADLESS_TEXTURES', loadTexture: async () => new THREE.Texture() }));
const template = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
template.userData.playerCharacterId = TURI_CHARACTER.id;
const option = CHESS_HUMAN_CHARACTER_OPTIONS[CHESS_DEFAULT_HUMAN_CHARACTER_INDEX];

function materialState(root) {
  const result = [];
  root.traverse(mesh => { if (mesh.isMesh) for (const mat of [mesh.material].flat()) result.push({mat, map:mat.map, color:mat.color.toArray(), roughness:mat.roughness}); });
  return result;
}
function assertSeated(rig) {
  rig.root.updateWorldMatrix(true,true);
  const local = bone => rig.root.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  for (const side of ['left','right']) {
    const hip=local(rig[side+'UpperLeg']), knee=local(rig[side+'LowerLeg']), foot=local(rig[side+'Foot']);
    assert.ok(knee.z > hip.z + .15, `${side} knee points toward table`);
    assert.ok(foot.y < knee.y - .15, `${side} foot hangs below knee`);
  }
  assert.equal(rig.head.name,'mixamorigHead');
  assert.equal(rig.rightHand.name,'mixamorigRightHand');
  assert.equal(rig.rightIndex.length,3);
  assert.ok(local(rig.leftHand).distanceTo(local(rig.rightHand)) > .15);
}

test('Chess and Ludo offer Turi free with original asset, preserving saved non-default choices', () => {
  assert.equal(option.id,'turi'); assert.deepEqual(option.modelUrls,[TURI_MODEL_URL]); assert.equal(option.preserveMaterials,true);
  assert.equal(CHESS_HUMAN_CHARACTER_OPTIONS[0].id,'rpm-current');
  assert.equal(normalizeChessHumanCharacterSelection({}),CHESS_DEFAULT_HUMAN_CHARACTER_INDEX);
  assert.equal(normalizeChessHumanCharacterSelection({humanCharacter:0,humanCharacterCatalogVersion:2}),CHESS_DEFAULT_HUMAN_CHARACTER_INDEX);
  assert.equal(normalizeChessHumanCharacterSelection({humanCharacter:0,humanCharacterCatalogVersion:3}),0);
  assert.equal(normalizeChessHumanCharacterSelection({humanCharacter:4,humanCharacterCatalogVersion:2}),4);
  assert.ok(getChessBattleInventory('turi-test').humanCharacter.includes('turi'));
  assert.ok(isLudoOptionUnlocked('humanCharacter','turi',getLudoBattleInventory('turi-test')));
  assert.equal(HUMAN_CHARACTER_OPTIONS.at(-1).id,'turi');
});

test('both shared board loaders use original Turi maps and never generate/repaint fallback textures', async () => {
  for (const shared of [true,false]) {
    const source=cloneSkeleton(template), before=materialState(source), requested=[];
    const createLoader=()=>({setCrossOrigin(){},async loadAsync(url){requested.push(url);return {scene:source};}});
    const loaded = shared
      ? await loadSeatedHumanTemplate({option,createLoader,targetHeight:1.13})
      : await createSeatedHumanModelLibrary({createLoader,targetHeight:1.13}).loadSeatedHumanTemplate(option);
    assert.deepEqual(requested,[TURI_MODEL_URL]);
    assert.equal(loaded.userData.playerCharacterId,'turi');
    assert.deepEqual(materialState(loaded),before);
    assert.ok(Number.isFinite(loaded.userData.seatedHumanScale));
  }
});

test('Chess character load failure is surfaced without substituting another avatar', async () => {
  const requested=[];
  const createLoader=()=>({setCrossOrigin(){},async loadAsync(url){requested.push(url);throw Error('missing Turi');}});
  const models=createSeatedHumanModelLibrary({createLoader,targetHeight:1.13});
  await assert.rejects(models.loadSeatedHumanTemplate(option),/missing Turi/);
  assert.ok(requested.every(url=>url.includes('/players/turi.')));
});

test('Snake and Chess/checkers/four-in-row pose the actual Turi skeleton with grounded legs under rotated seats', () => {
  for (const [save,pose] of [[saveSeatedHumanBoneRig,applySeatedHumanPose],[saveBoneRig,applySeatedBoardPose]]) {
    const actor=cloneSkeleton(template), seat=new THREE.Group();seat.position.set(4,2,-7);seat.rotation.y=1.8;seat.scale.setScalar(3.2);seat.add(actor);
    const rig=save(actor);
    for(let frame=0;frame<8;frame++) pose(rig,'idle',1,0);
    assertSeated(rig);
    const leftBefore=rig.leftHand.getWorldPosition(new THREE.Vector3());
    pose(rig,'reachPiece',.65,.7,{forwardReach:.2,sideReach:.1});
    assert.ok(rig.rightHand.getWorldPosition(new THREE.Vector3()).distanceTo(leftBefore)>.05);
    assert.ok(rig.rightIndex.every(bone=>Number.isFinite(bone.quaternion.w)));
  }
});

test('Snake instantiates independent Turi skeletons for player interactions', () => {
  const templateCopy=cloneSkeleton(template);templateCopy.userData.seatedHumanScale=2;
  const a=createRestoredSeatedHumanActor(templateCopy,new THREE.Group()), b=createRestoredSeatedHumanActor(templateCopy,new THREE.Group());
  assert.ok(a && b); assert.notEqual(a.rig.hips,b.rig.hips); assert.notEqual(a.rig.rightIndex[0],b.rig.rightIndex[0]);
  assertSeated(a.rig);
});

test('Ludo actual Turi idle/dice pose uses the same seated calibration and complete finger chains', () => {
  const source=readFileSync(new URL('../webapp/src/pages/Games/LudoBattleRoyal.jsx',import.meta.url),'utf8');
  const ast=parse(source,{sourceType:'module',plugins:['jsx']});
  const names=['normalizeBoneName','findBoneByNeedle','findBoneChainByNeedle','saveBoneRig','resetBoneRig','addBoneRot','addBonePos','moveLegRootsToFront','applySeatedHumanPose'];
  const code=names.map(name=>{const node=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(node,name);return source.slice(node.start,node.end);}).join('\n');
  const ctx={THREE,applyTuriSeatedPose,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),smoother01:x=>x,FRONT_SIDE_Z:1,LEG_FRONT_OFFSET_MIXAMO:0,SEATED_HUMAN_MOTION_TUNING:{idleBreathAmp:0},SEATED_HUMAN_DOWNWARD_CONTACT_MODE_SET:new Set(),SEATED_HUMAN_DICE_CONTACT_MODE_SET:new Set(),applyRightHandGrip(){},applyFirearmTriggerGrip(){},applyLeftHandGrip(){}};
  const api=Function(...Object.keys(ctx),`${code};return {saveBoneRig,applySeatedHumanPose};`)(...Object.values(ctx));
  const actor=cloneSkeleton(template),seat=new THREE.Group();seat.rotation.y=Math.PI;seat.scale.setScalar(2.5);seat.add(actor);const rig=api.saveBoneRig(actor);
  api.applySeatedHumanPose(rig,'idle',1,0,{}, {idleBreathAmp:0},true);
  // Ludo keeps all four authored finger joints including the fingertip.
  assert.equal(rig.head.name,'mixamorigHead');assert.equal(rig.rightHand.name,'mixamorigRightHand');assert.equal(rig.rightIndex.length,4);
  for(const side of ['left','right']){const knee=actor.worldToLocal(rig[side+'LowerLeg'].getWorldPosition(new THREE.Vector3())),foot=actor.worldToLocal(rig[side+'Foot'].getWorldPosition(new THREE.Vector3()));assert.ok(foot.y<knee.y-.15);}
});


test('actual Turi keeps visible first-person hands and performs a checker pickup and placement', () => {
  const source=cloneSkeleton(template);
  const scale=.48*.68, modelScale=.75*scale, stoolScale=1.02*scale;
  const radius=2.6*modelScale, tableY=.98*modelScale-.09*modelScale*stoolScale*.85-.4*modelScale+.09*modelScale*stoolScale+.05*modelScale;
  const tile=((8*4.2+3*2)*.049*scale*.62)/8;
  const actor=createCheckersHumanActor(source,{seat:'bottom',distance:radius+.56*scale-.075+.025,seatY:tableY-.12,height:radius*2.4});
  assert.ok(actor.firstPerson.arms.length>0);
  setCheckersHumanView(actor,'3d');
  assert.ok(actor.firstPerson.arms.every(mesh=>mesh.visible&&mesh.geometry.index.count>0));
  const scene=new THREE.Group();scene.add(actor.root);
  const cell=({r,c})=>new THREE.Vector3((c-3.5)*tile,tableY+.022+tile*.012,(r-3.5)*tile);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(tile*.32,tile*.32,tile*.16),new THREE.MeshBasicMaterial());scene.add(mesh);
  const fromCell={r:5,c:4},toCell={r:4,c:3};
  const action={mesh,from:cell(fromCell),to:cell(toCell),fromCell,toCell};
  for(let frame=0;frame<=40;frame++){
    const u=frame/40;updateCheckersHumanMove(actor,action,u,tile);
    if(u<=.3)assert.ok(mesh.position.distanceTo(action.from)<1e-9);
    if(u>=.82)assert.ok(mesh.position.distanceTo(action.to)<1e-9);
    if(u>=.3&&u<=.8){
      const target=mesh.position.clone().add(new THREE.Vector3(0,action.gripHeight,0));
      const hand=actor.rig.rightHand.localToWorld(action.gripAnchorLocal.clone());
      assert.ok(hand.distanceTo(target)<tile*.18,`Turi checker contact at ${u}: ${hand.distanceTo(target)/tile} tiles`);
    }
  }
  disposeCheckersHuman(actor);mesh.geometry.dispose();mesh.material.dispose();
});


test('Chess extracts real Turi arm triangles for eye view without losing the combined body mesh', () => {
  const source=readFileSync(new URL('../webapp/src/pages/Games/ChessBattleRoyal.jsx',import.meta.url),'utf8');
  const ast=parse(source,{sourceType:'module',plugins:['jsx']});
  const node=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='collectChessFirstPersonMeshes');
  const collect=Function('createFirstPersonArms','TURI_CHARACTER_ID',`${source.slice(node.start,node.end)};return collectChessFirstPersonMeshes;`)(createFirstPersonArms,TURI_CHARACTER.id);
  const actor=cloneSkeleton(template), meshes=collect(actor);
  assert.equal(meshes.armOnly,true);assert.ok(meshes.arms.length>0);assert.ok(meshes.body.length>0);
  for(const mesh of meshes.arms){
    assert.ok(mesh.geometry.index.count>0);assert.equal(mesh.visible,false);
    assert.ok(mesh.skeleton.bones.some(b=>b.name==='mixamorigRightHand'));
    assert.ok(mesh.geometry.index.count<meshes.body[0].geometry.index.count);
    mesh.geometry.dispose();
  }
  assert.equal((source.match(/collectChessFirstPersonMeshes\(actor\)/g)||[]).length,3,'initial load and character switch both use weighted arm extraction');
  assert.ok(source.includes('mesh.visible = localActorEntry.fpvMeshes.armOnly ? fpvEnabled : true;'));
});
