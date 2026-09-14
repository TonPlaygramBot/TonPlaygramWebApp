import {CITY_RADIUS, CITY_CACHE, runCityWork} from '../tiranastreets/renderSettings';
import {appendGroundTriangle,drapeGeometry} from '../tirana-east/drapeGeometry';
import {urbanDistance} from '../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {CellWorkQueue} from './cellWorkQueue.mjs';
import {EnvironmentMaterials} from '../tirana-environment/EnvironmentMaterials';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {cutChannels,surfaceGeometry} from '../tirana-environment/riverGeometry';
import {roadRing,splitRoadCells,clipRingToBounds,type Road} from '../tirana-environment/roadSurfaceCore.mjs';
import {cutRoads,prepareRoadSurfaceIndex} from '../tirana-environment/roadSurfaceRegistry';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
type Cell={key:string;x:number;z:number;roads:Road[];bounds:number[];root?:T.Group;paving?:T.Mesh;used?:number};
type District={key:string;roads:Road[];bounds:number[];root?:T.Group;used:number};
const SURFACE_RADIUS=2200, RETAIN_RADIUS=2700, DISTRICT_CACHE=64;
const SURFACE_FLOATS=3072*3, TRIANGLE_CHUNK_FLOATS=64*9;
const distanceToBounds=(viewer:{x:number;z:number},b:number[])=>Math.hypot(Math.max(b[0]-viewer.x,0,viewer.x-b[2]),Math.max(b[1]-viewer.z,0,viewer.z-b[3]));

/** One surface owner for the complete city. Cheap asphalt reaches the horizon;
 * clipped pavements stream nearby within a CPU time budget. */
