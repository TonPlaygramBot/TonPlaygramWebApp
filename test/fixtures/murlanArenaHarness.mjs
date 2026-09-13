import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '../../webapp/node_modules/@babel/parser/lib/index.js';
import * as THREE from '../../webapp/node_modules/three/build/three.module.js';
import { clone } from '../../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import * as rules from '../../lib/murlan.js';
import * as contact from '../../webapp/src/games/murlan/cardContact.ts';
import * as motion from '../../webapp/src/games/murlan/cardMotion.ts';
import { loadPoseModel } from './poolRoyalPoseTrace.mjs';
const source = await readFile(new URL('../../webapp/src/pages/Games/MurlanRoyaleArena.jsx', import.meta.url), 'utf8');
const program = parse(source, { sourceType: 'module', plugins: ['jsx'] }).program;
const declarations = new Map();
for (const node of program.body) {
  if (node.type === 'VariableDeclaration') for (const item of node.declarations) if (item.id.type === 'Identifier') declarations.set(item.id.name, item.init);
  if (node.type === 'FunctionDeclaration') declarations.set(node.id.name, node);
}
const arena = program.body.find((node) => node.type === 'ExportDefaultDeclaration')?.declaration;
const applyState = arena?.body.body.flatMap((node) => node.type === 'VariableDeclaration' ? node.declarations : [])
  .find((node) => node.id.name === 'applyStateToScene')?.init.arguments[0];
const handLoop = applyState?.body.body.find((node) => node.type === 'ExpressionStatement' &&
  source.slice(node.start, node.end).startsWith('state.players.forEach('));
export function arenaHarness(extra = {}) {
  const context = vm.createContext({ THREE, ...rules, BASE_CONFIG: rules.DEFAULT_CONFIG, ...contact, ...motion,
    console, performance, cloneSkeleton: clone, Map, Set, Math, URLSearchParams,
    HUMAN_CARD_HAND_DEBUG_HELPERS: false, preserveOriginalCharacterMaterials() {},
    enhanceMurlanCharacterMaterials() {}, shouldPreserveOriginalCharacterMaterials: () => true,
    ...extra });
  if (handLoop) vm.runInContext(`this.applyTestHandState = function(state, selection, immediate = true) {
    ${source.slice(applyState.body.start + 1, handLoop.end)}
  }`, context);
  const load = (name) => {
    if (name in context) return;
    const node = declarations.get(name);
    if (!node) throw Error(`Missing arena definition ${name}`);
    const code = node.type === 'FunctionDeclaration' ? `this.${name} = ${source.slice(node.start, node.end)}` : `this.${name} = (${source.slice(node.start, node.end)})`;
    for (let i = 0; i < 30; i++) {
      try { vm.runInContext(code, context); return; }
      catch (error) { const missing = error.message.match(/^(\w+) is not defined$/)?.[1]; if (!missing) throw error; load(missing); }
    }
    throw Error(`Could not load ${name}`);
  };
  const invoke = (name, ...args) => {
    load(name);
    for (let attempt = 0; attempt < 100; attempt++) {
      try { return context[name](...args); }
      catch (error) {
        const missing = error.message.match(/^(\w+) is not defined$/)?.[1];
        if (!missing) throw error;
        load(missing);
      }
    }
    throw Error(`Could not invoke ${name}`);
  };
  return { context, load, invoke };
}
export async function loadArenaCharacter(seatIndex = 0) {
  const { context: c, load } = arenaHarness();
  for (const name of ['findBoneByHints','captureBoneRotation','applyRotationOffset','createCharacterRig',
    'fitCharacterModelForSeat','normalizeCharacterPivot','attachSeatedCharacter',
    'MODEL_SCALE','CHARACTER_PROPORTION_SCALE','HUMAN_CHARACTER_EXTRA_LOWER_OFFSET',
    'HUMAN_CHARACTER_EXTRA_OUTWARD_OFFSET','HUMAN_CHARACTER_TARGET_SEATED_HEIGHT',
    'TABLE_RADIUS','CARD_H','CARD_W','TABLE_HEIGHT']) load(name);
  const scene = new THREE.Scene();
  const chair = new THREE.Group();
  const angle = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][seatIndex];
  chair.position.set(Math.cos(angle) * 3.35, 0.4, Math.sin(angle) * 3.35);
  chair.lookAt(new THREE.Vector3(0,0.4,0)); scene.add(chair);
  const seatConfig = { seatIndex, chair, forward: new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)), right:new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle)) };
  const store = {scene, characterInstances:[],characterRigs:new Map()};
  c.attachSeatedCharacter({ template:await loadPoseModel(), seatConfig, characterTheme:{scale:1,normalizedSeatOffsetY:-0.4,normalizedSeatOffsetZ:0.52},
    store, player:{isHuman:seatIndex===0},playerIndex:seatIndex });
  scene.updateMatrixWorld(true);
  return { rig:seatConfig.characterRig,scene,constants:c,seatConfig };
}
