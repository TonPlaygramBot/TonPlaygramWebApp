import * as T from 'three';
import {EnvironmentMaterials} from '../tirana-environment/EnvironmentMaterials';
import {surfaceGeometry} from '../tirana-environment/riverGeometry';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';
import {AGED_HOUSING_IDS} from '../tirana-city-source/housingRegistry.mjs';
type Bucket={x:number;z:number;buildings:any[];root?:T.Group;used:number};

/** Build a bounded number of nearby cells, not tens of thousands of buildings
 * on the first frame. CPU and GPU geometry are both evicted from the cache.
 */
export class MappedBuildingCells {
 readonly group=new T.Group();
 private buckets:Bucket[]=[];
 private frame=0;
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
  this.buckets=[...map.values()];this.group.name='Tirana:streamed-building-cells';
 }
 build(buildings:any[]){
  const group=new T.Group(),shells:T.BufferGeometry[]=[],windows:T.BufferGeometry[]=[],roofs:T.BufferGeometry[]=[];
  for(const b of buildings){
   const shape=new T.Shape(b.p.map((p:number[])=>new T.Vector2(p[0],-p[1])));
   for(const h of b.holes??[])shape.holes.push(new T.Path(h.map((p:number[])=>new T.Vector2(p[0],-p[1]))));
   const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.1,b.h-(b.minHeight||0)),bevelEnabled:false,steps:1}).rotateX(-Math.PI/2).translate(0,b.minHeight||0,0);
   const pos=geo.getAttribute('position'),normal=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
   const seed=Array.from(String(b.id)).reduce((s,c)=>s+c.charCodeAt(0),0),palette=[0xcbbfa8,0xcebea9,0xc3c4b9,0xd0bfa7,0xc2b7a8];
   const color=new T.Color(palette[seed%palette.length]),tag=b.tags?.['building:colour'];
   if(/^#[0-9a-f]{6}$/i.test(tag||''))color.set(tag);
   const colors=new Float32Array(pos.count*3);
   for(let i=0;i<pos.count;i++){
    uv.setXY(i,(Math.abs(normal.getX(i))>.5?pos.getZ(i):pos.getX(i))/4,Math.abs(normal.getY(i))>.5?pos.getZ(i)/4:pos.getY(i)/4);
    const shade=Math.abs(normal.getY(i))>.5?.72:.84+.16*Math.min(1,(pos.getY(i)-(b.minHeight||0))/2.2);
    colors[i*3]=color.r*shade;colors[i*3+1]=color.g*shade;colors[i*3+2]=color.b*shade;
   }
   geo.setAttribute('color',new T.BufferAttribute(colors,3));shells.push(geo);
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
    for(let y=Math.max((b.minHeight||0)+1.7,4.7);y<b.h-1;y+=3.2)for(let j=0;j<columns;j++){
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
 update(viewer:{x:number;z:number},battery:boolean){
  this.frame++;
  const distance=(b:Bucket)=>Math.hypot(b.x-viewer.x,b.z-viewer.z);
  const selected=this.buckets.filter(b=>distance(b)<(battery?720:1050)).sort((a,b)=>distance(a)-distance(b)).slice(0,battery?24:48);
  const keep=new Set(selected);let budget=2;
  for(const b of selected){
   if(!b.root&&budget-->0){b.root=this.build(b.buildings);this.group.add(b.root);}
   b.used=this.frame;
  }
  for(const b of this.buckets)if(b.root){b.root.visible=keep.has(b);for(const m of b.root.children)if(m.userData.windows)m.visible=distance(b)<(battery?240:420);}
  const cached=this.buckets.filter(b=>b.root).sort((a,b)=>a.used-b.used);
  while(cached.length>(battery?32:56)){const b=cached.shift()!;if(b.root){this.release(b.root);b.root=undefined;}}
  this.group.userData.cachedCells=this.buckets.filter(b=>b.root).length;
 }
 private release(root:T.Group){root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});root.clear();root.removeFromParent();}
 dispose(){this.finish.dispose();for(const b of this.buckets)if(b.root)this.release(b.root);this.buckets=[];this.group.removeFromParent();}
}
