/** Verify the review uses exact production targets, transforms, layout, collision shuffle, and knock timing. Run from any directory. */
import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(appRoot);
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json');
const {parse}=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const {buildSync,transformSync}=require('esbuild');
const THREE=require('three');
const source=fs.readFileSync('public/domino-royal-game.js','utf8');
const prodAst=parse(source,{sourceType:'module'});
const file=fs.readFileSync('scripts/domino-royal-production-motion.ts','utf8');
const previewAst=parse(file,{sourceType:'module',plugins:['typescript']});
const load=(code)=>{const ctx={exports:{},module:{exports:{}},require};ctx.module.exports=ctx.exports;vm.runInNewContext(code,ctx);return ctx.module.exports;};
const runtime=load(buildSync({entryPoints:['scripts/domino-royal-production-motion.ts'],bundle:true,write:false,format:'cjs',platform:'node',external:['three'],logLevel:'silent'}).outputFiles[0].text);
const P=load(transformSync(fs.readFileSync('scripts/domino-royal-motion-helpers.ts','utf8'),{loader:'ts',format:'cjs'}).code);
const methodNames=Object.keys(runtime.PRODUCTION_MOTION_SOURCE.functions);
const previewFns=new Map();
traverse(previewAst,{FunctionDeclaration(p){if(methodNames.includes(p.node.id.name))previewFns.set(p.node.id.name,p.node);}});
for(const name of methodNames){const original=prodAst.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);const exported=previewFns.get(name);assert.equal(file.slice(exported.start,exported.end),source.slice(original.start,original.end),'Exact body drift: '+name);}
console.log('All '+methodNames.length+' function bodies exactly match current production source.');
const constNames=new Set(Object.keys(P.PRODUCTION_MOTION_CONSTANTS).concat('UP','DOMINO_UP','DOMINO_FORWARD','DOMINO_RIGHT','DOMINO_BASIS'));
const fnNames=methodNames.concat('getHumanHandCountScale','getDominoHandScale','layoutSeat','getVisualSeatIndex','computeHandSlotPosition','smoothPlacementStep','resolvePrecisionPlacementPosition','seatBasisForAngle','seatBasisForIndex','computeDesiredCameraPosition');
let code='';
for(const n of prodAst.program.body){if(n.type==='VariableDeclaration'&&n.declarations.some(d=>constNames.has(d.id.name)))code+=source.slice(n.start,n.end)+'\n';if(n.type==='FunctionDeclaration'&&fnNames.includes(n.id.name))code+=source.slice(n.start,n.end)+'\n';}
const env=()=>({THREE,N:4,human:0,piecesG:new THREE.Group(),players:[{hand:[]},{hand:[]},{hand:[]},{hand:[]}],chairs:[],seatedHumanActors:[],DOMINO_SEATED_HUMANS:{},dominoHandContacts:new Map(),openingSequence:null,placementAnimations:[],drawAnimations:[],knockAnimations:[],cameraViewMode:'3d',VIEW_MODES:{twoD:'2d'},getViewportMetrics:()=>({isPortrait:true}),boneyard:[],SFX:{pass(){},place(){},drawTile(){}},showPassBubble(){},nextTurn(){},flushPendingDominoState(){}});
const original=env();vm.createContext(original);vm.runInContext(code,original);
const previewEnv=env();const api=runtime.createProductionDominoMotion(previewEnv);
let cases=0;
for(const playerCount of [2,3,4])for(let human=0;human<playerCount;human++)for(let seat=0;seat<playerCount;seat++)for(let count=1;count<=28;count++)for(const isTopDown of [true,false])for(const slot of [0,Math.floor((count-1)/2),count-1]){original.N=playerCount;original.human=human;const a=original.computeHandSlotPosition(seat,slot,count,{isTopDown});const b=P.computeHandSlotPosition(seat,slot,count,{isTopDown,human,playerCount});assert.ok(a.distanceTo(b)<1e-12);assert.equal(original.getDominoHandScale(seat,count),P.getDominoHandScale(seat,count,{human,playerCount}));cases++;}
console.log('Hand position/scale parity: '+cases+' cases.');
const meshA=new THREE.Group(),meshB=new THREE.Group();
for(const mesh of [meshA,meshB]){mesh.position.set(.8,1.2,-.3);mesh.rotation.set(.4,.2,-.1);mesh.scale.set(.13,.07,.11);}
for(let edge=0;edge<4;edge++){const a=original.dominoPickupTarget(meshA,edge,.4),b=api.dominoPickupTarget(meshB,edge,.4);for(const key of ['position','palmNormal','approachDirection'])assert.ok(a[key].distanceTo(b[key])<1e-12);assert.equal(a.gripMode,b.gripMode);}
console.log('All four pickup edges preserve position, orientation and grip mode.');
const sequence=()=>({dealer:1,tiles:Array.from({length:28},(_,i)=>{const mesh=new THREE.Group();const home=new THREE.Vector3((i%7-3)*Math.hypot(P.DOMINO_WIDTH,P.DOMINO_LENGTH)*1.075,P.CLOTH_TOP+.02,(Math.floor(i/7)-1.5)*P.DOMINO_LENGTH*1.28);mesh.position.copy(home);return {mesh,home,yaw:Math.PI/2+(i%3-1)*.04,spin:(i%5-2)*.3,velocity:new THREE.Vector3()};})});
original.N=4; original.human=0;
const a=sequence(),b=sequence();
for(let step=0;step<=192;step++){const t=step/192,now=t*P.OPENING_SHUFFLE_ANIM_DURATION;original.updateDominoShuffleTiles(a,t,now);api.updateDominoShuffleTiles(b,t,now);for(let i=0;i<28;i++){assert.ok(a.tiles[i].mesh.position.distanceTo(b.tiles[i].mesh.position)<1e-12);assert.ok(a.tiles[i].velocity.distanceTo(b.tiles[i].velocity)<1e-12);assert.ok(a.tiles[i].mesh.quaternion.angleTo(b.tiles[i].mesh.quaternion)<1e-7);}}
console.log('Full production shuffle parity: 28 tiles × 193 samples, including collisions and palm impulses.');
for(let step=0;step<=100;step++){const t=step/100;const anim={start:new THREE.Vector3(.2,1,-.5),end:new THREE.Vector3(-.4,.8,.6),arc:.12,mesh:new THREE.Group(),startQuat:new THREE.Quaternion(),endQuat:new THREE.Quaternion().setFromEuler(new THREE.Euler(0,.5,1)),startScale:new THREE.Vector3(.1,.1,.1),endScale:new THREE.Vector3(.2,.07,.1)};api.sampleDominoTravelTransform(anim,t);assert.ok(anim.mesh.position.distanceTo(original.resolvePrecisionPlacementPosition(anim,t))<1e-12);const rotate=original.smoothPlacementStep(P.PLACE_ANIM_LIFT_END,P.PLACE_ANIM_LOWER_END,t);assert.ok(anim.mesh.quaternion.angleTo(anim.startQuat.clone().slerp(anim.endQuat,rotate))<1e-7);assert.ok(anim.mesh.scale.distanceTo(anim.startScale.clone().lerp(anim.endScale,rotate))<1e-12);}
console.log('101 exact travel position/rotation/scale samples pass.');
const spawnEnv=env();spawnEnv.boneyard=Array.from({length:28},(_,i)=>({a:Math.floor(i/7),b:i%7}));spawnEnv.makeDomino=()=>new THREE.Group();const spawnAPI=runtime.createProductionDominoMotion(spawnEnv);spawnAPI.spawnOpeningShuffleAnimation();assert.equal(spawnEnv.openingSequence.tiles.length,28);assert.equal(spawnEnv.openingSequence.phase,'waiting');assert.equal(spawnEnv.piecesG.children.length,28);
console.log('Opening spawn works with minimal preview injection and default lifecycle callbacks.');
let impacts=0,turns=0;
spawnEnv.openingSequence=null;
spawnEnv.SFX={pass(){impacts++;}};
spawnEnv.nextTurn=()=>{turns++;};
spawnEnv.seatedHumanActors[1]={rig:{leftUpperArm:new THREE.Object3D(),rightUpperArm:new THREE.Object3D()}};
spawnEnv.knockAnimations.push({sourceSeat:1,startTime:0,impactPlayed:false});
spawnAPI.updateKnockAnimations(0);
spawnAPI.updateKnockAnimations(P.KNOCK_DURATION*P.KNOCK_CONTACT_PHASE);
spawnAPI.updateKnockAnimations(P.KNOCK_DURATION*P.KNOCK_CONTACT_PHASE);
assert.equal(impacts,1);
assert.equal(spawnEnv.dominoHandContacts.get(1).right.gripMode,'fist');
spawnAPI.updateKnockAnimations(P.KNOCK_DURATION);
assert.equal(turns,1);assert.equal(spawnEnv.knockAnimations.length,0);
console.log('Mutable environment replacement, knock contact sound once, and completion callbacks pass.');

