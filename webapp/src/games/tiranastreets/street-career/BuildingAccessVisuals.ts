import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildingAccessSites, stairTreads, siteVolumes, CAFE_REVOLUTION_SECONDS, type AccessSite } from '../shared/buildingAccess.mjs';
import type { StreetSimulation } from './StreetSimulation.mjs';

/** Authored public interiors. All collision treads and room cutouts use the
 * same manifest as the headless simulation; geometry never commits gameplay. */
export class BuildingAccessVisuals {
 readonly group=new T.Group();
 private materials=new Map<number,T.MeshStandardMaterial>();
 private rotors:T.Group[]=[];
 private equipment=new Map<string,T.Group>();
 private cutMaterials:{mesh:T.Mesh;original:T.Material|T.Material[];copies:T.Material[]}[]=[];
 private cutMeshes=new WeakSet<T.Mesh>();
 private cabin=new T.Group();
 private canopy=new T.Group();
 private lastBind=-Infinity;
 private textures:T.Texture[]=[];
 private scene:T.Scene;
 private sim?:StreetSimulation;
 constructor(scene:T.Scene,sim?:StreetSimulation,readonly sites:AccessSite[]=sim?.access.sites||buildingAccessSites()){
  this.scene=scene;this.sim=sim;this.group.name='Tirana:playable-building-access';
  this.group.userData.accuracy='Public building identities; authored game interiors and equipment';
  for(const site of sites)this.buildSite(site);
  this.buildCabin();this.buildCanopy();this.group.add(this.cabin,this.canopy);scene.add(this.group);this.bindBuildingCutouts();
 }
 private material(color:number){
  if(!this.materials.has(color))this.materials.set(color,new T.MeshStandardMaterial({color,roughness:color===0x91c3cb?.24:.72,metalness:color===0x30393c?.55:.08}));
  return this.materials.get(color)!;
 }
 private batch(parent:T.Group){
  const parts=new Map<number,T.BufferGeometry[]>();
  const add=(color:number,g:T.BufferGeometry)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}if(!parts.has(color))parts.set(color,[]);parts.get(color)!.push(g);};
  const box=(c:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0)=>add(c,new T.BoxGeometry(w,h,d).rotateY(yaw).translate(x,y,z));
  const flush=()=>{for(const [c,gs]of parts){const geo=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());if(geo){const mesh=new T.Mesh(geo,this.material(c));mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);}}};
  return {add,box,flush};
 }
 private label(text:string,parent:T.Group,x:number,y:number,z:number,width=4){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
  const c=canvas.getContext('2d');if(!c)return;c.fillStyle='#09201fe8';c.fillRect(0,0,1024,192);c.fillStyle='#58ddae';c.fillRect(0,0,1024,9);
  c.font='600 50px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f4f4e8';c.fillText(text,512,100,990);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true}));sprite.position.set(x,y,z);sprite.scale.set(width,width*192/1024,1);parent.add(sprite);
 }
 private buildSite(site:AccessSite){
  const root=new T.Group();root.name=site.name+' · playable';root.userData.accessSite=site.id;this.group.add(root);
  const {box,add,flush}=this.batch(root),floor=site.interiorY,e=site.entrance;
  const shape=new T.Shape(site.lobby.map(p=>new T.Vector2(p[0],-p[1])));
  add(0xb5aea0,new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,floor+.015,0));
  // Interior walls face inward, supplying the room surface hidden by exterior
  // shell backfaces. Ground entry remains open into the authored vestibule.
  for(let i=0;i<site.lobby.length;i++){
   const a=site.lobby[i],b=site.lobby[(i+1)%site.lobby.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
   if(Math.hypot(x-e.x,z-e.z)<2.1)continue;
   box(0xd3ccbe,x,floor+1.6,z,length,3.1,.09,-Math.atan2(b[1]-a[1],b[0]-a[0]));
   box(0x5e675f,x,floor+.25,z,length,.3,.11,-Math.atan2(b[1]-a[1],b[0]-a[0]));
  }
  for(const t of stairTreads(site))box(t.landing?0x929b92:0xb4b9ae,t.x,t.y-t.h/2,t.z,t.w,t.h,t.d);
  // Both stair runs remain visible; a slim centre rail helps read the turn.
  if(site.stairs){
   box(0x30393c,site.center.x,site.ground+(site.roofY-site.ground)/2,site.center.z,.07,site.roofY-site.ground,3.5);
   this.label('SHKALLË → TARRACA',root,site.center.x,floor+2.55,site.center.z+3.2,3.7);
  }else{
   const x=site.center.x-site.half+1,z=site.lobbyPoint.z;
   box(0x30393c,x,floor+1.3,z-.85,2.1,2.6,.15);box(0x8b9a9d,x,floor+1.25,z-.75,1.85,2.45,.06);
   box(0x4fc898,x+1.25,floor+1.25,z-.65,.15,.4,.1);
   box(0x30393c,site.roof.x,site.roofY+1.25,site.roof.z-.9,2,2.5,.15);
   box(0x8b9a9d,site.roof.x,site.roofY+1.2,site.roof.z-.78,1.75,2.35,.06);
   this.label('↑ ASHENSOR · TARRACA',root,x,floor+2.95,z,4);
   this.label('↓ ASHENSOR',root,site.roof.x,site.roofY+2.85,site.roof.z,3.4);
  }
  // Door jamb and projecting canopy make the exact entry legible from street.
  const yaw=Math.atan2(e.nx,e.nz);
  for(const side of [-1,1])box(0x30393c,e.doorX+e.ux*1.35*side,floor+1.5,e.doorZ+e.uz*1.35*side,.12,3,.15,yaw);
  box(0x30393c,e.doorX+e.nx*.5,floor+3.08,e.doorZ+e.nz*.5,3.2,.14,1.4,yaw);
  this.label(site.kind==='cafe'?'SKY CLUB 360° · ASHENSOR':'HYR · '+site.name,root,e.x,floor+3.65,e.z,5.5);
  box(0x856a43,site.center.x+site.half-1.15,floor+.48,site.center.z,1.6,.14,2.2);
  box(0x30393c,site.center.x+site.half-1.15,floor+.24,site.center.z,.1,.48,1.8);
  flush();
  if(site.kind==='cafe')this.buildCafe(root,site);
  const kit=new T.Group();kit.position.set(site.equipment.x,site.equipment.y,site.equipment.z);root.add(kit);this.equipment.set(site.id,kit);
  const kitBatch=this.batch(kit);
  kitBatch.box(0x293f3b,0,.22,0,.64,.44,.38);kitBatch.box(0xe1b759,0,.25,.2,.17,.38,.03);
  for(const side of [-1,1])kitBatch.add(0x30393c,new T.CylinderGeometry(.09,.12,.3,10).rotateX(Math.PI/2).translate(side*.14,.59,0));
  kitBatch.flush();this.label('PARASHUTË · DYLBITË',root,site.equipment.x,site.equipment.y+1.55,site.equipment.z,3.5);
 }
 private buildCafe(root:T.Group,site:AccessSite){
  const cafe=new T.Group();cafe.position.set(site.center.x,site.roofY,site.center.z);root.add(cafe);
  const {add,box,flush}=this.batch(cafe),r=11.25;
  add(0x383d3b,new T.CylinderGeometry(9.2,9.2,.25,64).translate(0,-.125,0));
  add(0x30393c,new T.CylinderGeometry(11.5,11.3,.18,64).translate(0,3.75,0));
  for(let i=0;i<32;i++){
   const a=i*Math.PI/16,x=Math.cos(a)*11.14,z=Math.sin(a)*11.14;
   box(0x30393c,x,1.9,z,.075,3.8,.075);
   box(0x4b514c,Math.cos(a)*6,3.6,Math.sin(a)*6,11,.08,.13,-a);
  }
  // Clear perimeter panes give a panorama; they are authored scenery above a
  // waist rail so jumping off the game roof remains possible.
  const glazing=new T.Mesh(new T.CylinderGeometry(10.95,11.25,3.35,64,1,true,.18,Math.PI*2-.36),new T.MeshPhysicalMaterial({color:0xaad5dc,transparent:true,opacity:.13,roughness:.1,metalness:.1,side:T.DoubleSide,depthWrite:false}));glazing.position.y=1.85;cafe.add(glazing);
  add(0x30393c,new T.TorusGeometry(11.25,.055,6,64).rotateX(Math.PI/2).translate(0,.8,0));
  add(0x30393c,new T.CylinderGeometry(1.95,2,1.1,32).translate(3,.55,-.5));
  add(0x564b36,new T.CylinderGeometry(2.15,2.15,.14,32).translate(3,1.14,-.5));
  for(let i=0;i<7;i++){const a=i*Math.PI/4.5;const x=3+Math.cos(a)*2.65,z=-.5+Math.sin(a)*2.65;add(0xbc9650,new T.CylinderGeometry(.28,.3,.14,12).translate(x,.85,z));box(0x30393c,x,.4,z,.06,.8,.06);}
  const wc=site.restroom!,wx=wc.x-site.center.x,wz=wc.z-site.center.z;
  box(0xc6c2b5,wx,1.35,wz-1.4,3.1,2.7,.15);box(0xc6c2b5,wx-1.5,1.35,wz,.15,2.7,2.9);box(0xc6c2b5,wx+1.5,1.35,wz,.15,2.7,2.9);box(0xc6c2b5,wx-1,1.35,wz+1.4,1.1,2.7,.15);
  box(0xe0e1d9,wx-1.1,.8,wz-.8,.5,.15,.55);box(0x30393c,wx,.2,wz,1.2,.4,.42);
  this.label('WC',cafe,wx+.6,2.3,wz+1.5,.9);
  this.label('SKY CLUB 360°',cafe,3,2.75,-.5,4.1);flush();
  const dining=new T.Group();cafe.add(dining);this.rotors.push(dining);
  const seats=this.batch(dining);seats.add(0x57574c,new T.RingGeometry(9.2,r,64).rotateX(-Math.PI/2).translate(0,.005,0));
  for(let i=0;i<14;i++){
   const a=i*Math.PI/7,x=Math.cos(a)*10.1,z=Math.sin(a)*10.1;
   seats.box(0x262b2a,x,.79,z,.75,.065,.65,-a);seats.box(0x30393c,x,.4,z,.055,.8,.055);
   for(const side of [-1,1]){
    const cx=x+Math.sin(a)*side*.65,cz=z-Math.cos(a)*side*.65;
    seats.box(0x6f553b,cx,.45,cz,.48,.1,.46,-a);seats.box(0x6f553b,cx+Math.cos(a)*.22,.72,cz+Math.sin(a)*.22,.09,.55,.46,-a);
    seats.box(0x30393c,cx,.22,cz,.06,.44,.06);
   }
  }
  seats.flush();
 }
 private buildCabin(){
  const b=this.batch(this.cabin);b.box(0x465458,0,-.09,0,2.4,.18,2.4);b.box(0x465458,0,2.45,0,2.4,.13,2.4);
  for(const x of [-1.1,1.1])for(const z of [-1.1,1.1])b.box(0x90a8ad,x,1.2,z,.06,2.4,.06);
  b.box(0x7e9598,0,1.1,1.1,2.3,.055,.055);b.flush();this.cabin.visible=false;
 }
 private buildCanopy(){
  const dome=new T.Mesh(new T.SphereGeometry(3.3,20,8,0,Math.PI*2,0,Math.PI*.47),new T.MeshStandardMaterial({color:0xc17e35,roughness:.8,side:T.DoubleSide}));dome.scale.set(1,.42,.7);dome.position.y=4.2;this.canopy.add(dome);
  const b=this.batch(this.canopy);for(const side of [-1,1])for(const front of [-1,1]){const start=new T.Vector3(side*.35,1.2,front*.2),end=new T.Vector3(side*2.6,4.3,front*1.4);const length=start.distanceTo(end);const g=new T.CylinderGeometry(.009,.009,length,4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize())).translate(...start.add(end).multiplyScalar(.5).toArray());b.add(0xd6d0b3,g);}b.flush();this.canopy.visible=false;
 }
 private bindBuildingCutouts(){
  const byId=new Map(this.sites.map(s=>[s.buildingId,s]));
  this.scene.traverse(object=>{
   if(!(object instanceof T.Mesh)||this.cutMeshes.has(object))return;
   let ancestor:T.Object3D|null=object,site:AccessSite|undefined;
   while(ancestor&&!site){if(ancestor===this.group)return;site=byId.get(String(ancestor.userData.osmWay||ancestor.userData.buildingId||''));ancestor=ancestor.parent;}
   if(!site)return;const selected=site;
   const volumes=siteVolumes(selected);
   const polygon=(p:number[][])=>p.map((a,i)=>{const b=p[(i+1)%p.length];return `((${(b[0]-a[0]).toFixed(5)})*(vAccessWorld.z-(${a[1].toFixed(5)}))-(${(b[1]-a[1]).toFixed(5)})*(vAccessWorld.x-(${a[0].toFixed(5)}))>=-0.001)`;}).join('&&');
   let discard=volumes.map(v=>`if(vAccessWorld.y>${v.minY.toFixed(4)}&&vAccessWorld.y<${v.h.toFixed(4)}&&(${polygon(v.p)}))discard;`).join('\n');
   if(selected.kind==='cafe')discard+=`\nif(vAccessWorld.y>${(selected.roofY-0.05).toFixed(4)})discard;`;
   const original=object.material,copies=(Array.isArray(original)?original:[original]).map(material=>{
    const copy=material.clone(),previous=material.onBeforeCompile;
    copy.onBeforeCompile=(shader:Parameters<T.Material['onBeforeCompile']>[0],renderer:T.WebGLRenderer)=>{previous.call(copy,shader,renderer);shader.vertexShader='varying vec3 vAccessWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvAccessWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='varying vec3 vAccessWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+discard);};
    copy.customProgramCacheKey=()=>`building-access:${selected.id}:${material.customProgramCacheKey()}`;copy.needsUpdate=true;return copy;
   });
   object.material=Array.isArray(original)?copies:copies[0];this.cutMaterials.push({mesh:object,original,copies});this.cutMeshes.add(object);
  });
 }
 update(time:number,sim=this.sim){
  for(const platform of this.rotors)platform.rotation.y=-time*2*Math.PI/CAFE_REVOLUTION_SECONDS;
  if(time-this.lastBind>3){this.lastBind=time;this.bindBuildingCutouts();}
  if(!sim)return;
  this.cabin.visible=!!sim.access.travel;if(this.cabin.visible)this.cabin.position.set(sim.player.x,sim.body.y,sim.player.z);
  this.canopy.visible=sim.access.parachute.open;if(this.canopy.visible){this.canopy.position.set(sim.player.x,sim.body.y,sim.player.z);this.canopy.rotation.y=sim.body.yaw;}
  for(const [id,kit]of this.equipment){kit.children.forEach(o=>{if(o instanceof T.Mesh)o.scale.setScalar(sim.access.collected.has(id)?.65:1);});}
 }
 dispose(){
  for(const {mesh,original,copies}of this.cutMaterials){mesh.material=original;copies.forEach(m=>m.dispose());}this.cutMaterials=[];
  const materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}if(o instanceof T.Sprite)materials.add(o.material);});
  materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.group.removeFromParent();
 }
}
