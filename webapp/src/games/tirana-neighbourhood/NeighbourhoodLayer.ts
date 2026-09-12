import * as T from 'three';
import {ParkFurniture} from './ParkFurniture';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {NEIGHBOURHOOD} from './data.mjs';
import {HEROES,KIT_IDS} from './assets.mjs';
import {COMPLETED_BUILDINGS,COMPLETED_BUILDING_IDS} from '../tirana-city-completion/buildingRegistry.mjs';
import {MappedNeighbourhood} from './MappedNeighbourhood';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';

const ALL_HEROES=[...HEROES,...COMPLETED_BUILDINGS.map(b=>({id:b.id,asset:'completion-'+b.id,name:b.name||'Tirana mapped building'}))];
const BASE='/assets/tirana-streets/neighbourhood/';
type Site=typeof NEIGHBOURHOOD.storefronts[number];
/** Blender-authored models shared by street/FPS adapters. Source-frame placement
 * happens here; attachEnhancements owns the one adapter-origin translation. */
export class NeighbourhoodLayer {
 readonly group=new T.Group();
 readonly mapped:MappedNeighbourhood;
 private parkFurniture=new ParkFurniture();
 private labels:StreetLifeLayer;
 private loader=new GLTFLoader();
 private near:(p:{x:number;z:number},r:number,n:number)=>Site[];
 private kits=new Map<string,T.InstancedMesh[]>();
 private heroes=new Map<string,{object:T.Object3D;x:number;z:number}>();
 private pending=new Set<string>();
 private geometries=new Set<T.BufferGeometry>();private materials=new Set<T.Material>();private textures=new Map<string,T.Texture>();
 private last=-Infinity;private dead=false;private disposed=false;private dummy=new T.Object3D();
 constructor(options:StreetDetailOptions={}){
  this.mapped=new MappedNeighbourhood(options.profile!=='racing');
  this.group.name='Tirana:Blender-neighbourhood';this.group.userData.assetErrors=[];
  const blocked=options.track?ribbonExclusion(options.track):null;
  const sites=NEIGHBOURHOOD.storefronts.filter(s=>!blocked||!blocked(s.x,s.z,Math.max(4,s.width)));
  this.near=nearbyIndex(sites);
  this.labels=new StreetLifeLayer({storefronts:sites,stops:[],fuel:[],advertising:[]},options,true);
  this.group.add(this.mapped.group,this.labels.group,this.parkFurniture.group);
 }
 private own(root:T.Object3D){
  root.traverse(o=>{if(!(o instanceof T.Mesh))return;o.castShadow=true;o.receiveShadow=true;this.geometries.add(o.geometry);
   for(const material of Array.isArray(o.material)?o.material:[o.material]){
    this.materials.add(material);
    for(const key of ['map','normalMap','roughnessMap','metalnessMap'] as const){
     const m=material as T.MeshStandardMaterial,t=m[key];if(!t)continue;
     // glTF-exported image names are shared across these authored assets. Include
     // sampling/color-space state so normal and sRGB data never share a texture.
     const id=`${t.name||t.uuid}:${t.colorSpace}:${t.wrapS}:${t.wrapT}`;
     const shared=this.textures.get(id);if(shared&&shared!==t){m[key]=shared;t.dispose();}else this.textures.set(id,t);
    }
    if(material.name==='PolyHaven plaster')this.mapped.setPlaster(material as T.MeshStandardMaterial);
   }
  });
 }
 private request(asset:string,hero?:typeof HEROES[number]){
  if(this.pending.has(asset)||this.dead)return;this.pending.add(asset);
  void this.loader.loadAsync(BASE+asset+'.glb').then(gltf=>{
   if(this.dead){disposeLoaded(gltf.scene);return;}
   this.own(gltf.scene);
   if(hero){
    const b=NEIGHBOURHOOD.buildings.find(b=>b.id===hero.id);if(!b)return;
    const x=b.p.reduce((s:number,p:number[])=>s+p[0]/b.p.length,0),z=b.p.reduce((s:number,p:number[])=>s+p[1]/b.p.length,0);
    gltf.scene.position.set(x,0,z);gltf.scene.name=hero.name;this.group.add(gltf.scene);this.heroes.set(hero.id,{object:gltf.scene,x,z});
    const fallback=this.mapped.heroFallbacks.get(hero.id);if(fallback)fallback.visible=false;
   }else{
    gltf.scene.updateMatrixWorld(true);
    const parts=new Map<T.Material,T.BufferGeometry[]>();
    gltf.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;
     // Exporter produces one material per primitive/mesh in this asset contract.
     if(Array.isArray(o.material))throw Error('Neighbourhood kit requires one material per primitive');
     const clone=o.geometry.clone().applyMatrix4(o.matrixWorld),geo=clone.index?clone.toNonIndexed():clone;if(geo!==clone)clone.dispose();
     if(!parts.has(o.material))parts.set(o.material,[]);parts.get(o.material)!.push(geo);
    });
    const instances:T.InstancedMesh[]=[];
    for(const [material,geos] of parts){const geo=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!geo)throw Error('Kit merge failed');
     this.geometries.add(geo);const mesh=new T.InstancedMesh(geo,material,48);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);instances.push(mesh);this.group.add(mesh);
    }
    this.kits.set(asset,instances);
   }
   this.last=-Infinity;
  }).catch(error=>{if(!this.dead)this.group.userData.assetErrors.push({asset,message:String(error)});});
 }
 update(seconds:number,viewer?:{x:number;z:number},battery=false){
  if(this.dead||!viewer||seconds-this.last<.2)return;this.last=seconds;
  this.mapped.update(viewer,battery);this.parkFurniture.update(viewer,battery);
  for(const hero of ALL_HEROES){const b=NEIGHBOURHOOD.buildings.find(b=>b.id===hero.id);if(!b)continue;const p=b.p[0];
   if(Math.hypot(p[0]-viewer.x,p[1]-viewer.z)<(COMPLETED_BUILDING_IDS.has(hero.id)?(battery?120:240):1000))this.request(hero.asset,hero);
  }
  for(const h of this.heroes.values())h.object.visible=Math.hypot(h.x-viewer.x,h.z-viewer.z)<(battery?720:1100);
  const sites=this.near(viewer,battery?100:185,battery?24:48);
  for(const site of sites)if(KIT_IDS.includes(site.model))this.request(site.model);
  this.kits.forEach(meshes=>meshes.forEach(mesh=>mesh.count=0));
  for(const site of sites){const meshes=this.kits.get(site.model);if(!meshes)continue;
   this.dummy.position.set(site.x,.12,site.z);this.dummy.rotation.set(0,site.yaw,0);this.dummy.scale.set(site.width/4,1,1);this.dummy.updateMatrix();
   for(const mesh of meshes)if(mesh.count<48)mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
  }
  this.kits.forEach(meshes=>meshes.forEach(mesh=>mesh.instanceMatrix.needsUpdate=true));
  this.labels.update(seconds,viewer,battery,true);
 }
 retire(){this.dead=true;this.labels.retire();}
 dispose(){if(this.disposed)return;this.disposed=true;this.retire();this.labels.dispose();this.mapped.dispose();this.parkFurniture.dispose();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());new Set(this.textures.values()).forEach(t=>t.dispose());this.group.clear();this.group.removeFromParent();}
}
function disposeLoaded(root:T.Object3D){const textures=new Set<T.Texture>();root.traverse(o=>{if(!(o instanceof T.Mesh))return;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);m.dispose();}});textures.forEach(t=>t.dispose());}