// Tile touchdown keeps the original transport timing. A separate 350 ms hand
// return must finish before disposal, turn callbacks or the next opening draw.
const timingScenarios = [
  { kind: 'place', duration: P.PLACE_ANIM_DURATION, expectedTotal: 1684 },
  { kind: 'draw', duration: P.DRAW_ANIM_DURATION, expectedTotal: 1049.2 },
  { kind: 'opening-draw', duration: P.OPENING_DEAL_ANIM_DURATION, expectedTotal: 975.6 }
];
assert.equal(P.DOMINO_HAND_RETURN_DURATION, 350);
let timingSamples = 0;
for (const { duration, expectedTotal } of timingScenarios) {
  const touchdown = duration * P.PLACE_ANIM_LOWER_END;
  for (const elapsed of [-100, 0, duration * P.PLACE_ANIM_PICK_HOLD, duration * P.PLACE_ANIM_LIFT_END,
    touchdown - .001, touchdown, touchdown + 175, duration, expectedTotal - .001, expectedTotal, expectedTotal + 100]) {
    const actual = api.sampleDominoActionProgress(elapsed, duration);
    const expected = original.sampleDominoActionProgress(elapsed, duration);
    for (const key of ['tileT', 'handT', 'finished', 'totalDuration']) {
      assert.equal(actual[key], expected[key], 'Timing parity: ' + key + ' at ' + elapsed + ' ms');
    }
    assert.equal(actual.totalDuration, expectedTotal);
    assert.equal(actual.finished, elapsed >= expectedTotal);
    if (elapsed === touchdown) {
      assert.equal(actual.tileT, P.PLACE_ANIM_LOWER_END);
      assert.equal(actual.handT, P.PLACE_ANIM_LOWER_END);
    }
    if (elapsed === duration) {
      assert.equal(actual.tileT, 1, 'The tile finishes on its original clock');
      assert.ok(actual.handT < 1, 'The hand is still returning after original tile duration');
      assert.equal(actual.finished, false, 'Original tile endpoint must not finish the whole action');
    }
    timingSamples++;
  }
}
console.log('Separate tile/hand timing parity: ' + timingSamples + ' samples across place, draw and opening draw.');

