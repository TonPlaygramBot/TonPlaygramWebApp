import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {constructionProfile,isConstruction,insideFootprint,equipmentPad} from '../webapp/src/games/tirana-construction/constructionCore.mjs';
import {DEVELOPMENT_BUILDINGS} from '../webapp/src/games/tirana-construction/developmentBuildings.mjs';
import {DEVELOPMENT_SITES} from '../webapp/src/games/tirana-construction/developmentSites.mjs';
import {humanMotion,smoothHeading} from '../webapp/src/games/tiranastreets/street-career/humanMotion.mjs';
const require=createRequire(new URL('../webapp/package.json',import.meta.url));
const fixture={id:'test',p:[[-12,-10],[12,-10],[12,10],[-12,10]],h:12.8,tags:{building:'construction'}};
test('construction requires positive evidence and respects existing height and courtyards',()=>{
 assert.equal(isConstruction({...fixture,tags:{building:'apartments',construction:'no'}}),false);
 assert.equal(isConstruction({...fixture,tags:{building:'yes'},heightSource:'unknown'}),false);
 assert.equal(constructionProfile(fixture).floors,4);
 const b={...fixture,holes:[[[-4,-4],[4,-4],[4,4],[-4,4]]]};assert.equal(insideFootprint([0,0],b),false);
 const pad=equipmentPad(b);if(pad)assert.ok(insideFootprint([pad.x,pad.z],b));
});
test('three developments retain mapped sites and separate planned height from authored stage',()=>{
 assert.equal(DEVELOPMENT_BUILDINGS.length,3);
 for(const b of DEVELOPMENT_BUILDINGS){const site=DEVELOPMENT_SITES.find(s=>s.id===b.development);assert.ok(site);assert.ok(b.p.every(p=>insideFootprint(p,site)));assert.ok(b.h<site.plannedFloors*3.2);assert.equal(b.heightSource,'authored');assert.ok(site.source.startsWith('https://www.openstreetmap.org/way/'));}
});
test('motion selection preserves cycling and uses walking fallback for rigs without run',()=>{
 const clips=[{name:'Idle'},{name:'Walk'}];assert.equal(humanMotion({speed:4,health:100},clips).clip,clips[1]);
 assert.equal(humanMotion({speed:4,health:100,motion:'cycle'},clips).clip,undefined);
 assert.equal(humanMotion({speed:0,health:100},clips).clip,clips[0]);
 assert.ok(humanMotion({speed:2,health:100},clips).rate>humanMotion({speed:1,health:100},clips).rate);
 const a=Math.PI-.05,b=-Math.PI+.05,next=smoothHeading(a,b,1/60);assert.ok(next>a&&next<a+.1);
 assert.ok(Math.abs(smoothHeading(smoothHeading(0,1,1/120),1,1/120)-smoothHeading(0,1,1/60))<1e-12);
});
test('actual construction meshes stay finite, bounded and open, with nearby equipment',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tirana-construction-'));
 try{
 const file=join(dir,'geometry.mjs');await require('esbuild').build({entryPoints:['webapp/src/games/tirana-construction/constructionGeometry.ts'],bundle:true,platform:'node',format:'esm',outfile:file});
 const {constructionGeometry}=await import(pathToFileURL(file));
 for(const b of [fixture,...DEVELOPMENT_BUILDINGS])for(const detail of [false,true]){
  const g=constructionGeometry(b,detail);assert.ok(g);const p=g.getAttribute('position');assert.ok(p.count<100000);assert.ok([...p.array].every(Number.isFinite));assert.equal(g.getAttribute('color').count,p.count);g.computeBoundingBox();assert.ok(g.boundingBox.min.y>=-1e-5);assert.ok(g.boundingBox.max.y<=b.h+10);g.dispose();
 }
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('picking up a weapon cannot bypass an existing shot cooldown',async()=>{
 const {collectWeapon}=await import('../webapp/src/games/tiranastreets/shared/cityPopulation.mjs');
 const {WEAPONS}=await import('../webapp/src/games/tiranastreets/shared/weapons.mjs');const w=WEAPONS.find(w=>w.magazine>0&&!w.radius);
 const p={id:'local',x:0,z:0,health:100,nextShot:12.5,reloadAt:14,inventory:{}};
 const s={elapsed:12,pickups:[{id:'pickup',weapon:w.id,x:0,z:0,ammo:w.magazine}]};
 assert.equal(collectWeapon(s,p,'pickup'),true);assert.equal(p.nextShot,12.5);assert.equal(p.reloadAt,0);assert.equal(collectWeapon(s,p,'pickup'),false);
});
