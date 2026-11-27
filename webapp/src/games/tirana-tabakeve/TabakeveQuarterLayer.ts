import {mountTabakeveMasonry} from './tabakeveMasonry';
import {createQuarterCassetteSample} from './shutterCassetteSample';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {QUARTER} from './quarterData.mjs';
import {petroNiniFrontages} from './petroNiniFrontages.mjs';
import {petroTodiBlockFacades,petroTodiBlockParts} from './petroTodiBlocks.mjs';
import {NEIGHBOURHOOD} from '../tirana-neighbourhood/data.mjs';
import {BRIDGE,BRIDGE_CURB,bridgeDeckHeight,bridgeDeckSections,quarterFacadeParts} from './quarterCore.mjs';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
/** Additional local architecture, not another set of building shells. Static
 * street identities retain their existing owner. Repeated details are instanced. */
const PETRO_TODI=petroTodiBlockFacades(NEIGHBOURHOOD.buildings).map(b=>({...b,parts:petroTodiBlockParts(b)}));
const TREATMENT_IDS=new Set(PETRO_TODI.map(b=>b.id));
export class TabakeveQuarterLayer {
 readonly group=new T.Group();
 readonly bridge=new T.Group();
 private masonry?: ReturnType<typeof mountTabakeveMasonry>;
 private batches=new Map<string,T.InstancedMesh>();
 private signs=new T.Group();private materials:T.Material[]=[];private textures:T.Texture[]=[];
 private near=nearbyIndex(QUARTER.buildings);
 private cache=new Map<string,ReturnType<typeof quarterFacadeParts>>();
 private last=-Infinity;private dead=false;private disposed=false;
 private dummy=new T.Object3D();private color=new T.Color();
 private shutterCassettes?:ReturnType<typeof createQuarterCassetteSample>;
 private blocked:ReturnType<typeof ribbonExclusion>|null;
 constructor(options:StreetDetailOptions={}){
  this.group.name='Tirana:Tabakeve-Petro-Nini-Ali-Demi';
  this.group.userData={accuracy:QUARTER.accuracy,sources:QUARTER.sources,buildings:QUARTER.buildings.length,estimatedTrees:QUARTER.trees.length};
  this.blocked=options.track?ribbonExclusion(options.track):null;
  const material=new T.MeshStandardMaterial({roughness:.84});this.materials.push(material);
  for(const [key,geometry,capacity] of [['box',new T.BoxGeometry(1,1,1),2400],['tank',new T.CylinderGeometry(.5,.5,1,10),96]] as const){
   const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.batches.set(key,mesh);this.group.add(mesh);
  }
  this.buildBridge();const frontages=petroNiniFrontages();
  if(frontages)this.buildPetroFrontages(frontages);else this.buildSigns();this.group.add(this.bridge,this.signs);
  for(const sign of this.signs.children){
   const p=sign.position;
   if(this.blocked?.(p.x,p.z,Math.max(4,Number(sign.userData.width)||0)))sign.visible=false;
  }
  if(options.stableParkSurfaces&&options.profile==='street'&&!options.track){
   this.shutterCassettes=createQuarterCassetteSample();this.group.add(this.shutterCassettes.group);
  }
 }
 private buildPetroFrontages(layout:NonNullable<ReturnType<typeof petroNiniFrontages>>){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d');if(!ctx){this.buildSigns();return;}
  const ink=(text:string,x:number,y:number,color:string,weight:number,size:number)=>{
   ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font=`${weight} ${size}px system-ui,sans-serif`;ctx.fillText(text,x,y,455);
  };
  const fill=(c:string,x:number,y:number,w:number,h:number)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
  // Authored sign, glazing and below-grade visual reveal. No street mesh,
  // traversable stair or doorway collision changes in this art pass.
  fill('#d3bc9d',0,0,512,256);fill('#5f4734',15,14,482,225);
  fill('#453024',29,29,454,44);
  ink('BYREKTORE',256,51,'#fff4d6',750,42);
  fill('#a4805a',32,82,448,154);
  fill('#4a574e',42,94,172,130);fill('#9caca1',56,104,151,39);
  fill('#ac7147',42,186,172,37);
  fill('#252b29',248,88,205,147);
  for(let i=0;i<5;i++) {
   const y=143+i*18,x=312-i*13,w=81+i*26;
   fill(i%2?'#9b886e':'#7e6a55',x,y,w,15);
   fill('#cbb89b',x,y,w,2);
  }
  fill('#cabeaa',0,256,512,256);fill('#242729',15,278,482,217);
  fill('#343b3c',30,294,138,125);fill('#4d5756',187,294,138,125);fill('#343b3c',345,294,137,125);
  fill('#242729',30,426,452,56);
  ink('CENTURY 21 WEST',256,455,'#e4cd8e',590,35);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
  const material=new T.MeshStandardMaterial({map:texture,roughness:.82});
  this.textures.push(texture);this.materials.push(material);
  for(const [i,site] of [layout.bakery,layout.office].entries()){
   const geometry=new T.PlaneGeometry(site.width,i?1.72:2.14);
   const uv=geometry.getAttribute('uv');
   // Half-texel inset prevents the other sign bleeding into this bay.
   for(let j=0;j<uv.count;j++)uv.setY(j,(i?.002:.502)+uv.getY(j)*.496);
   const mesh=new T.Mesh(geometry,material);
   mesh.name=site.name;mesh.position.set(site.x,site.y,site.z);mesh.rotation.y=site.yaw;
   mesh.userData={...site,visualOnly:true};
   this.signs.add(mesh);
  }
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
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#686457';ctx.fillRect(0,0,512,512);
  const palette=['#9c9686','#ada694','#898577','#968b78','#b0aa96','#9e9b8e'];
  for(let row=-1;row<=16;row++)for(let col=-1;col<=16;col++){
   // Periodic seed wraps with the UV tile; irregular river stones, not brick courses.
   const i=((row+16)%16)*16+(col+16)%16,r=(n:number)=>(Math.imul((i*149+n*29)^141,48271)>>>9)%101/100;
   const x=col*32+(row&1)*15+r(1)*7,y=row*32+r(2)*8,rx=11+r(3)*4,ry=11+r(4)*4;
   const rim: [number,number][]=[];
   for(let k=0;k<7;k++){const a=k*2*Math.PI/7,rr=.79+r(k+11)*.25;rim.push([x+Math.cos(a)*rx*rr,y+Math.sin(a)*ry*rr]);}
   ctx.fillStyle=palette[(i*19+(i>>2))%palette.length];ctx.beginPath();
   const last=rim.at(-1)!,first=rim[0];ctx.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
   rim.forEach((a,k)=>{const b=rim[(k+1)%rim.length];ctx.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);});
   ctx.closePath();ctx.fill();
   if(r(8)>.42){ctx.fillStyle='rgba(240,230,207,0.15)';ctx.fillRect(x-1.4,y-2,3+r(7)*4,1);}
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
  const arch:T.BufferGeometry[]=[];
  const deckSections=bridgeDeckSections();
  // One top ribbon; physical support interpolates the exact same section heights.
  const ribbon=(xs:number[],z0:number,z1:number,height=0,normalUp=true)=>{
   const xyz:number[]=[],uv:number[]=[],index:number[]=[];
   for(const x of xs){
    xyz.push(x,bridgeDeckHeight(x)+height,z0,x,bridgeDeckHeight(x)+height,z1);
    uv.push(x/2.8,z0/2.8,x/2.8,z1/2.8);
   }
   for(let i=0;i+1<xs.length;i++){
    const l=i*2,r=l+1,n=l+2,m=l+3;
    if(normalUp)index.push(l,r,n,n,r,m);else index.push(l,n,r,n,m,r);
   }
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
   g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
  };
  const deck=[ribbon(deckSections,-BRIDGE.width/2,BRIDGE.width/2)];
  const curbEnd=BRIDGE.length/2-BRIDGE_CURB.endGap;
  const curbSections=[-curbEnd,...deckSections.filter(x=>Math.abs(x)<curbEnd),curbEnd];
  const flank=(zs:number)=>{
   const pts:number[]=[],axes:number[]=[],ix:number[]=[];
   for(const [i,x] of curbSections.entries()){
    const y=bridgeDeckHeight(x);
    pts.push(x,y-.01,zs,x,y+BRIDGE_CURB.height,zs);
    axes.push(x/2.8,0,x/2.8,BRIDGE_CURB.height/2.8);
    if(i){const a=(i-1)*2,b=i*2;ix.push(a,b,a+1,a+1,b,b+1);}
   }
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setAttribute('uv',new T.Float32BufferAttribute(axes,2));
   g.setIndex(ix);g.computeVertexNormals();return g;
  };
  // Low rock edges flank the real walkway; both ends remain open.
  const curbMaterial=new T.MeshStandardMaterial({map:texture,color:0xad9f7d,roughness:1,side:T.DoubleSide});
  this.materials.push(curbMaterial);
  const curbParts=[];
  for(const side of [-1,1]){
   const centre=side*(BRIDGE.width/2-BRIDGE_CURB.inset),a=centre-BRIDGE_CURB.width/2,b=centre+BRIDGE_CURB.width/2;
   curbParts.push(ribbon(curbSections,a,b,BRIDGE_CURB.height),flank(a),flank(b));
  }
  const curb=mergeGeometries(curbParts)!;curbParts.forEach(g=>g.dispose());
  const curbMesh=new T.Mesh(curb,curbMaterial);curbMesh.castShadow=true;curbMesh.receiveShadow=true;this.bridge.add(curbMesh);
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
  // Single shared owner; never request the photo when the track excludes the bridge.
  if(this.bridge.visible&&!this.masonry)this.masonry=mountTabakeveMasonry(this.bridge);
  this.signs.visible=Math.hypot(viewer.x-936,viewer.z-237)<(battery?140:320);
  const nearby=this.near(viewer,battery?90:170,battery?14:36),parts=[];
  for(const b of nearby){if(TREATMENT_IDS.has(b.id))continue;if(!this.cache.has(b.id))this.cache.set(b.id,quarterFacadeParts(b));parts.push(...this.cache.get(b.id)!);}
  for(const b of PETRO_TODI)if(Math.hypot(viewer.x-b.x,viewer.z-b.z)<(battery?100:180))parts.push(...b.parts.filter(p=>!this.blocked?.(p.x,p.z,Math.max(2,p.w/2))));
  parts.sort((a,b)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z));
  this.batches.forEach(mesh=>mesh.count=0);
  const replaced=this.shutterCassettes?.update(viewer,parts);
  for(const p of parts){if(replaced?.has(p))continue;const mesh=this.batches.get(p.model)!;if(mesh.count>=Math.min(mesh.instanceMatrix.count,battery?650:Infinity))continue;
   this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(0,p.yaw,0);this.dummy.scale.set(p.w,p.h,p.d);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count,this.dummy.matrix);mesh.setColorAt(mesh.count++,this.color.setHex(p.color));
  }
  this.batches.forEach(mesh=>{mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;});
  const keep=new Set(nearby.map(b=>b.id));for(const id of this.cache.keys())if(this.cache.size>64&&!keep.has(id))this.cache.delete(id);
  this.group.userData.visibleBuildings=nearby.length;
 }
 retire(){this.dead=true;this.masonry?.dispose();this.shutterCassettes?.dispose();}
 dispose(){if(this.disposed)return;this.disposed=true;this.retire();this.group.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();if(o instanceof T.Mesh)o.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.cache.clear();this.group.clear();this.group.removeFromParent();}
}