function controllerHarness(kind, duration, useProduction) {
  const state = env();
  const events = { completed: 0, renderedHands: 0, renderedChain: 0, flushed: 0, placeSound: 0, drawSound: 0 };
  state.makeDomino = () => new THREE.Group();
  state.disposeDominoMesh = mesh => mesh.removeFromParent();
  state.renderHands = () => { events.renderedHands++; };
  state.renderChain = () => { events.renderedChain++; };
  state.flushPendingDominoState = () => { events.flushed++; };
  state.SFX = {
    place: () => { events.placeSound++; },
    drawTile: () => { events.drawSound++; },
    pass() {}
  };
  const tile = { a: 2, b: 6, inTransit: kind !== 'place', openingPending: kind === 'opening-draw' };
  state.players[1].hand.push(tile);
  const mesh = new THREE.Group();
  mesh.position.set(.5, P.CLOTH_TOP + .05, .2);
  mesh.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  mesh.scale.set(.1, .07, .1);
  state.piecesG.add(mesh);
  const anim = {
    mesh, tile, sourceSeat: 1, startTime: 0, duration,
    start: mesh.position.clone(), startQuat: mesh.quaternion.clone(), startScale: mesh.scale.clone(),
    end: new THREE.Vector3(0, P.CHAIN_TILE_Y, 0), endQuat: new THREE.Quaternion(),
    endScale: new THREE.Vector3(.1, .08, .1), arc: P.PLACE_ANIM_ARC,
    onComplete: () => { events.completed++; }
  };
  if (kind === 'place') anim.segment = { tile, animating: true };
  const queue = kind === 'place' ? state.placementAnimations : state.drawAnimations;
  queue.push(anim);
  let methods;
  if (useProduction) {
    vm.createContext(state);
    vm.runInContext(code, state);
    methods = state;
  } else methods = runtime.createProductionDominoMotion(state);
  return {
    state, anim, queue, events,
    update: elapsed => kind === 'place' ? methods.updatePlacementAnimations(elapsed) : methods.updateDrawAnimations(elapsed)
  };
}

