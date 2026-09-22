import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {QUARTER} from './quarterData.mjs';
import {BRIDGE,bridgeDeckHeight,quarterFacadeParts} from './quarterCore.mjs';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
/** Additional local architecture, not another set of building shells. Static
 * street identities retain their existing owner. Repeated details are instanced. */
export class TabakeveQuarterLayer {
 readonly group=new T.Group();
 readonly bridge=new T.Group();
 private batches=new Map<string,T.InstancedMesh>();
 private signs=new T.Group();private materials:T.Material[]=[];private textures:T.Texture[]=[];
 private near=nearbyIndex(QUARTER.buildings);
 private cache=new Map<string,ReturnType<typeof quarterFacadeParts>>();
 private last=-Infinity;private dead=false;private disposed=false;
 private dummy=new T.Object3D();private color=new T.Color();
 private blocked:ReturnType<typeof ribbonExclusion>|null;
 constructor(options:StreetDetailOptions={}){
  this.group.name='Tirana:Tabakeve-Petro-Nini-Ali-Demi';
  this.group.userData={accuracy:QUARTER.accuracy,sources:QUARTER.sources,buildings:QUARTER.buildings.length,estimatedTrees:QUARTER.trees.length};
  this.blocked=options.track?ribbonExclusion(options.track):null;
  const material=new T.MeshStandardMaterial({roughness:.84});this.materials.push(material);
  for(const [key,geometry,capacity] of [['box',new T.BoxGeometry(1,1,1),2400],['tank',new T.CylinderGeometry(.5,.5,1,10),96]] as const){
   const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.batches.set(key,mesh);this.group.add(mesh);
  }
  this.buildBridge();this.buildSigns();this.group.add(this.bridge,this.signs);
 }
 private buildSigns(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;
  for(const [i,site] of QUARTER.shops.entries()){
   const y=i*128;ctx.fillStyle=i?'#eee3c7':'#20221f';ctx.fillRect(0,y,1024,128);
   ctx.strokeStyle=i?'#a14b28':'#baa879';ctx.lineWidth=7;ctx.strokeRect(5,y+5,1014,118);
   ctx.fillStyle=i?'#903f25':'#cfbd88';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${i?76:64}px sans-serif`;ctx.fillText(site.name,512,y+64,975);
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);
  const material=new T.MeshStandardMaterial({map:texture,roughness:.8});this.materials.push(material);
  for(const [i,site] of QUARTER.shops.entries()){
   const geometry=new T.PlaneGeometry(site.width,i?.58:.85),uv=geometry.getAttribute('uv');
   for(let j=0;j<uv.count;j++)uv.setY(j,uv.getY(j)/2+(i?0:.5));
   const mesh=new T.Mesh(geometry,material);mesh.position.set(site.x,site.y,site.z);mesh.rotation.y=site.yaw;mesh.userData={...site};mesh.name=site.name;this.signs.add(mesh);
   // A shallow awning and shop glazing below the bakery identity. The mapped
   // neighboring KMY frontage remains intact to the left of this small unit.
   if(i){
    const m=new T.MeshStandardMaterial({color:0x98623d,roughness:.9});this.materials.push(m);
    const awning=new T.Mesh(new T.BoxGeometry(site.width,.12,.68),m);awning.position.set(site.x+Math.sin(site.yaw)*.3,site.y-.45,site.z+Math.cos(site.yaw)*.3);awning.rotation.y=site.yaw;this.signs.add(awning);
   }
  }
 }
 private buildBridge(){
  this.bridge.name='Ura e Tabakëve:authored-stone-pedestrian-bridge';
  this.bridge.position.set(BRIDGE.x,0,BRIDGE.z);this.bridge.rotation.y=-BRIDGE.yaw;
  this.bridge.userData={source:BRIDGE.source,accuracy:'2.5 m walkway and 8 m main arch follow municipal reference; remaining dimensions and stonework authored'};
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#71654d';ctx.fillRect(0,0,256,256);
  for(let row=0;row<16;row++)for(let col=-1;col<9;col++){
   const n=(row*37+col*19+400)%9,x=col*32+(row%2)*16,y=row*16;ctx.fillStyle=['#a09475','#817354','#b2a283','#766e5b','#c1b28d'][n%5];ctx.beginPath();ctx.roundRect(x+1,y+1,29,13,3);ctx.fill();
  }
  const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);
  const stone=new T.MeshStandardMaterial({map:texture,color:0xcbbaa0,roughness:1}),rim=new T.MeshStandardMaterial({color:0xb9a181,roughness:1});this.materials.push(stone,rim);
  const shape=new T.Shape();shape.moveTo(-BRIDGE.length/2,.02);shape.lineTo(BRIDGE.length/2,.02);
  for(let i=40;i>=0;i--){const x=-BRIDGE.length/2+BRIDGE.length*i/40;shape.lineTo(x,bridgeDeckHeight(x));}shape.closePath();
  for(const [centre,radius,height] of [[0,4,3.5],[-7.1,1.15,1.5],[7.1,1.15,1.5]]){
   const hole=new T.Path();hole.moveTo(centre-radius,.06);hole.lineTo(centre+radius,.06);
   for(let i=0;i<=24;i++){const a=Math.PI*i/24;hole.lineTo(centre+Math.cos(a)*radius,.09+Math.sin(a)*height);}hole.closePath();shape.holes.push(hole);
  }
  const sideGeometry=new T.ShapeGeometry(shape,24);const position=sideGeometry.getAttribute('position'),uv=sideGeometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/4,position.getY(i)/3);
  const left=new T.Mesh(sideGeometry,stone);left.position.z=BRIDGE.width/2;const right=new T.Mesh(sideGeometry.clone(),stone);right.position.z=-BRIDGE.width/2;right.rotation.y=Math.PI;this.bridge.add(left,right);
  const deck:T.BufferGeometry[]=[],arch:T.BufferGeometry[]=[];
  for(let i=0;i<64;i++){
   const x=-BRIDGE.length/2+(i+.5)*BRIDGE.length/64,y=bridgeDeckHeight(x),step=BRIDGE.length/64;
   const slope=(bridgeDeckHeight(x+step/2)-bridgeDeckHeight(x-step/2))/step;
   deck.push(new T.BoxGeometry(step*1.025,.13,BRIDGE.width).rotateZ(Math.atan(slope)).translate(x,y-.015,0));
  }
  for(const [centre,radius,height] of [[0,4,3.5],[-7.1,1.15,1.5],[7.1,1.15,1.5]])for(let i=0;i<32;i++){
   const a=Math.PI*(i+.5)/32,x=centre+Math.cos(a)*radius,y=.09+Math.sin(a)*height,rotation=Math.atan2(Math.cos(a)*height,-Math.sin(a)*radius);
   const step=Math.hypot(Math.sin(a)*radius,Math.cos(a)*height)*Math.PI/32;
   for(const z of [-BRIDGE.width/2,BRIDGE.width/2])arch.push(new T.BoxGeometry(step+.018,.24,.12).rotateZ(rotation).translate(x,y,z));
  }
  for(const [parts,material] of [[deck,stone],[arch,rim]] as const){const geo=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());const mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;mesh.castShadow=true;this.bridge.add(mesh);}
 }
 update(seconds:number,viewer?:{x:number;z:number},battery=false){
  if(this.dead||!viewer||seconds>=this.last&&seconds-this.last<.25)return;this.last=seconds;
  this.bridge.visible=Math.hypot(viewer.x-BRIDGE.x,viewer.z-BRIDGE.z)<(battery?180:420)&&!this.blocked?.(BRIDGE.x,BRIDGE.z,13);
  this.signs.visible=Math.hypot(viewer.x-936,viewer.z-237)<(battery?140:320);
  const nearby=this.near(viewer,battery?90:170,battery?14:36),parts=[];
  for(const b of nearby){if(!this.cache.has(b.id))this.cache.set(b.id,quarterFacadeParts(b));parts.push(...this.cache.get(b.id)!);}
  parts.sort((a,b)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z));
  this.batches.forEach(mesh=>mesh.count=0);
  for(const p of parts){const mesh=this.batches.get(p.model)!;if(mesh.count>=Math.min(mesh.instanceMatrix.count,battery?650:Infinity))continue;
   this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(0,p.yaw,0);this.dummy.scale.set(p.w,p.h,p.d);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count,this.dummy.matrix);mesh.setColorAt(mesh.count++,this.color.setHex(p.color));
  }
  this.batches.forEach(mesh=>{mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;});
  const keep=new Set(nearby.map(b=>b.id));for(const id of this.cache.keys())if(this.cache.size>64&&!keep.has(id))this.cache.delete(id);
  this.group.userData.visibleBuildings=nearby.length;
 }
 retire(){this.dead=true;}
 dispose(){if(this.disposed)return;this.disposed=true;this.retire();this.group.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();if(o instanceof T.Mesh)o.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.cache.clear();this.group.clear();this.group.removeFromParent();}
}
