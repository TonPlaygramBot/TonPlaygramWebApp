import * as T from 'three';
import {EnvironmentMaterials} from '../tirana-environment/EnvironmentMaterials';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {cutChannels,surfaceGeometry} from '../tirana-environment/riverGeometry';
import {roadRing,splitRoadCells,clipRingToBounds,type Road} from '../tirana-environment/roadSurfaceCore.mjs';
import {cutRoads,prepareRoadSurfaceIndex} from '../tirana-environment/roadSurfaceRegistry';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
type Cell={key:string;x:number;z:number;roads:Road[];bounds:number[];root?:T.Group;paving?:T.Mesh;used?:number};

/** One surface owner for the complete city. Cheap asphalt reaches the horizon;
 * clipped pavements stream nearby within a CPU time budget. */
export class UrbanRoadCells {
 readonly group=new T.Group();
 private materials:EnvironmentMaterials;
 private cells:Map<string,Cell>;
 private visible=new Set<Cell>();private cache=new Set<Cell>();
 private tick=0;private last=-Infinity;private dead=false;
 private viewer={x:Infinity,z:Infinity};private battery?:boolean;
 private jobs:Generator<void,void>[]=[];
 private asphalt=new T.MeshStandardMaterial({color:0x777b78,roughness:.94});
 private pavement=new T.MeshStandardMaterial({color:0xb5afa3,roughness:.92});
 private textures=new Set<T.Texture>();
 constructor(loadTextures=true){
  this.materials=new EnvironmentMaterials(loadTextures);this.materials.apply(this.pavement,'concrete_pavement');this.asphalt.userData.environmentSurface=true;
  prepareRoadSurfaceIndex();
  this.cells=splitRoadCells(WORLD.roads);this.group.name='Tirana:streamed-road-cells';
  if(loadTextures)for(const [file,key] of [['diff','map'],['nor_gl','normalMap'],['rough','roughnessMap']] as const){
   new T.TextureLoader().load('/assets/tirana-streets/asphalt-'+file+'.jpg',t=>{
    if(this.dead){t.dispose();return;}t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(key==='map')t.colorSpace=T.SRGBColorSpace;
    this.textures.add(t);this.asphalt[key]=t;this.asphalt.normalScale.set(.25,.25);this.asphalt.needsUpdate=true;
   });
  }
 }
 private *buildRoad(cell:Cell):Generator<void,void>{
  const positions:number[]=[];
  for(const r of cell.roads){
   if(!r.walk){const ring=roadRing(r);if(ring){const clipped=clipRingToBounds(ring,cell.bounds),y=r.bridge?.16:.09;
    for(let i=1;i<clipped.length-1;i++){const a=clipped[0],b=clipped[i],c=clipped[i+1];
     const face=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?[a,c,b]:[a,b,c];for(const p of face)positions.push(p[0],y,p[1]);
    }
   }}
   yield;
  }
  const root=new T.Group();root.name=`Road cell ${cell.key}`;
  if(positions.length){const geo=new T.BufferGeometry(),normals=new Float32Array(positions.length),uv=new Float32Array(positions.length/3*2);
   for(let i=0;i<positions.length/3;i++){normals[i*3+1]=1;uv[i*2]=positions[i*3]/5;uv[i*2+1]=positions[i*3+2]/5;}
   geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.BufferAttribute(normals,3));geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.computeBoundingSphere();
   const mesh=new T.Mesh(geo,this.asphalt);mesh.receiveShadow=true;root.add(mesh);
  }
  cell.root=root;this.group.add(root);this.cache.add(cell);root.visible=this.visible.has(cell);
 }
 private clip(ring:number[][],cell:Cell){
  const clipped=clipRingToBounds(ring,cell.bounds);return clipped.length>=3?[[clipped]]:[];
 }
 private *buildPaving(cell:Cell):Generator<void,void>{
  const parts:T.BufferGeometry[]=[];
  try{
   for(const r of cell.roads){
    // InfrastructureLayer owns elevated bridge sidewalks and pedestrian decks.
    if(!r.bridge){const ring=roadRing(r,r.w+(r.walk?0:3.8));if(ring)
     for(const polygon of this.clip(ring,cell))for(const dry of cutChannels(polygon[0],polygon.slice(1)))
      for(const cleared of cutRoads(dry))parts.push(surfaceGeometry(cleared,.075));
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
   for(const job of this.jobs)job.return();this.jobs=[];
   const radius=battery?1100:1800,selected:Cell[]=[];
   for(let x=Math.floor((viewer.x-radius)/240);x<=Math.floor((viewer.x+radius)/240);x++)for(let z=Math.floor((viewer.z-radius)/240);z<=Math.floor((viewer.z+radius)/240);z++){
    const c=this.cells.get(`${x}:${z}`);if(c&&Math.hypot(c.x-viewer.x,c.z-viewer.z)<radius+170)selected.push(c);
   }
   const distance=(c:Cell)=>(c.x-viewer.x)**2+(c.z-viewer.z)**2;
   selected.sort((a,b)=>distance(a)-distance(b));this.visible=new Set(selected);
   // All roads first; costly close detail never delays the wider road network.
   for(const c of selected){c.used=this.tick;if(!c.root)this.jobs.push(this.buildRoad(c));}
   for(const c of selected)if(!c.paving&&distance(c)<(battery?300:520)**2)this.jobs.push(this.buildPaving(c));
   for(const c of this.cache){c.root!.visible=this.visible.has(c);if(c.paving)c.paving.visible=distance(c)<(battery?380:650)**2;}
   const stale=[...this.cache].filter(c=>!this.visible.has(c)).sort((a,b)=>(a.used||0)-(b.used||0));
   while(this.cache.size>(battery?140:270)&&stale.length)this.release(stale.shift()!);
  }
  const start=performance.now(),budget=battery?2:4;let steps=0;
  while(this.jobs.length&&performance.now()-start<budget&&steps++<100){if(this.jobs[0].next().done)this.jobs.shift();}
  if(this.cache.size>(battery?140:270)){
   const stale=[...this.cache].filter(c=>!this.visible.has(c)).sort((a,b)=>(a.used||0)-(b.used||0));
   while(this.cache.size>(battery?140:270)&&stale.length)this.release(stale.shift()!);
  }
  this.group.userData={cachedCells:this.cache.size,pendingJobs:this.jobs.length,radius:battery?1100:1800};
 }
 private release(c:Cell){c.root?.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});c.root?.removeFromParent();c.root=undefined;c.paving=undefined;this.cache.delete(c);}
 dispose(){if(this.dead)return;this.dead=true;for(const job of this.jobs)job.return();this.jobs=[];this.materials.dispose();for(const c of this.cache)this.release(c);this.textures.forEach(t=>t.dispose());this.asphalt.dispose();this.pavement.dispose();this.group.clear();this.group.removeFromParent();}
}
