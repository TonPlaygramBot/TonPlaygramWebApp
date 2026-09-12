import * as T from 'three';
import {MappedBuildingCells} from './MappedBuildingCells';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {NEIGHBOURHOOD} from './data.mjs';
import {HERO_IDS} from './assets.mjs';
import {COMPLETED_BUILDING_IDS} from '../tirana-city-completion/buildingRegistry.mjs';
import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';

type Cell={object:T.Object3D;x:number;z:number;detail:boolean};
/** Source polygons remain collision geometry. Static shells and window planes
 * are merged in 240 m cells; there is no Object3D for every window/building. */
export class MappedNeighbourhood {
 readonly group=new T.Group();
 readonly heroFallbacks=new Map<string,T.Mesh>();
 private cells:Cell[]=[];
 private buildingCells:MappedBuildingCells;
 private textures=new Set<T.Texture>();
 private dead=false;
 private materials:T.Material[]=[];
 private wall:T.MeshStandardMaterial;
 constructor(agedHousing=false){
  this.group.name='Tirana:urban-source-footprints';
  this.wall=new T.MeshStandardMaterial({vertexColors:true,roughness:.86});
  const glass=new T.MeshStandardMaterial({color:0x365761,roughness:.3,metalness:.3});
  this.materials.push(this.wall,glass);
  this.buildingCells=new MappedBuildingCells(NEIGHBOURHOOD.buildings.filter(b=>!HERO_IDS.has(b.id)&&!COMPLETED_BUILDING_IDS.has(b.id)),this.wall,glass,agedHousing);
  this.group.add(this.buildingCells.group);
  for(const b of NEIGHBOURHOOD.buildings.filter(b=>HERO_IDS.has(b.id)||COMPLETED_BUILDING_IDS.has(b.id))){
   const fallback=this.buildingCells.build([b]);
   this.heroFallbacks.set(b.id,fallback as unknown as T.Mesh);this.group.add(fallback);
  }
  // Texture availability no longer depends on walking close to a hero GLB.
  for(const [file,key] of [['diff','map'],['nor_gl','normalMap'],['rough','roughnessMap']] as const){
   new T.TextureLoader().load('/assets/tirana-streets/materials/plastered_wall_02-'+file+'.jpg',texture=>{
    if(this.dead){texture.dispose();return;}texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;
    if(key==='map')texture.colorSpace=T.SRGBColorSpace;
    this.textures.add(texture);this.wall[key]=texture;this.wall.normalScale.set(.22,.22);this.wall.needsUpdate=true;
   });
  }
  // Published park/pitch/covered-reservoir outlines. Covers use a visual 18 cm
  // offset over the existing flat datum, not a measured tank/terrain height.
  const surfaces=new Map<number,T.BufferGeometry[]>();
  for(const feature of NEIGHBOURHOOD.polygonFeatures){
   const p=feature.p,t=feature.tags;
   if(p.every((v:number[])=>v[0]>=-805&&v[0]<=660&&v[1]>=-380&&v[1]<=1150))continue;
   const cover=t.man_made==='reservoir_covered',c=cover?0xb0b2a6:t.leisure==='pitch'?0x536f4d:t.amenity==='marketplace'?0xb5aa8d:0x788360;
   const shape=new T.Shape(p.map((v:number[])=>new T.Vector2(v[0],-v[1])));
   for(const h of feature.holes??[])shape.holes.push(new T.Path(h.map((v:number[])=>new T.Vector2(v[0],-v[1]))));
   const geometry=new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,cover?.18:.05,0);
   if(!surfaces.has(c))surfaces.set(c,[]);surfaces.get(c)!.push(geometry);
  }
  for(const [color,parts] of surfaces){const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!geo)continue;const mat=new T.MeshStandardMaterial({color,roughness:.95});this.materials.push(mat);const mesh=new T.Mesh(geo,mat);mesh.receiveShadow=true;this.group.add(mesh);}
  const waterMaterial=new T.MeshStandardMaterial({color:0x557a70,roughness:.3,metalness:.2});this.materials.push(waterMaterial);
  for(const water of NEIGHBOURHOOD.water)for(const polygon of water.polygons??[]){const shape=new T.Shape(polygon.outer.map((p:number[])=>new T.Vector2(p[0],-p[1])));for(const hole of polygon.holes)shape.holes.push(new T.Path(hole.map((p:number[])=>new T.Vector2(p[0],-p[1]))));this.group.add(new T.Mesh(new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,.03,0),waterMaterial));}
 }
 setPlaster(material:T.MeshStandardMaterial){
  this.wall.map=material.map;this.wall.normalMap=material.normalMap;this.wall.roughnessMap=material.roughnessMap;this.wall.normalScale.copy(material.normalScale);this.wall.needsUpdate=true;
 }
 update(viewer:{x:number;z:number},battery:boolean){this.buildingCells.update(viewer,battery);for(const c of this.cells){const radius=c.detail?(battery?200:340):(battery?720:1100);c.object.visible=(c.x-viewer.x)**2+(c.z-viewer.z)**2<radius*radius;}}
 dispose(){this.dead=true;this.buildingCells.dispose();this.textures.forEach(t=>t.dispose());this.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.group.clear();this.group.removeFromParent();}
}
