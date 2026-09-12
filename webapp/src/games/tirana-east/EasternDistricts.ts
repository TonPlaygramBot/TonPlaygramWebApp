import * as T from 'three';
import {EAST} from './data.mjs';
import {NEIGHBOURHOOD} from '../tirana-neighbourhood/data.mjs';
import {MappedBuildingCells} from '../tirana-neighbourhood/MappedBuildingCells';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
import {modelGeometry} from './blenderModels';
import {groundHeight} from './terrainCore.mjs';
/** Shared source buildings and source-linked produce/supermarket frontages. */
export class EasternDistricts {
 readonly group=new T.Group();private walls=new T.MeshStandardMaterial({vertexColors:true,roughness:.85});private glass=new T.MeshStandardMaterial({color:0x3e6470,roughness:.3});
 private buildings:MappedBuildingCells;private signs:StreetLifeLayer;private stalls:Record<string,T.InstancedMesh>={};private material=new T.MeshStandardMaterial({vertexColors:true,roughness:.7});private last=-Infinity;
 private shops=[...NEIGHBOURHOOD.storefronts,...EAST.storefronts].filter((s:any)=>['supermarket','greengrocer','convenience','marketplace'].includes(s.shop||s.kind));
 constructor(){this.group.name='Tirana:eastern-neighbourhoods-and-fresh-markets';this.buildings=new MappedBuildingCells(EAST.buildings,this.walls,this.glass,false);this.signs=new StreetLifeLayer({storefronts:EAST.storefronts,stops:[],fuel:[],advertising:[]} as any,{},true);this.group.add(this.buildings.group,this.signs.group);
  for(const kind of ['produce','supermarket']){const m=new T.InstancedMesh(modelGeometry(kind),this.material,48);m.count=0;m.frustumCulled=false;m.receiveShadow=true;this.stalls[kind]=m;this.group.add(m);}
 }
 update(seconds:number,viewer?:{x:number;z:number},battery=false){if(!viewer)return;this.buildings.update(viewer,battery);this.signs.update(seconds,viewer,battery);if(seconds>=this.last&&seconds-this.last<.25)return;this.last=seconds;
  for(const m of Object.values(this.stalls))m.count=0;const dummy=new T.Object3D();
  const close=this.shops.filter((s:any)=>Math.hypot(s.x-viewer.x,s.z-viewer.z)<(battery?100:200)).sort((a:any,b:any)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z)).slice(0,48);
  for(const s of close){const m=this.stalls[['greengrocer','marketplace'].includes(s.shop||s.kind)?'produce':'supermarket'];dummy.position.set(s.x,groundHeight(s.x,s.z)+.1,s.z);dummy.rotation.set(0,s.yaw,0);dummy.scale.set(Math.min(1,s.width/4.8),1,1);dummy.updateMatrix();m.setMatrixAt(m.count++,dummy.matrix);}for(const m of Object.values(this.stalls))m.instanceMatrix.needsUpdate=true;
 }
 retire(){this.signs.retire();}
 dispose(){this.buildings.dispose();this.signs.dispose();for(const m of Object.values(this.stalls))m.geometry.dispose();this.walls.dispose();this.glass.dispose();this.material.dispose();this.group.clear();this.group.removeFromParent();}
}
