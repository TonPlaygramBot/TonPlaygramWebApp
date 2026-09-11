import * as T from 'three';
import {collides,moveCircle,lineClear,type Obstacle} from '../../blackwater/core';
import {WORLD} from '../shared/world.mjs';
import {ORIGIN} from '../../blackwater/shared/layout.mjs';
import {buildMapGraph,findMapRoute} from '../map/mapCore.mjs';
import {CityLifeCore,type Point,type Nav,type LifeEvent,type Quality} from './CityLifeCore';
import {CityLifeLayer} from './CityLifeLayer';
/** Connects to the inspected main architecture without changing its map datasets.
 * Sidewalk offsets and circular vehicle collision are approximations: review in city.
 */
export function createCityLife(scene:T.Scene,obstacles:()=>Obstacle[],onEvent:(e:LifeEvent)=>void,quality:Quality='balanced'){
 const walk=buildMapGraph(WORLD,'walk'),drive=buildMapGraph(WORLD,'drive');
 type Road={a:number[];b:number[];walk?:boolean;w?:number;width?:number;highway?:string;access?:string};
 const cells=new Map<string,Road[]>();
 for(const r of WORLD.roads as Road[]){if(['private','no'].includes(r.access||'')||['motorway','motorway_link'].includes(r.highway||''))continue;const ax=r.a[0]-ORIGIN.x,bx=r.b[0]-ORIGIN.x,az=r.a[1]-ORIGIN.z,bz=r.b[1]-ORIGIN.z;
  for(let x=Math.floor(Math.min(ax,bx)/64);x<=Math.floor(Math.max(ax,bx)/64);x++)for(let z=Math.floor(Math.min(az,bz)/64);z<=Math.floor(Math.max(az,bz)/64);z++){const key=x+':'+z,list=cells.get(key)||[];list.push(r);cells.set(key,list);}
 }
 const v=(p:Point)=>new T.Vector3(p.x,1.1,p.z),free=(p:Point,r=.38)=>!collides(p.x,p.z,r,obstacles());
 const nav:Nav={
  sample(center,seed,min,max,isDrive=false){
   const roads=new Set<Road>();for(let x=Math.floor((center.x-max)/64);x<=Math.floor((center.x+max)/64);x++)for(let z=Math.floor((center.z-max)/64);z<=Math.floor((center.z+max)/64);z++)for(const r of cells.get(x+':'+z)||[])roads.add(r);
   const list=[...roads].filter(r=>!isDrive||!r.walk);if(!list.length)return null;
   for(let attempt=0;attempt<40;attempt++){const hash=(Math.imul(seed+attempt+1,2654435761)>>>0),r=list[hash%list.length],t=((hash>>>8)%1000)/1000,dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz)||1;const side=hash%2?1:-1,offset=isDrive||r.walk?0:(Number(r.width||r.w)||6)/2+.75;
    const p={x:r.a[0]+dx*t-ORIGIN.x+dz/len*offset*side,z:r.a[1]+dz*t-ORIGIN.z-dx/len*offset*side},d=Math.hypot(p.x-center.x,p.z-center.z);if(d>=min&&d<=max&&free(p,isDrive?1.35:.4))return p;
   }return null;
  },
  route(from,to,isDrive=false){
   const result=findMapRoute(isDrive?drive:walk,{x:from.x+ORIGIN.x,z:from.z+ORIGIN.z},{x:to.x+ORIGIN.x,z:to.z+ORIGIN.z});if(!result.reachable||result.accessDistance>(isDrive?9:5))return [];
   const points:Point[]=result.points.map((p:Point)=>({x:p.x-ORIGIN.x,z:p.z-ORIGIN.z}));if(!points.length)return [];
   // Retain graph routes; never substitute a straight path when graph search fails.
   if(!isDrive){
    const shifted=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||1;const q={x:p.x+dz/d*3.5,z:p.z-dx/d*3.5};return free(q)?q:p;});points.splice(0,points.length,...shifted);
   }
   if(!lineClear(v(from),v(points[0]),obstacles()))return [];points.unshift({...from});
   if(!isDrive){if(!lineClear(v(points[points.length-1]),v(to),obstacles()))return [];points.push({...to});}
   // Check the WHOLE swept circular proxy; distant centerline visibility isn't enough.
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(d/.6);if(steps>2500)return [];for(let k=0;k<=steps;k++){const t=steps?k/steps:0;if(!free({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},isDrive?1.3:.34))return [];}}
   return points;
  },
  move(from,to,radius){const p={...from};const dx=to.x-from.x,dz=to.z-from.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));for(let i=0;i<steps;i++)moveCircle(p,dx/steps,dz/steps,radius,obstacles());return p;},
  clear:(a,b)=>lineClear(v(a),v(b),obstacles())
 };
 let layer:CityLifeLayer|undefined;const core=new CityLifeCore(nav,e=>{layer?.handle(e);onEvent(e);},quality);layer=new CityLifeLayer(core,scene);
 return {core,layer,
  tick(dt:number,player:Point){const wasDown=core.health<=0;core.update(dt,player);if(wasDown)Object.assign(player,core.player);},
  render:(dt:number,camera:T.Camera)=>layer!.update(dt,camera),
  dispose(){core.dispose();layer!.dispose();}
 };
}
