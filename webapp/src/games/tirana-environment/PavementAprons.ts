import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {largeBuildingAprons} from './urbanLightingCore.mjs';
import {cutChannels,surfaceGeometry} from './riverGeometry';
type Cell={x:number;z:number;buildings:any[];mesh?:T.Mesh;used:number};
/** Paving is streamed with the city rather than triangulating the full district
 * at startup. The height stays below road asphalt and above decorative grass. */
export class PavementAprons {
 readonly group=new T.Group();
 private cells:Cell[]=[];private tick=0;private last=-Infinity;private dead=false;
 constructor(world:any,private material:T.Material){
  this.group.name='Paved large-building frontages';const bins=new Map<string,Cell>();
  for(const b of world.buildings||[]){
   const x=Math.floor(b.p.reduce((sum:number,p:number[])=>sum+p[0]/b.p.length,0)/160)*160+80;
   const z=Math.floor(b.p.reduce((sum:number,p:number[])=>sum+p[1]/b.p.length,0)/160)*160+80,key=`${x}:${z}`;
   if(!bins.has(key))bins.set(key,{x,z,buildings:[],used:0});bins.get(key)!.buildings.push(b);
  }
  this.cells=[...bins.values()];
 }
 update(viewer:{x:number;z:number},seconds:number,battery=false){
  if(this.dead||seconds>=this.last&&seconds-this.last<.25)return;this.last=seconds;this.tick++;
  const distance=(cell:Cell)=>Math.hypot(cell.x-viewer.x,cell.z-viewer.z);
  const near=this.cells.filter(cell=>distance(cell)<(battery?360:600)).sort((a,b)=>distance(a)-distance(b)).slice(0,battery?12:28),keep=new Set(near);let budget=2;
  for(const cell of near){
   cell.used=this.tick;
   if(!cell.mesh&&budget-->0){
    const parts=largeBuildingAprons({buildings:cell.buildings}).flatMap(ring=>cutChannels(ring).map(p=>surfaceGeometry(p,.074)));
    const geometry=parts.length?mergeGeometries(parts,false):new T.BufferGeometry();parts.forEach(g=>g.dispose());
    if(geometry){cell.mesh=new T.Mesh(geometry,this.material);cell.mesh.name='Pavement apron cell';cell.mesh.receiveShadow=true;this.group.add(cell.mesh);}
   }
  }
  for(const cell of this.cells)if(cell.mesh)cell.mesh.visible=keep.has(cell);
  const cached=this.cells.filter(c=>c.mesh).sort((a,b)=>a.used-b.used);while(cached.length>36)this.release(cached.shift()!);
 }
 private release(cell:Cell){cell.mesh?.geometry.dispose();cell.mesh?.removeFromParent();cell.mesh=undefined;}
 dispose(){if(this.dead)return;this.dead=true;this.cells.forEach(c=>this.release(c));this.group.removeFromParent();this.group.clear();}
}