export class UrbanRoadCells {
 readonly group=new T.Group();
 private materials:EnvironmentMaterials;
 private cells:Map<string,Cell>;
 private visible=new Set<Cell>();private cache=new Set<Cell>();
 private districts:District[]=[];private districtJobs=new CellWorkQueue();
 private districtCache=new Set<District>();private selectedDistricts=new Set<District>();
 private tick=0;private last=-Infinity;private dead=false;
 private viewer={x:Infinity,z:Infinity};private battery?:boolean;
 private jobs=new CellWorkQueue();
 private asphalt=new T.MeshStandardMaterial({color:0x777b78,roughness:.94});
 private pavement=new T.MeshStandardMaterial({color:0xb5afa3,roughness:.92});
 private textures=new Set<T.Texture>();
 constructor(loadTextures=true){
  this.materials=new EnvironmentMaterials(loadTextures);this.materials.apply(this.pavement,'concrete_pavement');this.asphalt.userData.environmentSurface=true;
  this.cells=splitRoadCells(WORLD.roads);this.group.name='Tirana:streamed-road-cells';
  // Index source records only. Tessellating every road in the region here used
  // hundreds of MB before the loading UI could paint on a phone.
  const districts=new Map<string,District>();
  for(const r of WORLD.roads){
   if(r.tunnel||!Number.isFinite(r.w)||r.w<=0)continue;
   const key=`${Math.floor((r.a[0]+r.b[0])/1920)}:${Math.floor((r.a[1]+r.b[1])/1920)}`;
   if(!districts.has(key))districts.set(key,{key,roads:[],used:0,bounds:[Infinity,Infinity,-Infinity,-Infinity]});
   const d=districts.get(key)!;
   const margin=r.w/2+.06;d.roads.push(r);
   d.bounds[0]=Math.min(d.bounds[0],r.a[0]-margin,r.b[0]-margin);d.bounds[1]=Math.min(d.bounds[1],r.a[1]-margin,r.b[1]-margin);
   d.bounds[2]=Math.max(d.bounds[2],r.a[0]+margin,r.b[0]+margin);d.bounds[3]=Math.max(d.bounds[3],r.a[1]+margin,r.b[1]+margin);
  }
  this.districts=[...districts.values()];
  this.group.userData={ready:false,pendingDistricts:0,loadedDistricts:0,radius:SURFACE_RADIUS};
  if(loadTextures)for(const [file,key] of [['diff','map'],['nor_gl','normalMap'],['rough','roughnessMap']] as const){
   new T.TextureLoader().load('/assets/tirana-streets/asphalt-'+file+'.jpg',t=>{
    if(this.dead){t.dispose();return;}t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(key==='map')t.colorSpace=T.SRGBColorSpace;
    this.textures.add(t);this.asphalt[key]=t;this.asphalt.normalScale.set(.25,.25);this.asphalt.needsUpdate=true;
  });
  }
 }
 private surfaceMesh(positions:number[],walk:boolean){
  const g=new T.BufferGeometry(),uv=new Float32Array(positions.length/3*2);
  for(let i=0;i<positions.length/3;i++){uv[i*2]=positions[i*3]/5;uv[i*2+1]=positions[i*3+2]/5;}
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();
  const mesh=new T.Mesh(g,walk?this.pavement:this.asphalt);mesh.receiveShadow=true;return mesh;
 }
 private *appendSurface(root:T.Group,positions:number[],walk:boolean,a:number[],b:number[],c:number[],offset:number):Generator<void,void>{
  const pending=[{a,b,c,depth:0}];
  while(pending.length){
   const triangle=pending.pop()!,{a,b,c,depth}=triangle;
   // Traverse the first three subdivision levels ourselves, in the same
   // depth-first order as appendGroundTriangle. Its remaining depth is at most
   // three, so even one long hillside road releases the main thread regularly.
   if(depth<3&&[a,b,c].some(p=>urbanDistance(p[0],p[1])>0)&&Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]))>12){
    const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];
    pending.push({a:ab,b:bc,c:ca,depth:depth+1},{a:ca,b:bc,c,depth:depth+1},{a:ab,b,c:bc,depth:depth+1},{a,b:ab,c:ca,depth:depth+1});
    continue;
   }
   if(positions.length>SURFACE_FLOATS-TRIANGLE_CHUNK_FLOATS){root.add(this.surfaceMesh(positions,walk));positions.length=0;yield;}
   appendGroundTriangle(positions,a,b,c,offset,depth);
   if(depth>0)yield;
  }
 }
 private *buildDistrict(d:District):Generator<void,void>{
  const root=new T.Group();root.name=`Complete road surfaces ${d.key}`;
  try{
   for(let start=0;start<d.roads.length;start+=256){
    const drive:number[]=[],walk:number[]=[];
    for(let index=start;index<Math.min(start+256,d.roads.length);index++){
     const r=d.roads[index],ring=roadRing(r);
     if(ring){const positions=r.walk?walk:drive,y=r.bridge?.16:r.walk?.071:.09;
      for(let i=1;i<ring.length-1;i++){
       const [a,b,c]=[ring[0],ring[i],ring[i+1]],face=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?[a,c,b]:[a,b,c];
       yield* this.appendSurface(root,positions,!!r.walk,face[0],face[1],face[2],y);
      }
     }
     if((index-start)%8===7)yield;
    }
    if(drive.length){root.add(this.surfaceMesh(drive,false));yield;}if(walk.length){root.add(this.surfaceMesh(walk,true));yield;}
   }
   d.root=root;root.visible=this.selectedDistricts.has(d);this.group.add(root);this.districtCache.add(d);this.trimDistrictCache();
  }finally{if(d.root!==root)this.releaseDistrictRoot(root);}
 }
 private selectDistricts(viewer:{x:number;z:number}){
  const selected=this.districts.filter(d=>distanceToBounds(viewer,d.bounds)<=SURFACE_RADIUS)
   .sort((a,b)=>distanceToBounds(viewer,a.bounds)-distanceToBounds(viewer,b.bounds));
  this.selectedDistricts=new Set(selected);for(const d of selected)d.used=this.tick;
  this.districtJobs.sync(selected.filter(d=>!d.root).map(d=>({key:d.key,create:()=>this.buildDistrict(d)})));
  for(const d of this.districtCache){d.root!.visible=this.selectedDistricts.has(d);if(!d.root!.visible&&distanceToBounds(viewer,d.bounds)>RETAIN_RADIUS)this.releaseDistrict(d);}
  this.trimDistrictCache();
 }
 private trimDistrictCache(){
  const stale=[...this.districtCache].filter(d=>!this.selectedDistricts.has(d)).sort((a,b)=>a.used-b.used);
  while(this.districtCache.size>DISTRICT_CACHE&&stale.length)this.releaseDistrict(stale.shift()!);
 }
 private releaseDistrictRoot(root:T.Group){root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});root.clear();root.removeFromParent();}
 private releaseDistrict(d:District){if(d.root)this.releaseDistrictRoot(d.root);d.root=undefined;this.districtCache.delete(d);}
 private *buildRoad(cell:Cell):Generator<void,void>{
  const root=new T.Group();root.name=`Pavement detail ${cell.key}`;
  cell.root=root;this.group.add(root);this.cache.add(cell);root.visible=this.visible.has(cell);
 }
 private clip(ring:number[][],cell:Cell){
  const clipped=clipRingToBounds(ring,cell.bounds);return clipped.length>=3?[[clipped]]:[];
 }
 private *buildPaving(cell:Cell):Generator<void,void>{
  const parts:T.BufferGeometry[]=[];
  try{
   prepareRoadSurfaceIndex();
   for(const r of cell.roads){
    // InfrastructureLayer owns elevated bridge sidewalks and pedestrian decks.
    if(!r.bridge){const ring=roadRing(r,r.w+(r.walk?0:3.8));if(ring)
     for(const polygon of this.clip(ring,cell))for(const dry of cutChannels(polygon[0],polygon.slice(1)))
      for(const cleared of cutRoads(dry))parts.push(drapeGeometry(surfaceGeometry(cleared,.075)));
    }
    yield;
   }
   if(cell.root){
    const geo=parts.length?mergeGeometries(parts,false):new T.BufferGeometry();
    if(geo){cell.paving=new T.Mesh(geo,this.pavement);cell.paving.name='Pavement outside carriageways';cell.paving.receiveShadow=true;cell.root.add(cell.paving);}
   }
  }finally{parts.forEach(g=>g.dispose());}
 }
 update(seconds:number,viewer:{x:number;z:number},battery=false){
  if(this.dead)return;
  if(this.battery!==battery||seconds<this.last||Math.hypot(viewer.x-this.viewer.x,viewer.z-this.viewer.z)>45||this.last===-Infinity){
   this.last=seconds;this.viewer={x:viewer.x,z:viewer.z};this.battery=battery;this.tick++;
   this.selectDistricts(viewer);
   const tasks:{key:string;create:()=>Generator<void,void>}[]=[];
   const radius=battery?CITY_RADIUS.battery:CITY_RADIUS.high,selected:Cell[]=[];
   for(let x=Math.floor((viewer.x-radius)/240);x<=Math.floor((viewer.x+radius)/240);x++)for(let z=Math.floor((viewer.z-radius)/240);z<=Math.floor((viewer.z+radius)/240);z++){
    const c=this.cells.get(`${x}:${z}`);if(c&&Math.hypot(c.x-viewer.x,c.z-viewer.z)<radius+170)selected.push(c);
   }
   const distance=(c:Cell)=>(c.x-viewer.x)**2+(c.z-viewer.z)**2;
   selected.sort((a,b)=>distance(a)-distance(b));this.visible=new Set(selected);
   // All roads first; costly close detail never delays the wider road network.
   for(const c of selected){c.used=this.tick;if(!c.root&&distance(c)<(battery?300:520)**2)this.buildRoad(c).next();}
   for(const c of selected)if(c.root&&!c.paving&&distance(c)<(battery?300:520)**2)tasks.push({key:c.key+":paving",create:()=>this.buildPaving(c)});
   this.jobs.sync(tasks);
   for(const c of this.cache){c.root!.visible=this.visible.has(c);if(c.paving)c.paving.visible=distance(c)<(battery?380:650)**2;}
   const stale=[...this.cache].filter(c=>!this.visible.has(c)).sort((a,b)=>(a.used||0)-(b.used||0));
   while(this.cache.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)&&stale.length)this.release(stale.shift()!);
  }
  runCityWork(this.districtJobs.length?this.districtJobs:this.jobs, battery);
  if(this.cache.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)){
   const stale=[...this.cache].filter(c=>!this.visible.has(c)).sort((a,b)=>(a.used||0)-(b.used||0));
   while(this.cache.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)&&stale.length)this.release(stale.shift()!);
  }
  const loadedDistricts=[...this.selectedDistricts].filter(d=>d.root).length;
  this.group.userData={cachedCells:this.cache.size,pendingJobs:this.jobs.length,
   cachedDistricts:this.districtCache.size,loadedDistricts,pendingDistricts:this.selectedDistricts.size-loadedDistricts,
   ready:loadedDistricts===this.selectedDistricts.size,radius:SURFACE_RADIUS};
 }
 private release(c:Cell){c.root?.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});c.root?.removeFromParent();c.root=undefined;c.paving=undefined;this.cache.delete(c);}
 dispose(){if(this.dead)return;this.dead=true;this.districtJobs.dispose();this.jobs.dispose();this.materials.dispose();for(const d of this.districtCache)this.releaseDistrict(d);this.districts=[];this.selectedDistricts.clear();for(const c of this.cache)this.release(c);this.textures.forEach(t=>t.dispose());this.asphalt.dispose();this.pavement.dispose();this.group.clear();this.group.removeFromParent();}
}
