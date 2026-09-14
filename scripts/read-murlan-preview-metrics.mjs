import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from '../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';

const requireWebapp = createRequire(new URL('../webapp/package.json', import.meta.url));
const { transform } = requireWebapp('esbuild');
const { parse } = requireWebapp('@babel/parser');
const noop = () => {};
const transformData = object => ({
  position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray()
});

/**
 * Build the motion inspection preview from the real arena source and bundled avatar.
 * Use the arena's procedural fallback chair/table dimensions so unavailable remote
 * assets cannot change the measured grounding. Materials and game side effects
 * are omitted. Seating, card fans and placement use production code.
 */
export async function readMurlanPreviewMetrics() {
  const source = await readFile(new URL('../webapp/src/pages/Games/MurlanRoyaleArena.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const nodes = [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type) nodes.push(node);
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child?.type) walk(child);
    }
  };
  walk(ast.program);
  const snippet = node => {
    if (!node) throw new Error('Production Murlan preview integration is missing');
    return source.slice(node.start, node.end);
  };
  const definition = name => nodes.find(node => node.type === 'VariableDeclarator' && node.id?.name === name);
  const namedFunction = name => ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  const context = vm.createContext({
    THREE, console, Map, Set, Math, Object, Array, Number, Boolean,
    performance: { now: () => 0 }, window: undefined, cloneSkeleton,
    applySRGBColorSpace: noop, preserveOriginalCharacterMaterials: noop,
    enhanceMurlanCharacterMaterials: noop, applyHandCardLayering: noop,
    setBackLogoOrientation: noop, updateCardFace: noop,
    setCommunityCardLegibility: noop, applyTableCardLayering: noop,
    stepCharacterActions: noop, updateRigContactHelpers: noop
  });
  const run = code => vm.runInContext(code, context, { timeout: 2000 });
  const handSource = await readFile(new URL('../webapp/src/pages/Games/shared/MurlanHandController.ts', import.meta.url), 'utf8');
  const transpiled = await transform(handSource, { loader: 'ts', format: 'cjs', target: 'es2022' });
  context.module = { exports: {} };
  context.exports = context.module.exports;
  context.require = name => {
    if (name === 'three') return THREE;
    throw new Error(`Unexpected Murlan hand controller dependency: ${name}`);
  };
  run(transpiled.code);
  Object.assign(context, context.module.exports);

  // Resolve the top-level production constants in dependency order. Unrelated
  // browser/UI definitions may remain unresolved; every consumed metric is required.
  let pending = ast.program.body.flatMap(statement => {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    return declaration?.type === 'VariableDeclaration'
      ? declaration.declarations.filter(item => item.id.type === 'Identifier' && item.init)
      : [];
  });
  for (let iteration = 0; iteration < 16 && pending.length; iteration++) {
    const unresolved = [];
    for (const declaration of pending) {
      try { run(`globalThis.${declaration.id.name} = (${snippet(declaration.init)});`); }
      catch { unresolved.push(declaration); }
    }
    if (unresolved.length === pending.length) break;
    pending = unresolved;
  }
  for (const name of [
    'normalizeCharacterPivot', 'fitCharacterModelForSeat', 'shouldPreserveOriginalCharacterMaterials',
    'createProceduralChair', 'groundObjectToY',
    'findBoneByHints', 'captureBoneRotation', 'applyRotationOffset', 'computeHeldCardsPose',
    'createCharacterRig', 'attachSeatedCharacter', 'resolveSeatHandRadius', 'calcFanCardPose',
    'cardIdNoise', 'setMeshPosition', 'orientMesh', 'easeOutCubic', 'easeInOutCubic'
  ]) run(snippet(namedFunction(name)));

  const configSource = await readFile(new URL('../webapp/src/config/murlanCharacterThemes.js', import.meta.url), 'utf8');
  const configAst = parse(configSource, { sourceType: 'module' });
  const catalog = configAst.program.body.find(node => node.type === 'VariableDeclaration' && node.declarations[0].id.name === 'CHARACTER_THEME_CATALOG');
  const currentTheme = catalog?.declarations[0].init.arguments[0].elements.find(node => node.properties.some(property => property.key?.name === 'id' && property.value?.value === 'rpm-current'));
  if (!currentTheme) throw new Error('Production rpm-current character theme is missing');
  context.khronosThumb = () => '';
  run(`globalThis.characterTheme = (${configSource.slice(currentTheme.start, currentTheme.end)});`);
  context.characterTheme.preserveOriginalMaterials = true;

  const buffer = await readFile(new URL('../webapp/public/assets/pool-royale/readyplayer.me.glb', import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'MURLAN_PREVIEW_NO_TEXTURES', loadTexture: () => Promise.resolve(null) }));
  const gltf = await new Promise((resolve, reject) => loader.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '', resolve, reject));
  context.template = gltf.scene;
  context.chairTemplate = context.createProceduralChair({}).chairTemplate;
  context.arenaGroup = new THREE.Group();
  context.players = Array.from({ length: 4 }, (_, seat) => ({
    isHuman: seat === 0,
    hand: Array.from({ length: 13 }, (_, index) => ({ id: `${seat}-${index}`, rank: String(index + 2), suit: 'H' }))
  }));
  context.getVisualSeatIndex = index => index;
  context.threeStateRef = { current: { chairInstances: [], characterInstances: [], animations: [], selectionTargets: [] } };
  context.seatConfigs = [];
  context.activeSeatCount = 4;
  // Match the procedural fallback used when remote chair/table assets are absent.
  context.activeTableRadius = context.TABLE_RADIUS;
  const chairLoop = nodes.find(node => node.type === 'ForStatement' && snippet(node).includes('seatConfigs.push({') && snippet(node).includes('chair.lookAt('));
  run(snippet(chairLoop));
  context.threeStateRef.current.seatConfigs = context.seatConfigs;
  for (let index = 0; index < 4; index++) {
    context.attachSeatedCharacter({ template: context.template, seatConfig: context.seatConfigs[index], characterTheme: context.characterTheme, store: context.threeStateRef.current, player: context.players[index], playerIndex: index, cardTheme: {} });
  }

  context.cardMap = new Map();
  const geometry = new THREE.BoxGeometry(context.CARD_W, context.CARD_H, context.CARD_D);
  for (const player of context.players) for (const card of player.hand) {
    const mesh = new THREE.Mesh(geometry);
    context.cardMap.set(card.id, { mesh });
    context.arenaGroup.add(mesh);
  }
  Object.assign(context, {
    three: context.threeStateRef.current,
    previous: { players: context.players }, state: { players: context.players, tableCards: [] },
    selectionSet: new Set(), handsVisible: new Set(), immediate: true,
    humanTurn: true, isInitialDealAnimation: false
  });
  context.three.cardMap = context.cardMap;
  context.three.tableAnchor = new THREE.Vector3(0, context.TABLE_HEIGHT + context.CARD_SURFACE_OFFSET, context.TABLE_CARD_AREA_FORWARD_SHIFT);
  const applyScene = definition('applyStateToScene')?.init?.arguments?.[0];
  const handLoop = applyScene?.body?.body.find(node => node.type === 'ExpressionStatement' && snippet(node).startsWith('state.players.forEach('));
  run(snippet(handLoop));
  context.arenaGroup.updateMatrixWorld(true);
  const seats = context.seatConfigs.map((seat, index) => {
    const bones = {};
    seat.characterRig.instance.traverse(object => { if (object.isBone) bones[object.name] = object.quaternion.toArray(); });
    return {
      label: index === 0 ? 'Bottom · You' : seat.forward.z < -0.45 ? 'Top' : seat.forward.x > 0 ? 'Right' : 'Left',
      chair: transformData(seat.chair), seatRoot: transformData(seat.characterRoot),
      instance: transformData(seat.characterRig.instance), bones,
      forward: seat.forward.toArray(), right: seat.right.toArray(),
      cards: context.players[index].hand.map(card => transformData(context.cardMap.get(card.id).mesh)),
      playFrames: [], playFramesByCard: []
    };
  });
  const tableStart = applyScene.body.body.findIndex(node => node.type === 'VariableDeclaration' && node.declarations[0].id.name === 'tableAnchor');
  const tableEnd = applyScene.body.body.findIndex(node => node.type === 'VariableDeclaration' && node.declarations[0].id.name === 'pileRightAxis');
  if (tableStart < 0 || tableEnd <= tableStart) throw new Error('Production table placement block is missing');
  const tableCode = source.slice(applyScene.body.body[tableStart].start, applyScene.body.body[tableEnd - 1].end);
  run(`globalThis.stepAnimations = ${snippet(definition('stepAnimations')?.init)};`);
  for (let index = 0; index < 4; index++) {
    for (let cardIndex = 0; cardIndex < context.players[index].hand.length; cardIndex++) {
      const card = context.players[index].hand[cardIndex];
      const mesh = context.cardMap.get(card.id).mesh;
      mesh.position.fromArray(seats[index].cards[cardIndex].position);
      mesh.position.y += context.HUMAN_SELECTION_OFFSET;
      context.state = { players: context.players, tableCards: [card], lastAction: { type: 'PLAY', playerIndex: index, cards: [card] } };
      context.immediate = false;
      context.three.animations = [];
      // Isolate lexical declarations so every card receives the same original target.
      run(`{ ${tableCode} }`);
      const frames = [];
      for (let frame = 0; frame <= 120; frame++) {
        const t = context.PRECISE_CARD_PLACE_DURATION_MS * frame / 120;
        context.stepAnimations(t);
        frames.push({ t, ...transformData(mesh) });
      }
      seats[index].playFramesByCard.push(frames);
    }
    seats[index].playFrames = seats[index].playFramesByCard[6];
  }
  const names = {
    tableY: 'TABLE_HEIGHT', tableRadius: 'TABLE_RADIUS', floorY: 'ARENA_GROUND_Y',
    cardW: 'CARD_W', cardH: 'CARD_H', cardD: 'CARD_D',
    selectionLift: 'HUMAN_SELECTION_OFFSET', playDuration: 'PRECISE_CARD_PLACE_DURATION_MS'
  };
  const metrics = Object.fromEntries(Object.entries(names).map(([key, name]) => {
    if (!Number.isFinite(context[name])) throw new Error(`Missing Murlan metric: ${name}`);
    return [key, context[name]];
  }));
  geometry.dispose();
  // Strip VM prototypes and normalize signed zero for an ordinary JSON payload.
  return JSON.parse(JSON.stringify({
    ...metrics,
    chairObject: context.seatConfigs[0].chair.userData.chairModel.toJSON(),
    seats
  }));
}
