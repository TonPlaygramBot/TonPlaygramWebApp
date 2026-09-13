import { readFile, writeFile } from 'node:fs/promises';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { parse } from '../webapp/node_modules/@babel/parser/lib/index.js';
const source = await readFile(new URL('../webapp/src/pages/Games/LudoBattleRoyal.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'Ludo3D');
const decl = component.body.body.flatMap(n => n.declarations || []).find(n => n.id.name === 'syncDiceToThrowHand');
const expression = source.slice(decl.init.start, decl.init.end);
const dir = new URL('../webapp/src/previews/ludo/generated/', import.meta.url);
const check = `
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeActor, V, world } from '../motion';
import { solveArm, world as boneWorld } from '../../../utils/ludoHumanMotion';
import { applySeatedHumanPose } from './rig';
import { FIREARM_CAPTURE_ANIMATION_IDS, getLudoFirearmBallistics, createCaliberProjectileFx, createCaliberShellCasingFx } from '../../../utils/ludoFirearmPresentation';
const json=JSON.parse(await readFile(new URL('./avatar.json',import.meta.url),'utf8'));
const entry={...makeActor(json),playerIndex:0,propMotion:null};
const scene=new THREE.Scene();scene.add(entry.actor);
const dice=new THREE.Object3D();dice.position.set(-.20,.48,-.52);scene.add(dice);
const seatedHumanActorsRef={current:[entry]}, seatedHumanActionRef={current:{}};
const useCallback=fn=>fn, smooth01=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const SEATED_HUMAN_DICE_PHASES={windupMs:300,releaseMs:260};
let now=1000, queue=[];
const performance={now:()=>now}, requestAnimationFrame=fn=>queue.push(fn);
const sync=${expression};
let assertions=0;
function check(v,label){assert(v,label);assertions++;}
const initial=dice.position.clone(), actorInitial=entry.actor.position.clone();
let valid=true;const pending=sync(0,dice,{isCurrent:()=>valid});
function frame(t){now=1000+t;const batch=queue;queue=[];batch.forEach(fn=>fn());}
for(const t of [0,100,300,549,650,719]){frame(t);check(dice.position.distanceTo(initial)<1e-10,'die fixed before pickup');}
for(const t of [720,850,1080,1250,1340]){frame(t);check(dice.position.distanceTo(world(entry.rightPalm))<1e-8,'die contact through throw');}
await pending;
check(entry.propMotion===null,'release clears rig owner');
check(entry.actor.position.distanceTo(actorInitial)<1e-10,'seated root fixed');
now=3000;const cancelled=sync(0,dice,{isCurrent:()=>valid});const before=dice.position.clone();valid=false;frame(2100);await cancelled;
check(dice.position.distanceTo(before)<1e-10,'stale pickup cannot change die');
for(const id of FIREARM_CAPTURE_ANIMATION_IDS){
 const profile=getLudoFirearmBallistics(id),bullet=createCaliberProjectileFx(profile),shell=createCaliberShellCasingFx(profile);
 check(bullet.userData.source?.endsWith('.blend'),'Blender projectile '+id);
 check(shell.userData.source?.endsWith('.blend'),'Blender shell '+id);
 const size=new THREE.Box3().setFromObject(bullet).getSize(V());
 check(size.x>0&&size.y>0&&size.z>0&&size.toArray().every(Number.isFinite),'valid geometry '+id);
 bullet.userData.dispose();
}
console.log(assertions+' live-controller and asset checks passed');
`;
await writeFile(new URL('presentation-check.ts',dir),check);
await build({entryPoints:[new URL('presentation-check.ts',dir).pathname],bundle:true,platform:'node',format:'esm',outfile:new URL('presentation-check.mjs',dir).pathname});
await import(new URL('presentation-check.mjs',dir).href);
