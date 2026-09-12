import * as T from 'three';
import {CellWorkQueue} from './cellWorkQueue.mjs';
import {appendBuildingShell,shellGeometry} from './buildingShell';
import {sourceBuildingColour,firstWindowHeight} from './buildingAppearance';
import {EnvironmentMaterials} from '../tirana-environment/EnvironmentMaterials';
import {surfaceGeometry} from '../tirana-environment/riverGeometry';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';
import {AGED_HOUSING_IDS} from '../tirana-city-source/housingRegistry.mjs';
type Bucket={x:number;z:number;buildings:any[];root?:T.Group;detail?:T.Group;used:number};

/** Build a bounded number of nearby cells, not tens of thousands of buildings
 * on the first frame. CPU and GPU geometry are both evicted from the cache.
 */
export class MappedBuildingCells {
 readonly group=new T.Group();
 private buckets:Bucket[]=[];
 private frame=0;
 private lookup=new Map<string,Bucket>();private cached=new Set<Bucket>();private selected=new Set<Bucket>();
 private jobs=new CellWorkQueue();private viewer={x:Infinity,z:Infinity};private battery?:boolean;private dead=false;
 private finish:EnvironmentMaterials;
 private roof:T.MeshStandardMaterial;
 constructor(buildings:any[],private wall:T.MeshStandardMaterial,private glass:T.MeshStandardMaterial,private aged:boolean,loadTextures=true){
  this.finish=new EnvironmentMaterials(loadTextures);this.roof=this.finish.create('rough_concrete',0xa5a396);
  const map=new Map<string,Bucket>();
  for(const b of buildings){
   const x=Math.floor(b.p.reduce((s:number,p:number[])=>s+p[0]/b.p.length,0)/240)*240+120;
   const z=Math.floor(b.p.reduce((s:number,p:number[])=>s+p[1]/b.p.length,0)/240)*240+120,key=`${x}:${z}`;
   if(!map.has(key))map.set(key,{x,z,buildings:[],used:0});map.get(key)!.buildings.push(b);
  }
  this.lookup=map;this.buckets=[...map.values()];this.group.name='Tirana:streamed-building-cells';
 }
 build(buildings:any[],detailOnly=false){
  const group=new T.Group(),shells:T.BufferGeometry[]=[],windows:T.BufferGeometry[]=[],roofs:T.BufferGeometry[]=[];
  for(const b of buildings){
   if(!detailOnly){
   const shape=new T.Shape(b.p.map((p:number[])=>new T.Vector2(p[0],-p[1])));
   for(const h of b.holes??[])shape.holes.push(new T.Path(h.map((p:number[])=>new T.Vector2(p[0],-p[1]))));
   const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.1,b.h-(b.minHeight||0)),bevelEnabled:false,steps:1}).rotateX(-Math.PI/2).translate(0,b.minHeight||0,0);
   const pos=geo.getAttribute('position'),normal=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
   const color=sourceBuildingColour(b);
   const colors=new Float32Array(pos.count*3);
   for(let i=0;i<pos.count;i++){
    uv.setXY(i,(Math.abs(normal.getX(i))>.5?pos.getZ(i):pos.getX(i))/4,Math.abs(normal.getY(i))>.5?pos.getZ(i)/4:pos.getY(i)/4);
    const shade=Math.abs(normal.getY(i))>.5?.72:.84+.16*Math.min(1,(pos.getY(i)-(b.minHeight||0))/2.2);
    colors[i*3]=color.r*shade;colors[i*3+1]=color.g*shade;colors[i*3+2]=color.b*shade;
   }
   geo.setAttribute('color',new T.BufferAttribute(colors,3));shells.push(geo);
   }
   // Finish the existing authored shell height without changing source metadata.
   // A missing surveyed height is not an unfinished/under-construction building.
   if(b.tags?.building==='construction'||b.tags?.construction)continue;
   const roof=surfaceGeometry([b.p,...(b.holes??[])],b.h+.018,3).toNonIndexed();roofs.push(roof);
   for(const edge of facadeEdges(b.p)){
     if(edge.length<1)continue;
     const trim=new T.BoxGeometry(edge.length,.32,.18).rotateY(-Math.atan2(edge.uz,edge.ux)).translate((edge.a[0]+edge.b[0])/2,b.h+.16,(edge.a[1]+edge.b[1])/2).toNonIndexed();
     roofs.push(trim);
   }
   if(this.aged&&AGED_HOUSING_IDS.has(String(b.id)))continue;
   for(const edge of facadeEdges(b.p)){
    const columns=Math.min(24,Math.floor(edge.length/4));if(!columns)continue;
    for(let y=firstWindowHeight(b);y<b.h-1;y+=3.2)for(let j=0;j<columns;j++){
     const u=(j+.5)*edge.length/columns;
     windows.push(new T.PlaneGeometry(Math.min(1.45,edge.length/columns-.8),1.65).rotateY(Math.atan2(edge.nx,edge.nz)).translate(edge.a[0]+edge.ux*u+edge.nx*.055,y,edge.a[1]+edge.uz*u+edge.nz*.055));
    }
   }
  }
  for(const [parts,material,detail] of [[shells,this.wall,false],[windows,this.glass,true],[roofs,this.roof,false]] as const){
   if(!parts.length)continue;const geo=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
   if(!geo)throw Error('Mapped building cell merge failed');
   const mesh=new T.Mesh(geo,material);mesh.castShadow=!detail;mesh.receiveShadow=true;mesh.userData.windows=detail;group.add(mesh);
  }
  return group;
 }
 private *coarse(bucket:Bucket):Generator<void,void>{
  const positions:number[]=[],colors:number[]=[];
  for(const building of bucket.buildings){appendBuildingShell(building,positions,colors);yield;}
  const mesh=new T.Mesh(shellGeometry(positions,colors),this.wall);mesh.receiveShadow=true;
  const root=new T.Group();root.name=`Building shells ${bucket.x}:${bucket.z}`;root.add(mesh);bucket.root=root;
  this.group.add(root);this.cached.add(bucket);root.visible=this.selected.has(bucket);
 }
 private *details(bucket:Bucket):Generator<void,void>{
  // Each sub-batch limits work and bounds allocations to a few building walls.
  const root=new T.Group();
  try{
   for(let i=0;i<bucket.buildings.length;i+=3){root.add(this.build(bucket.buildings.slice(i,i+3),true));yield;}
   const batches=new Map<T.Material,T.BufferGeometry[]>();
   root.traverse(o=>{if(o instanceof T.Mesh){const material=o.material as T.Material;if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(o.geometry);}});
   root.clear();
   for(const [material,parts] of batches){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(geometry){const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;root.add(mesh);}}
   bucket.detail=root;bucket.root?.add(root);
  }finally{if(bucket.detail!==root)this.release(root);}
 }
 update(viewer:{x:number;z:number},battery:boolean){
  if(this.dead)return;
  if(this.battery!==battery||Math.hypot(viewer.x-this.viewer.x,viewer.z-this.viewer.z)>45){
   this.viewer={x:viewer.x,z:viewer.z};this.battery=battery;this.frame++;
   const tasks:{key:string;create:()=>Generator<void,void>}[]=[];
   const radius=battery?1400:2400,selected:Bucket[]=[],distance=(b:Bucket)=>(b.x-viewer.x)**2+(b.z-viewer.z)**2;
   for(let x=Math.floor((viewer.x-radius)/240);x<=Math.floor((viewer.x+radius)/240);x++)for(let z=Math.floor((viewer.z-radius)/240);z<=Math.floor((viewer.z+radius)/240);z++){
    const b=this.lookup.get(`${x*240+120}:${z*240+120}`);if(b&&distance(b)<(radius+170)**2)selected.push(b);
   }
   selected.sort((a,b)=>distance(a)-distance(b));this.selected=new Set(selected);
   for(const b of selected){b.used=this.frame;if(!b.root)tasks.push({key:b.x+":"+b.z,create:()=>this.coarse(b)});}
   for(const b of selected)if(!b.detail&&distance(b)<(battery?150:330)**2)tasks.push({key:b.x+":"+b.z+":detail",create:()=>this.details(b)});
   this.jobs.sync(tasks);
   for(const b of this.cached){b.root!.visible=this.selected.has(b);b.root!.children[0].castShadow=!battery&&distance(b)<240**2;if(b.detail)b.detail.visible=distance(b)<(battery?240:420)**2;}
   const stale=[...this.cached].filter(b=>!this.selected.has(b)).sort((a,b)=>a.used-b.used);
   while(this.cached.size>(battery?220:460)&&stale.length){const b=stale.shift()!;this.release(b.root!);b.root=undefined;b.detail=undefined;this.cached.delete(b);}
   // Close detail has a separate cache; distant shells retain no window meshes.
   for(const b of this.cached)if(b.detail&&distance(b)>600**2){this.release(b.detail);b.detail=undefined;}
  }
  this.jobs.run(battery?1.5:3,180);
  if(this.cached.size>(battery?220:460)){
   const stale=[...this.cached].filter(b=>!this.selected.has(b)).sort((a,b)=>a.used-b.used);
   while(this.cached.size>(battery?220:460)&&stale.length){const b=stale.shift()!;this.release(b.root!);b.root=undefined;b.detail=undefined;this.cached.delete(b);}
  }
  this.group.userData={cachedCells:this.cached.size,pendingJobs:this.jobs.length,radius:battery?1400:2400};
 }
 private release(root:T.Group){root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});root.clear();root.removeFromParent();}
 dispose(){if(this.dead)return;this.dead=true;this.jobs.dispose();this.finish.dispose();for(const b of this.buckets)if(b.root)this.release(b.root);this.buckets=[];this.group.removeFromParent();}
}
