import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {RURAL_ROUTES} from '../webapp/src/games/kartroyale/rural-routes.mjs';
import {makeTrack} from '../webapp/src/games/kartroyale/simulation.mjs';
import {trackSurface,tyreBarrierLayout} from '../webapp/src/games/kartroyale/tyreBarrierCore.mjs';
import {courseClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {jumpRamps} from '../webapp/src/games/kartroyale/jumpRamps.mjs';
const data=RURAL_ROUTES.map(r=>{
  const track=makeTrack(r.id),[x0,z0,x1,z1]=track.bounds;
  const near=p=>p[0]>x0-90&&p[1]>z0-90&&p[0]<x1+90&&p[1]<z1+90;
  return {id:r.id,name:r.name,track,polygons:trackSurface(track).polygons,
    tyres:tyreBarrierLayout(track,(x,z)=>courseClearance(track,x,z)).positions,ramps:jumpRamps(track),
    roads:WORLD.roads.filter(r=>near(r.a)&&near(r.b)).map(r=>({a:r.a,b:r.b})),
    buildings:WORLD.buildings.filter(b=>b.p.some(near)).map(b=>b.p),
    water:WORLD.waterAreas.flatMap(w=>w.polygons).filter(p=>p.outer.some(near))};
});
const dir=new URL('../docs/validation/racing-rural/',import.meta.url);await mkdir(dir,{recursive:true});
const result=execFileSync('python3',[fileURLToPath(new URL('./audit-racing-rural.py',import.meta.url)),fileURLToPath(new URL('routes.png',dir))],{input:JSON.stringify(data),encoding:'utf8',maxBuffer:3e6});
await writeFile(new URL('geometry.json',dir),JSON.stringify(JSON.parse(result),null,2)+'\n');console.log(result);
