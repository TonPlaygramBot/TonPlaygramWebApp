import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MAPPED_PARKS,type MappedAmenity} from './mappedAmenitiesCore.mjs';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
/** Boundaries are mapped; furnishings are authored within those boundaries. */
export class MappedParkLife {
 readonly group=new T.Group();
 private cache=new Map<string,T.Group>();private last=-Infinity;private dead=false;
 private materials=[new T.MeshStandardMaterial({color:0x8b6748,roughness:.88}),new T.MeshStandardMaterial({color:0x3b6961,roughness:.62}),new T.MeshStandardMaterial({color:0xd5a545,roughness:.55}),new T.MeshStandardMaterial({color:0x719299,roughness:.32,metalness:.65}),new T.MeshStandardMaterial({color:0xa66259,roughness:.96})];
 readonly sites:MappedAmenity[]=MAPPED_PARKS.filter(s=>s.furnishingAnchor).map(s=>({...s,...s.furnishingAnchor!}));
 private near=nearbyIndex(this.sites);
 constructor(){this.group.name='Tirana:mapped-parks-and-playgrounds';this.group.userData={source:'OpenStreetMap',municipalReference:'https://tirana.al/artikull/kende-lojerash-ne-cdo-lagje',equipment:'Estimated arrangement within mapped boundaries',sites:this.sites.length};}
 private build(s:any){
  const root=new T.Group(),parts:T.BufferGeometry[][]=this.materials.map(()=>[]);
  const box=(m:number,x:number,y:number,z:number,w:number,h:number,d:number,tilt=0)=>parts[m].push(new T.BoxGeometry(w,h,d).rotateX(tilt).translate(x,y,z));
  const bench=(x:number,z:number)=>{for(let j=0;j<4;j++)box(0,x,.48,z+j*.11,1.7,.06,.09);for(let j=0;j<3;j++)box(0,x,.68+j*.13,z-.05,1.7,.08,.055);for(const dx of [-.63,.63])box(1,x+dx,.25,z+.15,.08,.5,.35);};
  if(s.category==='playground'){
   box(4,0,.055,0,4.4,.035,4.4);
   // Compact climbing deck, slide and low balance beam; all within 3.1 m.
   for(const x of [-.55,.55])for(const z of [-.65,.35])box(1,x,.9,z,.10,1.8,.10);
   box(0,0,1.1,-.15,1.2,.1,1.1);box(2,0,2.05,-.15,1.35,.10,1.2);
   box(3,0,.64,1.15,.65,.065,1.9,.6);
   for(const x of [-.36,.36])box(2,x,.71,1.15,.07,.17,1.9,.6);
   for(let y=.22;y<1.1;y+=.22)box(2,0,y,-.77,1,.055,.09);
   box(0,-1.6,.28,0,.20,.12,2.7);for(const z of [-.9,.9])box(1,-1.6,.14,z,.1,.28,.1);
  }else bench(0,0);
  parts.forEach((gs,i)=>{if(!gs.length)return;const g=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());if(g){const m=new T.Mesh(g,this.materials[i]);m.castShadow=true;m.receiveShadow=true;root.add(m);}});
  root.position.set(s.x,0,s.z);root.name=s.name;root.userData={source:s.source,accuracy:s.accuracy};return root;
 }
 update(seconds:number,viewer:{x:number;z:number},battery=false){
  if(this.dead)return;
  if(seconds>=this.last&&seconds-this.last<.15)return;this.last=seconds;
  const selected=this.near(viewer,battery?160:360,battery?10:24),keep=new Set(selected.map((s:any)=>s.id));this.cache.forEach(g=>g.visible=false);let built=0;
  for(const s of selected){let g=this.cache.get(s.id);if(!g){if(built++>=2)continue;g=this.build(s);this.cache.set(s.id,g);this.group.add(g);}g.visible=true;}
  for(const [id,g] of this.cache)if(this.cache.size>36&&!keep.has(id)){this.release(g);this.cache.delete(id);}
 }
 private release(g:T.Group){g.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});g.removeFromParent();}
 dispose(){if(this.dead)return;this.dead=true;this.cache.forEach(g=>this.release(g));this.cache.clear();this.materials.forEach(m=>m.dispose());this.group.removeFromParent();}
}
