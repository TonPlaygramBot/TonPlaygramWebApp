import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {applyLudoSeatedHumanPose} from '../webapp/src/utils/ludoSeatedPose.js';
const load=path=>{const source=readFileSync(new URL(path,import.meta.url),'utf8');const ast=parse(source,{sourceType:'module',plugins:['jsx']});const defs=new Map();for(const node of ast.program.body)if(node.type==='VariableDeclaration')for(const d of node.declarations)if(d.id.name&&d.init)defs.set(d.id.name,source.slice(d.init.start,d.init.end));const ctx=vm.createContext({THREE});function get(name){if(name in ctx)return ctx[name];assert.ok(defs.has(name),name);for(const id of defs.get(name).match(/\b[A-Z][A-Z_0-9]+\b/g)||[])if(id!==name&&defs.has(id))get(id);return ctx[name]=vm.runInContext(defs.get(name),ctx);}return {source,get};};
const snake=load('../webapp/src/components/SnakeBoard3D.jsx'),ludo=load('../webapp/src/pages/Games/LudoBattleRoyal.jsx');
test('Snake matches Ludo table, chairs and humans scale',()=>{for(const name of ['MODEL_SCALE','TABLE_RADIUS','TABLE_HEIGHT','TABLE_MODEL_TARGET_DIAMETER','TABLE_LEG_EXTENSION_FACTOR','CHAIR_SIZE_SCALE','CHAIR_BOTTOM_TRIM_SCALE','CHAIR_BASE_HEIGHT','AI_CHAIR_RADIUS','CHAIR_GLOBAL_PUSHBACK','SELF_BOTTOM_CHAIR_EXTRA_PUSHBACK','SEATED_HUMAN_TARGET_HEIGHT','SEATED_HUMAN_VISUAL_SCALE_MULTIPLIER','SEATED_HUMAN_SEAT_Z_OFFSET','SEATED_HUMAN_SEAT_Y_OFFSET','SELF_BOTTOM_HUMAN_EXTRA_Z_OFFSET'])assert.equal(snake.get(name),ludo.get(name),name);});
test('both games import the exact same actor pose and grounding implementation',()=>{assert.match(snake.source,/import \{ applyLudoSeatedHumanPose, alignLudoHumanFeet, inferChairSupportsArmrest \}/);assert.match(ludo.source,/applyLudoSeatedHumanPose as applySeatedHumanPose/);assert.match(snake.source,/applyLudoSeatedHumanPose\(rig, 'idle'/);});
test('shared idle pose uses Ludo armrest and folded-leg calibration',()=>{const saved=new Map(),rig={saved};for(const name of ['hips','spine','chest','neck','head','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot','leftUpperArm','leftForeArm','leftHand','rightUpperArm','rightForeArm','rightHand']){const bone=new THREE.Bone();rig[name]=bone;saved.set(bone,{rotation:bone.rotation.clone(),position:bone.position.clone()});}applyLudoSeatedHumanPose(rig,'idle',1,0,{}, {idleBreathAmp:0},true);assert.equal(rig.hips.position.y,-.62);assert.equal(rig.leftUpperLeg.rotation.x,-1.58);assert.equal(rig.leftForeArm.rotation.x,-.62);assert.equal(rig.rightUpperArm.rotation.x,-.2);applyLudoSeatedHumanPose(rig,'idle',1,0,{}, {idleBreathAmp:0},false);assert.equal(rig.leftUpperArm.rotation.x,-.96);assert.equal(rig.rightUpperArm.rotation.x,-.98);});

test('Snake board is 10% smaller while the die keeps its original world size',()=>{
  assert.equal(snake.get('BOARD_SCALE'),ludo.get('BOARD_SCALE')*0.9);
  assert.equal(snake.get('BOARD_FOOTPRINT_SCALE'),snake.get('BOARD_SCALE'));
  assert.ok(Math.abs(snake.get('DICE_SIZE')*snake.get('BOARD_SCALE')-ludo.get('DICE_SIZE')*ludo.get('BOARD_SCALE'))<1e-12);
});
