import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {CellWorkQueue} from '../tirana-neighbourhood/cellWorkQueue.mjs';
import {housingProfile} from './housingCore.mjs';
import {buildingGround} from './terrainCore.mjs';
import {modelGeometry,ROOFS} from './blenderModels';
export function housingGeometry(b:any){
 const profile=housingProfile(b);if(!profile)return new T.BufferGeometry();
 const parts:T.BufferGeometry[]=[],base=buildingGround(b);
 const place=(id:string,x:number,y:number,z:number,yaw=0,scale=1)=>{const g=modelGeometry(id);g.scale(scale,1,1).rotateY(yaw).translate(x,y+base,z);parts.push(g);};
 const roof=ROOFS[b.id];if(roof)place('roof-'+b.id,roof.x,0,roof.z);
 const edges=facadeEdges(b.p),front=edges.filter(e=>e.length>4).sort((a,b)=>b.length-a.length)[0];
 for(const edge of edges){
  const cols=Math.floor(edge.length/profile.spacing);if(!cols)continue;
  const levels=Math.max(1,Math.round(b.levels||b.h/3.2)),floor=b.h/levels;
  for(let j=0;j<levels;j++)for(let i=0;i<cols;i++){
   const u=(i+.5)*edge.length/cols,y=j*floor+profile.windowHeight;
   if(y+1.3>b.h)continue;
   if(j===0&&i===Math.floor(cols/2)&&edge===front)continue;
   const bay=profile.colourful?['campus-yellow-bay','campus-red-bay','campus-green-bay'][(i+j)%3]:profile.bay;
   place(bay,edge.a[0]+edge.ux*u+edge.nx*.04,y,edge.a[1]+edge.uz*u+edge.nz*.04,Math.atan2(edge.nx,edge.nz));
  }
 }
 if(front){const u=front.length*.5;place(profile.kind==='campus'?'campus-entry':'house-door',front.a[0]+front.ux*u,0,front.a[1]+front.uz*u,Math.atan2(front.nx,front.nz));}
 const merged=parts.length?mergeGeometries(parts,false):new T.BufferGeometry();parts.forEach(g=>g.dispose());return merged||new T.BufferGeometry();
}
/** One batch per nearby 240 m cell; distant massing uses the building shells. */
export class HousingDetails {
 readonly group=new T.Group();private material=new T.MeshStandardMaterial({vertexColors:true,roughness:.78});
 private cells=new Map<string,{x:number;z:number;buildings:any[];mesh?:T.Mesh}>();private jobs=new CellWorkQueue();private viewer={x:Infinity,z:Infinity};private battery?:boolean;private dead=false;
 constructor(buildings:any[]=WORLD.buildings){
  this.group.name='Tirana:Blender-private-houses-and-Studenti';
  for(const b of buildings){if(!housingProfile(b))continue;const x=b.p.reduce((s:number,p:number[])=>s+p[0]/b.p.length,0),z=b.p.reduce((s:number,p:number[])=>s+p[1]/b.p.length,0),key=`${Math.floor(x/240)}:${Math.floor(z/240)}`;if(!this.cells.has(key))this.cells.set(key,{x,z,buildings:[]});this.cells.get(key)!.buildings.push(b);}
 }
 private *build(cell:{buildings:any[];mesh?:T.Mesh}){const parts:T.BufferGeometry[]=[];try{for(const b of cell.buildings){parts.push(housingGeometry(b));yield;}const geo=parts.length?mergeGeometries(parts.filter(g=>g.hasAttribute('position')),false):null;if(geo){cell.mesh=new T.Mesh(geo,this.material);cell.mesh.castShadow=true;cell.mesh.receiveShadow=true;this.group.add(cell.mesh);}}finally{parts.forEach(g=>g.dispose());}}
 update(viewer?:{x:number;z:number},battery=false){if(!viewer||this.dead)return;
  if(Math.hypot(viewer.x-this.viewer.x,viewer.z-this.viewer.z)>30||this.battery!==battery){this.viewer={...viewer};this.battery=battery;const selected=[...this.cells.values()].filter(c=>Math.hypot(c.x-viewer.x,c.z-viewer.z)<(battery?280:550)).sort((a,b)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z));const visible=new Set(selected);this.jobs.sync(selected.filter(c=>!c.mesh).map(c=>({key:`${c.x}:${c.z}`,create:()=>this.build(c)})));for(const c of this.cells.values())if(c.mesh){if(Math.hypot(c.x-viewer.x,c.z-viewer.z)>1000){c.mesh.geometry.dispose();c.mesh.removeFromParent();c.mesh=undefined;}else c.mesh.visible=visible.has(c);}}
  this.jobs.run(battery?1:2,60);
 }
 retire(){this.dead=true;this.jobs.dispose();}
 dispose(){this.retire();for(const c of this.cells.values())c.mesh?.geometry.dispose();this.material.dispose();this.group.clear();this.group.removeFromParent();}
}
