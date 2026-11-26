import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HYDROGRAPHY} from '../webapp/src/games/tirana-environment/hydrography.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets-november/shared/world.mjs';
import {LANA_CRAFT_DRAW_RADIUS,LANA_CRAFT_LOAD_RADIUS,LANA_SOLO_WATER_LEVEL,lanaCraftAnchors} from '../webapp/src/games/tiranastreets-november/lanaWatercraftLayout.mjs';
const gap=(p,r)=>{
 const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1];
 const t=Math.max(0,Math.min(1,((p.x-r.a[0])*dx+(p.z-r.a[1])*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(p.x-r.a[0]-t*dx,p.z-r.a[1]-t*dz);
};
test('three craft fit one mapped reach without overlapping roads or each other',()=>{
 const anchors=lanaCraftAnchors(HYDROGRAPHY.paths);assert.equal(anchors.length,3);
 const [a,b]=HYDROGRAPHY.paths.find(p=>p.id==='733080610').line.slice(8,10);
 for(const p of anchors){
  assert.ok(Math.abs(gap(p,{a,b})-2)<.0001);
  assert.ok(WORLD.roads.every(r=>gap(p,r)>r.w/2+2));
 }
 assert.ok(anchors.slice(1).every((p,i)=>Math.hypot(p.x-anchors[i].x,p.z-anchors[i].z)>8));
 assert.deepEqual(lanaCraftAnchors([]),[]);
});
test('visual level stays below the Lana bank shoulder and loads before entering draw range',()=>{
 assert.ok(LANA_SOLO_WATER_LEVEL>-2.85&&LANA_SOLO_WATER_LEVEL<-1.6);
 assert.ok(LANA_CRAFT_DRAW_RADIUS<LANA_CRAFT_LOAD_RADIUS);
});
