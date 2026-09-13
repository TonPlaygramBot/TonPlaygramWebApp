import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {TRACKS,STEP,makeTrack,createRacer,equipKart,stepRace} from '../webapp/src/games/kartroyale/simulation.mjs';
import {circuitSides} from '../webapp/src/games/kartroyale/trackEdges.mjs';
import {trackSurface,tyreBarrierLayout} from '../webapp/src/games/kartroyale/tyreBarrierCore.mjs';
import {buildingClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {TYRE_RADIUS} from '../webapp/src/games/kartroyale/roadFeel.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';

// Reproduce the main-branch placements before this fix, for regression evidence.
function previousLayout(track) {
  const points=track.points.map(p=>({...p,width:p.width+1.24})),sides=circuitSides(points,track.width/2+.62),positions=[];
  for(const side of [sides.left,sides.right]){let remainder=0;
    for(let i=0;i<side.length;i++){const a=side[i],b=side[(i+1)%side.length],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<1e-6)continue;
      let at=remainder;for(;at<length;at+=.94)positions.push({x:a.x+(b.x-a.x)*at/length,z:a.z+(b.z-a.z)*at/length});remainder=at-length;
    }
  }return positions;
}
function audit(track,positions) {
  const surface=trackSurface(track),grid=new Map(),examples=[];
  let asphaltIntrusions=0,buildingIntrusions=0,overlappingPairs=0,minRoadClearance=Infinity,minSpacing=Infinity;
  for(const p of positions){
    const clearance=surface.clearance(p.x,p.z),building=buildingClearance(p.x,p.z);minRoadClearance=Math.min(clearance,minRoadClearance);
    if(clearance<TYRE_RADIUS-.005){asphaltIntrusions++;if(examples.length<8)examples.push({...p,clearance});}
    if(building<TYRE_RADIUS-.005)buildingIntrusions++;
    const ix=Math.floor(p.x/2),iz=Math.floor(p.z/2);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const q of grid.get(`${ix+dx},${iz+dz}`)||[]){
      const d=Math.hypot(p.x-q.x,p.z-q.z);minSpacing=Math.min(d,minSpacing);if(d<TYRE_RADIUS*2-.005)overlappingPairs++;
    }
    const key=`${ix},${iz}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);
  }
  return {count:positions.length,asphaltIntrusions,buildingIntrusions,overlappingPairs,minRoadClearance,minSpacing,examples};
}
const results=[],geometry=[];
for(const config of TRACKS) {
  const track=makeTrack(config.id),before=previousLayout(track),after=tyreBarrierLayout(track,buildingClearance).positions;
  const old=audit(track,before),current=audit(track,after);
  assert.equal(current.asphaltIntrusions,0,config.id+' asphalt');assert.equal(current.buildingIntrusions,0,config.id+' buildings');assert.equal(current.overlappingPairs,0,config.id+' overlapping tyres');
  const racer=equipKart(createRacer(track,'audit','Circuit inspection',0,true),'apex'),trace=[];
  let time=0,wallFrames=0;
  for(;time<400&&racer.gates<5;time+=STEP){stepRace([racer],track,STEP,time,'street');if(racer.wallContact)wallFrames++;if(Math.round(time/STEP)%12===0)trace.push([racer.x,racer.z]);}
  assert.ok(racer.gates>=5&&racer.lap>=2,config.id+' full lap through all ordered gates');
  const result={track:config.id,length:track.length,before:old,after:current,lap:{seconds:time,gates:racer.gates,lap:racer.lap,wallFrames}};
  results.push(result);geometry.push({id:config.id,points:track.points,polygons:trackSurface(track).polygons,before,after,trace,issues:old.examples});
  console.log(JSON.stringify({...result,before:{...old,examples:undefined},after:{...current,examples:undefined}}));
}
const out=process.argv[2]||'docs/validation/racing-corners';await mkdir(out,{recursive:true});
await writeFile(out+'/results.json',JSON.stringify({scope:'One complete fixed-step AI inspection lap per circuit; exact rendered asphalt triangles and full tyre footprints. Browser and phone QA are separate.',results},null,2)+'\n');
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify({tracks:geometry,buildings:WORLD.buildings}));
