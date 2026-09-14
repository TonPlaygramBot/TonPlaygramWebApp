import {CITY_RADIUS, CITY_CACHE, runCityWork} from '../tiranastreets/renderSettings';
import {housingProfile} from '../tirana-east/housingCore.mjs';
import {buildingGround} from '../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {CellWorkQueue} from './cellWorkQueue.mjs';
import {appendBuildingShell,shellGeometry} from './buildingShell';
import {sourceBuildingColour,windowRows} from './buildingAppearance';
import {EnvironmentMaterials} from '../tirana-environment/EnvironmentMaterials';
import {surfaceGeometry} from '../tirana-environment/riverGeometry';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';
import {AGED_HOUSING_IDS} from '../tirana-city-source/housingRegistry.mjs';
type Bucket={x:number;z:number;buildings:any[];root?:T.Group;detail?:T.Group;used:number};
type District={key:string;buildings:any[];bounds:number[];root?:T.Group;used:number};
const SHELL_RADIUS=2200, RETAIN_RADIUS=2700, DISTRICT_CACHE=64;
const distanceToBounds=(viewer:{x:number;z:number},b:number[])=>Math.hypot(Math.max(b[0]-viewer.x,0,viewer.x-b[2]),Math.max(b[1]-viewer.z,0,viewer.z-b[3]));

/** Complete nearby districts stream before their ornament. Indexing the map
 * must not allocate/triangulate the whole region before the first frame. */