for (const { kind, duration, expectedTotal } of timingScenarios) {
  const productionController = controllerHarness(kind, duration, true);
  const previewController = controllerHarness(kind, duration, false);
  const touchdown = duration * P.PLACE_ANIM_LOWER_END;
  let landed = null;
  for (const elapsed of [0, duration * P.PLACE_ANIM_PICK_HOLD, touchdown, touchdown + 175,
    duration, expectedTotal - .001, expectedTotal, expectedTotal + 100].sort((a, b) => a - b)) {
    productionController.update(elapsed);
    previewController.update(elapsed);
    const a = productionController.anim.mesh;
    const b = previewController.anim.mesh;
    assert.ok(a.position.distanceTo(b.position) < 1e-12, kind + ' controller position parity');
    assert.ok(a.quaternion.angleTo(b.quaternion) < 1e-7, kind + ' controller rotation parity');
    assert.ok(a.scale.distanceTo(b.scale) < 1e-12, kind + ' controller scale parity');
    assert.deepEqual(previewController.events, productionController.events, kind + ' lifecycle callback parity');
    if (elapsed === touchdown) {
      landed = { position: b.position.clone(), quaternion: b.quaternion.clone(), scale: b.scale.clone() };
      assert.ok(b.position.distanceTo(previewController.anim.end) < 1e-12, kind + ' lands at target');
    }
    if (landed && elapsed >= touchdown) {
      assert.ok(b.position.distanceTo(landed.position) < 1e-12, kind + ' planted tile must not follow withdrawing hand');
      assert.ok(b.quaternion.angleTo(landed.quaternion) < 1e-7, kind + ' planted tile rotation is fixed');
      assert.ok(b.scale.distanceTo(landed.scale) < 1e-12, kind + ' planted tile scale is fixed');
    }
    if (elapsed < expectedTotal) {
      assert.equal(previewController.queue.length, 1, kind + ' action stays active through hand return');
      assert.equal(previewController.events.completed, 0, kind + ' completion waits for hand return');
      assert.equal(previewController.events.renderedHands + previewController.events.renderedChain, 0);
      assert.equal(previewController.events.flushed, 0);
      if (kind !== 'place') assert.equal(previewController.anim.tile.inTransit, true);
    } else {
      assert.equal(previewController.queue.length, 0);
      assert.equal(previewController.events.completed, 1, kind + ' completes exactly once');
      assert.equal(previewController.events.renderedHands + previewController.events.renderedChain, 1);
      assert.equal(previewController.events.flushed, 1);
      if (kind !== 'place') assert.equal(previewController.anim.tile.inTransit, false);
    }
  }
  assert.equal(previewController.events.placeSound, kind === 'place' ? 1 : 0);
  assert.equal(previewController.events.drawSound, kind === 'place' ? 0 : 1);
}
console.log('Place/draw/opening controllers preserve planted tiles through hand return and complete callbacks exactly once at totalDuration.');
