import * as T from 'three';
import {NEIGHBOURHOOD} from '../tirana-neighbourhood/data.mjs';
import {HERO_IDS} from '../tirana-neighbourhood/assets.mjs';
import {AGED_HOUSING_IDS} from '../tirana-city-source/housingRegistry.mjs';
import {COMPLETED_BUILDING_IDS} from './buildingRegistry.mjs';
import {facadeModules} from './facadeCore.mjs';
import {bakedParts,bakedMaterial} from './bakedGeometry';
import {bounds,spatialIndex} from './placementCore.mjs';
import {NEIGHBOURHOOD_REFERENCE_PROFILES} from '../tirana-city-source/neighbourhoodProfiles.mjs';
/** Blender-made surrounds, sills, recessed glazing, balcony rails and AC units
 * on known-height source shells. Nearby buildings share every GPU resource. */
export class FacadeCompletionLayer {
 readonly group=new T.Group();
 private near:ReturnType<typeof spatialIndex>;
 private cache=new Map<string,ReturnType<typeof facadeModules>>();
 private batches=new Map<string,T.InstancedMesh[]>();private materials=new Map<string,T.Material>();
 private dummy=new T.Object3D();private last=-Infinity;private dead=false;
 constructor(buildings:any[]=NEIGHBOURHOOD.buildings){
  const eligible=buildings.filter(b=>!HERO_IDS.has(b.id)&&!COMPLETED_BUILDING_IDS.has(b.id)&&!AGED_HOUSING_IDS.has(b.id)&&!NEIGHBOURHOOD_REFERENCE_PROFILES[b.id]);
  this.near=spatialIndex(eligible,(b:any)=>bounds(b.p));this.group.name='Tirana:Blender-near-facade-completion';
  for(const name of ['window_bay','balcony_bay','air_conditioner','entrance_bay']){
   const capacity=name==='window_bay'?900:180;
   this.batches.set(name,bakedParts(name).map(p=>{
    if(!this.materials.has(p.material))this.materials.set(p.material,bakedMaterial(p.material));
    const mesh=new T.InstancedMesh(p.geometry,this.materials.get(p.material)!,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);return mesh;
   }));
  }
  this.group.userData={eligibleBuildings:eligible.length,accuracy:'Source footprints and existing shell heights, including explicit visual height estimates; authored Blender facade modules'};
 }
 update(seconds:number,viewer?:{x:number;z:number},battery=false){
  if(this.dead||!viewer||seconds>=this.last&&seconds-this.last<.3)return;this.last=seconds;
  const distance=(b:any)=>Math.min(...b.p.map((p:number[])=>Math.hypot(p[0]-viewer.x,p[1]-viewer.z)));
  const buildings=this.near(viewer.x,viewer.z,battery?75:130).filter((b:any)=>distance(b)<(battery?80:140)).sort((a:any,b:any)=>distance(a)-distance(b)).slice(0,battery?12:32);
  const modules=[];
  for(const b of buildings){if(!this.cache.has(b.id))this.cache.set(b.id,facadeModules(b,{allowEstimatedHeight:true}));modules.push(...this.cache.get(b.id)!);}
  // Nearest bays win regardless of footprint traversal and tall-building order.
  modules.sort((a,b)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z));
  this.batches.forEach(meshes=>meshes.forEach(m=>m.count=0));
  for(const p of modules){const batch=this.batches.get(p.model)!;if(!batch.length)continue;
   const capacity=Math.min(batch[0].instanceMatrix.count,battery?(p.model==='window_bay'?320:50):Infinity);if(batch[0].count>=capacity)continue;
   this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(0,p.yaw,0);this.dummy.updateMatrix();for(const mesh of batch)mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
  }
  this.batches.forEach(meshes=>meshes.forEach(m=>{m.visible=m.count>0;m.instanceMatrix.needsUpdate=true;}));
  const keep=new Set(buildings.map((b:any)=>b.id));for(const id of this.cache.keys())if(this.cache.size>64&&!keep.has(id))this.cache.delete(id);
  this.group.userData.visibleBuildings=buildings.length;
 }
 retire(){this.dead=true;}
 dispose(){if(this.dead&&this.batches.size===0)return;this.dead=true;this.group.removeFromParent();this.batches.forEach(ms=>ms.forEach(m=>m.geometry.dispose()));this.materials.forEach(m=>m.dispose());this.batches.clear();this.cache.clear();this.group.clear();}
}