export class MappedBuildingCells {
 readonly group=new T.Group();
 private buckets:Bucket[]=[];
 private frame=0;
 private districts:District[]=[];private districtJobs=new CellWorkQueue();
 private districtCache=new Set<District>();private selectedDistricts=new Set<District>();
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
  const districts=new Map<string,District>();
  for(const b of buildings){
   const x=b.p.reduce((sum:number,p:number[])=>sum+p[0]/b.p.length,0),z=b.p.reduce((sum:number,p:number[])=>sum+p[1]/b.p.length,0);
   const key=`${Math.floor(x/960)}:${Math.floor(z/960)}`;
   if(!districts.has(key))districts.set(key,{key,buildings:[],used:0,bounds:[Infinity,Infinity,-Infinity,-Infinity]});
   const d=districts.get(key)!;
   for(const p of b.p){d.bounds[0]=Math.min(d.bounds[0],p[0]);d.bounds[1]=Math.min(d.bounds[1],p[1]);d.bounds[2]=Math.max(d.bounds[2],p[0]);d.bounds[3]=Math.max(d.bounds[3],p[1]);}
   d.buildings.push(b);
  }
  this.districts=[...districts.values()];
  this.lookup=map;this.buckets=[...map.values()];this.group.name='Tirana:streamed-building-cells';
  this.group.userData={ready:false,pendingDistricts:0,loadedDistricts:0,radius:SHELL_RADIUS};
 }
 private *buildDistrict(d:District):Generator<void,void>{
  const root=new T.Group();root.name=`Complete block silhouettes ${d.key}`;
  try{
   // Bound both source work and the final geometry allocation. Publish the
   // district atomically so a courtyard or straddling block is never cut off.
   for(let start=0;start<d.buildings.length;start+=128){
    const positions:number[]=[],colors:number[]=[];
    for(let i=start;i<Math.min(start+128,d.buildings.length);i++){
     appendBuildingShell(d.buildings[i],positions,colors);if((i-start)%8===7)yield;
    }
    const mesh=new T.Mesh(shellGeometry(positions,colors),this.wall);mesh.receiveShadow=true;root.add(mesh);yield;
   }
   d.root=root;root.visible=this.selectedDistricts.has(d);this.group.add(root);this.districtCache.add(d);this.trimDistrictCache();
  }finally{if(d.root!==root)this.release(root);}
 }
 private selectDistricts(viewer:{x:number;z:number}){
  const selected=this.districts.filter(d=>distanceToBounds(viewer,d.bounds)<=SHELL_RADIUS)
   .sort((a,b)=>distanceToBounds(viewer,a.bounds)-distanceToBounds(viewer,b.bounds));
  this.selectedDistricts=new Set(selected);
  for(const d of selected)d.used=this.frame;
  this.districtJobs.sync(selected.filter(d=>!d.root).map(d=>({key:d.key,create:()=>this.buildDistrict(d)})));
  for(const d of this.districtCache){
   d.root!.visible=this.selectedDistricts.has(d);
   if(!d.root!.visible&&distanceToBounds(viewer,d.bounds)>RETAIN_RADIUS)this.releaseDistrict(d);
  }
  this.trimDistrictCache();
 }
 private trimDistrictCache(){
  const stale=[...this.districtCache].filter(d=>!this.selectedDistricts.has(d)).sort((a,b)=>a.used-b.used);
  while(this.districtCache.size>DISTRICT_CACHE&&stale.length)this.releaseDistrict(stale.shift()!);
 }
 private releaseDistrict(d:District){if(d.root)this.release(d.root);d.root=undefined;this.districtCache.delete(d);}
 build(buildings:any[],detailOnly=false){
  const group=new T.Group(),shells:T.BufferGeometry[]=[],windows:T.BufferGeometry[]=[],roofs:T.BufferGeometry[]=[];
  const windowPositions:number[]=[],windowNormals:number[]=[],windowUvs:number[]=[];
  for(const original of buildings){
   const base=buildingGround(original),b={...original,h:original.h+base,minHeight:(original.minHeight||0)+base};
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
   if(housingProfile(b)||this.aged&&AGED_HOUSING_IDS.has(String(b.id)))continue;
   for(const edge of facadeEdges(b.p)){
    const columns=Math.min(24,Math.floor(edge.length/4));if(!columns)continue;
    for(const row of windowRows(original))for(let j=0;j<columns;j++){
     const u=(j+.5)*edge.length/columns;
     const x=edge.a[0]+edge.ux*u+edge.nx*.055,z=edge.a[1]+edge.uz*u+edge.nz*.055,y=base+row.y,halfW=Math.min(1.45,edge.length/columns-.8)/2,halfH=row.height/2;
     // One buffer for the cell, instead of a geometry and merge per window.
     for(const [sx,sy,tu,tv] of [[-1,1,0,1],[-1,-1,0,0],[1,1,1,1],[-1,-1,0,0],[1,-1,1,0],[1,1,1,1]]){
       windowPositions.push(x+edge.nz*sx*halfW,y+sy*halfH,z-edge.nx*sx*halfW);
       windowNormals.push(edge.nx,0,edge.nz);windowUvs.push(tu,tv);
     }
    }
   }
  }
  if(windowPositions.length)windows.push(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(windowPositions,3)).setAttribute('normal',new T.Float32BufferAttribute(windowNormals,3)).setAttribute('uv',new T.Float32BufferAttribute(windowUvs,2)));
  for(const [parts,material,detail] of [[shells,this.wall,false],[windows,this.glass,true],[roofs,this.roof,false]] as const){
   if(!parts.length)continue;const geo=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
   if(!geo)throw Error('Mapped building cell merge failed');
   const mesh=new T.Mesh(geo,material);mesh.castShadow=!detail;mesh.receiveShadow=true;mesh.userData.windows=detail;group.add(mesh);
  }
  return group;
 }
 private *coarse(bucket:Bucket):Generator<void,void>{
  const root=new T.Group();root.name=`Building details ${bucket.x}:${bucket.z}`;bucket.root=root;
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
   this.selectDistricts(viewer);
   const tasks:{key:string;create:()=>Generator<void,void>}[]=[];
   const radius=battery?CITY_RADIUS.battery:CITY_RADIUS.high,selected:Bucket[]=[],distance=(b:Bucket)=>(b.x-viewer.x)**2+(b.z-viewer.z)**2;
   for(let x=Math.floor((viewer.x-radius)/240);x<=Math.floor((viewer.x+radius)/240);x++)for(let z=Math.floor((viewer.z-radius)/240);z<=Math.floor((viewer.z+radius)/240);z++){
    const b=this.lookup.get(`${x*240+120}:${z*240+120}`);if(b&&distance(b)<(radius+170)**2)selected.push(b);
   }
   selected.sort((a,b)=>distance(a)-distance(b));this.selected=new Set(selected);
   for(const b of selected){b.used=this.frame;if(!b.root&&distance(b)<(battery?240:420)**2)this.coarse(b).next();}
   for(const b of selected)if(b.root&&!b.detail&&distance(b)<(battery?150:330)**2)tasks.push({key:b.x+":"+b.z+":detail",create:()=>this.details(b)});
   this.jobs.sync(tasks);
   for(const b of this.cached){b.root!.visible=this.selected.has(b);if(b.detail)b.detail.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=!battery&&distance(b)<240**2;});if(b.detail)b.detail.visible=distance(b)<(battery?240:420)**2;}
   const stale=[...this.cached].filter(b=>!this.selected.has(b)).sort((a,b)=>a.used-b.used);
   while(this.cached.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)&&stale.length){const b=stale.shift()!;this.release(b.root!);b.root=undefined;b.detail=undefined;this.cached.delete(b);}
   // Close detail has a separate cache; distant shells retain no window meshes.
   for(const b of this.cached)if(b.detail&&distance(b)>600**2){this.release(b.detail);b.detail=undefined;}
  }
  // Coarse coverage cannot wait behind window/roof ornament jobs.
  runCityWork(this.districtJobs.length?this.districtJobs:this.jobs, battery);
  if(this.cached.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)){
   const stale=[...this.cached].filter(b=>!this.selected.has(b)).sort((a,b)=>a.used-b.used);
   while(this.cached.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)&&stale.length){const b=stale.shift()!;this.release(b.root!);b.root=undefined;b.detail=undefined;this.cached.delete(b);}
  }
  const loadedDistricts=[...this.selectedDistricts].filter(d=>d.root).length;
  this.group.userData={cachedCells:this.cached.size,pendingJobs:this.jobs.length,
   cachedDistricts:this.districtCache.size,loadedDistricts,pendingDistricts:this.selectedDistricts.size-loadedDistricts,
   ready:loadedDistricts===this.selectedDistricts.size,radius:SHELL_RADIUS};
 }
 private release(root:T.Group){root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});root.clear();root.removeFromParent();}
 dispose(){if(this.dead)return;this.dead=true;this.districtJobs.dispose();this.jobs.dispose();this.finish.dispose();for(const d of this.districtCache)this.releaseDistrict(d);this.districts=[];this.selectedDistricts.clear();for(const b of this.buckets)if(b.root)this.release(b.root);this.buckets=[];this.group.removeFromParent();}
}
