import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {ARENA_CAMERA_DEFAULTS} from '../webapp/src/utils/arenaCameraConfig.js';
import {SEATED_PLAYER_VIEW} from '../webapp/src/utils/seatedPlayerView.ts';

function constants(file) {
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  const ast=parse(source,{sourceType:'module',plugins:['jsx']});
  const declarations=new Map(ast.program.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[])
    .filter(n=>n.id.type==='Identifier'&&n.init).map(n=>[n.id.name,n.init]));
  const scope=vm.createContext({THREE,ARENA_CAMERA_DEFAULTS,SEATED_PLAYER_VIEW});
  const resolving=new Set();
  const get=name=>{
    if(name in scope)return scope[name];
    const node=declarations.get(name);if(!node||resolving.has(name))return undefined;
    resolving.add(name);
    const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='Identifier'&&declarations.has(n.name)&&n.name!==name)get(n.name);
      for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v?.type)walk(v);}};
    walk(node);scope[name]=vm.runInContext(`(${source.slice(node.start,node.end)})`,scope);resolving.delete(name);return scope[name];
  };
  return {get,source};
}
const snake=constants('../webapp/src/components/SnakeBoard3D.jsx');
const ludo=constants('../webapp/src/pages/Games/LudoBattleRoyal.jsx');
const plain=v=>JSON.parse(JSON.stringify(v));
test('production lens, portrait/landscape tuning and zoom bounds match Ludo',()=>{
  for(const name of ['CAMERA_FOV','CAMERA_NEAR','CAMERA_FAR','CAMERA_TARGET_LIFT',
    'PORTRAIT_CAMERA_TUNING','LANDSCAPE_CAMERA_TUNING','CAMERA_EXTRA_LIFT'])
    assert.deepEqual(plain(snake.get(name)),plain(ludo.get(name)),name);
  for(const key of ['fov','near','far','phiMin','phiMax'])assert.equal(snake.get('CAM')[key],ludo.get('CAM')[key],key);
  for(const key of ['minR','maxR'])assert.equal(snake.get('CAM')[key]/snake.get('CAMERA_BASE_RADIUS'),ludo.get('CAM')[key]/ludo.get('CAMERA_BASE_RADIUS'),key);
  assert.equal(snake.get('CAMERA_LOOK_TARGET_FORWARD_BIAS'),ludo.get('PLAYER_VIEW_LOOK_TARGET_FORWARD_BIAS'));
  assert.equal(snake.get('CAMERA_TOPDOWN_RADIUS_FACTOR'),ludo.get('CAMERA_2D_DISTANCE_FACTOR'));
});
test('camera reset participates in the view effect and tracks the live seated head with fixed lens',()=>{
  assert.match(snake.source,/cameraResetKey = 0/);
  assert.match(snake.source,/\[cameraViewMode, cameraResetKey, keyForEffect, activePlayerCount\]/);
  assert.match(snake.source,/return SEATED_PLAYER_VIEW\.fov/);
  assert.doesNotMatch(snake.source,/Math\.atan\(slope \/ 0\.94\)/);
});
