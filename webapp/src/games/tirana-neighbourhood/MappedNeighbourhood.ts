import * as T from 'three';
import {AGED_HOUSING_IDS} from '../tirana-city-source/housingRegistry.mjs';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {NEIGHBOURHOOD} from './data.mjs';
import {HERO_IDS} from './assets.mjs';
import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';

type Cell={object:T.Object3D;x:number;z:number;detail:boolean};
/** Source polygons remain collision geometry. Static shells and window planes
 * are merged in 240 m cells; there is no Object3D for every window/building. */
export class MappedNeighbourhood {
 readonly group=new T.Group();
 readonly heroFallbacks=new Map<string,T.Mesh>();
 private cells:Cell[]=[];
 private materials:T.Material[]=[];
 private wall:T.MeshStandardMaterial;
 constructor(agedHousing=false){
  this.group.name='Tirana:Ali-Demi-source-footprints';
  this.wall=new T.MeshStandardMaterial({vertexColors:true,roughness:.86});
  const glass=new T.MeshStandardMaterial({color:0x365761,roughness:.3,metalness:.3});
  this.materials.push(this.wall,glass);
  const buckets=new Map<string,{shells:T.BufferGeometry[];windows:T.BufferGeometry[];x:number;z:number}>();
  const color=new T.Color(),palette=[0xcbbfa8,0xcebea9,0xc3c4b9,0xd0bfa7,0xc2b7a8];
  for(const b of NEIGHBOURHOOD.buildings){
   const x=b.p.reduce((s:number,p:number[])=>s+p[0]/b.p.length,0),z=b.p.reduce((s:number,p:number[])=>s+p[1]/b.p.length,0);
   const cx=Math.floor(x/240)*240+120,cz=Math.floor(z/240)*240+120,key=`${cx}:${cz}`;
   if(!buckets.has(key))buckets.set(key,{shells:[],windows:[],x:cx,z:cz});
   const bucket=buckets.get(key)!;
   const shape=new T.Shape(b.p.map((p:number[])=>new T.Vector2(p[0],-p[1])));
   for(const hole of b.holes)shape.holes.push(new T.Path(hole.map((p:number[])=>new T.Vector2(p[0],-p[1]))));
   const geometry=new T.ExtrudeGeometry(shape,{depth:Math.max(.1,b.h-b.minHeight),bevelEnabled:false,steps:1}).rotateX(-Math.PI/2).translate(0,b.minHeight,0);
   const pos=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
   const seed=Array.from(String(b.id)).reduce((sum,v)=>sum+v.charCodeAt(0),0);
   color.setHex(palette[seed%palette.length]);
   if(/^#[0-9a-f]{6}$/i.test(b.tags['building:colour']||''))color.set(b.tags['building:colour']);
   const colors=new Float32Array(pos.count*3);
   for(let i=0;i<pos.count;i++){
    uv.setXY(i,(Math.abs(normal.getX(i))>.5?pos.getZ(i):pos.getX(i))/4,Math.abs(normal.getY(i))>.5?pos.getZ(i)/4:pos.getY(i)/4);
    color.toArray(colors,i*3);
   }
   geometry.setAttribute('color',new T.BufferAttribute(colors,3));
   if(HERO_IDS.has(b.id)){
    const fallback=new T.Mesh(geometry,this.wall);fallback.castShadow=true;fallback.receiveShadow=true;
    this.heroFallbacks.set(b.id,fallback);this.group.add(fallback);continue;
   }
   bucket.shells.push(geometry);
   if(agedHousing&&AGED_HOUSING_IDS.has(String(b.id)))continue;
   // Windows are an explicit generic approximation, only on buildings with
   // sourced heights/levels. Unknown one-storey placeholders gain no fake bays.
   if(b.heightSource==='unknown'&&!b.levels)continue;
   for(const edge of facadeEdges(b.p)){
    if(edge.length<3)continue;
    const columns=Math.min(24,Math.floor(edge.length/4));
    for(let y=Math.max(b.minHeight+1.7,4.7);y<b.h-1;y+=3.2)for(let j=0;j<columns;j++){
     const u=(j+.5)*edge.length/columns;
     const g=new T.PlaneGeometry(Math.min(1.45,edge.length/columns-.8),1.65).rotateY(Math.atan2(edge.nx,edge.nz)).translate(edge.a[0]+edge.ux*u+edge.nx*.055,y,edge.a[1]+edge.uz*u+edge.nz*.055);
     bucket.windows.push(g);
    }
   }
  }
  for(const bucket of buckets.values())for(const [parts,material,detail] of [[bucket.shells,this.wall,false],[bucket.windows,glass,true]] as const){
   if(!parts.length)continue;
   const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!geometry)throw Error('Neighbourhood geometry merge failed');
   const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.castShadow=!detail;this.group.add(mesh);
   this.cells.push({object:mesh,x:bucket.x,z:bucket.z,detail});
  }
  // Published park/pitch/covered-reservoir outlines. Covers use a visual 18 cm
  // offset over the existing flat datum, not a measured tank/terrain height.
  const surfaces=new Map<number,T.BufferGeometry[]>();
  for(const feature of NEIGHBOURHOOD.polygonFeatures){
   const p=feature.p,t=feature.tags;
   if(p.every((v:number[])=>v[0]>=-805&&v[0]<=660&&v[1]>=-380&&v[1]<=1150))continue;
   const cover=t.man_made==='reservoir_covered',c=cover?0xb0b2a6:t.leisure==='pitch'?0x536f4d:t.amenity==='marketplace'?0xb5aa8d:0x788360;
   const geometry=new T.ShapeGeometry(new T.Shape(p.map((v:number[])=>new T.Vector2(v[0],-v[1])))).rotateX(-Math.PI/2).translate(0,cover?.18:.05,0);
   if(!surfaces.has(c))surfaces.set(c,[]);surfaces.get(c)!.push(geometry);
  }
  for(const [color,parts] of surfaces){const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!geo)continue;const mat=new T.MeshStandardMaterial({color,roughness:.95});this.materials.push(mat);const mesh=new T.Mesh(geo,mat);mesh.receiveShadow=true;this.group.add(mesh);}
  const waterMaterial=new T.MeshStandardMaterial({color:0x557a70,roughness:.3,metalness:.2});this.materials.push(waterMaterial);
  for(const water of NEIGHBOURHOOD.water)for(const polygon of water.polygons??[]){const shape=new T.Shape(polygon.outer.map((p:number[])=>new T.Vector2(p[0],-p[1])));for(const hole of polygon.holes)shape.holes.push(new T.Path(hole.map((p:number[])=>new T.Vector2(p[0],-p[1]))));this.group.add(new T.Mesh(new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,.03,0),waterMaterial));}
 }
 setPlaster(material:T.MeshStandardMaterial){
  this.wall.map=material.map;this.wall.normalMap=material.normalMap;this.wall.roughnessMap=material.roughnessMap;this.wall.normalScale.copy(material.normalScale);this.wall.needsUpdate=true;
 }
 update(viewer:{x:number;z:number},battery:boolean){for(const c of this.cells){const radius=c.detail?(battery?200:340):(battery?720:1100);c.object.visible=(c.x-viewer.x)**2+(c.z-viewer.z)**2<radius*radius;}}
 dispose(){this.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.group.clear();this.group.removeFromParent();}
}
