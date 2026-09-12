import * as T from 'three';
import {CITY_COMPLETION,type Fixture} from './data.mjs';
import {bakedParts,bakedMaterial} from './bakedGeometry';
import {MatureTreeLayer} from '../tirana-street-life/MatureTreeLayer';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
type Point={x:number;z:number};
type Nearby<A>=(p:Point,radius:number,limit:number)=>A[];
type Batch={meshes:T.InstancedMesh[];near:Nearby<Point&{y?:number;yaw?:number;scale?:number}>;capacity:number};

/** Source-derived missing city fixtures. Hard visible-instance budgets, one
 * shared sign atlas, and no runtime API calls or per-object texture downloads. */
export class CityCompletionLayer {
 readonly group=new T.Group();
 readonly trees:MatureTreeLayer;
 private batches=new Map<string,Batch>();private materials=new Map<string,T.Material>();
 private last=-Infinity;private dead=false;private disposed=false;private dummy=new T.Object3D();
 private signs:T.InstancedMesh;private signTexture:T.CanvasTexture;private glyphs=new Map<string,number>();
 private lenses:T.InstancedMesh;private white:T.InstancedMesh;private arrows:T.InstancedMesh;
 private arrowTexture:T.CanvasTexture;
 private fixtures:Nearby<Fixture>;private bays:Nearby<Point&{yaw:number;w:number;d:number}>;private arrowPoints:Nearby<Point&{yaw:number}>;
 private selected:Fixture[]=[];private rows=1;private color=new T.Color();
 constructor(options:StreetDetailOptions={},data=CITY_COMPLETION){
  this.group.name='Tirana:mapped-city-completion';
  const exclusion=options.track?ribbonExclusion(options.track):()=>false;
  const fixtures=data.fixtures.filter(p=>!exclusion(p.x,p.z,p.kind==='waste_container'?1.2:.5));
  this.fixtures=nearbyIndex(fixtures);
  this.trees=new MatureTreeLayer(data.trees,options);this.group.add(this.trees.group);
  this.bays=nearbyIndex(data.parking.flatMap(p=>p.bays).filter(p=>!exclusion(p.x,p.z,Math.hypot(p.w,p.d)/2)));
  this.arrowPoints=nearbyIndex(data.arrows.filter(p=>!exclusion(p.x,p.z,2)));
  const model=(kind:string)=>['speed','stop','give_way','parking'].includes(kind)?'sign_pole':kind==='direction'?'direction_pole':kind;
  for(const name of new Set(fixtures.map(p=>model(p.kind)).concat('shrub'))){
   const capacity=name==='shrub'?220:96;
   const meshes=bakedParts(name).map(p=>{
    if(!this.materials.has(p.material))this.materials.set(p.material,bakedMaterial(p.material));
    const mesh=new T.InstancedMesh(p.geometry,this.materials.get(p.material)!,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=name!=='shrub';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);return mesh;
   });
   this.batches.set(name,{meshes,capacity,near:nearbyIndex(name==='shrub'?data.shrubs.filter(p=>!exclusion(p.x,p.z,1)):fixtures.filter(p=>model(p.kind)===name))});
  }
  const labels=fixtures.filter(p=>['speed','stop','give_way','parking','direction'].includes(p.kind));
  const keys=[...new Set(labels.map(p=>this.key(p)))];keys.forEach((key,i)=>this.glyphs.set(key,i));this.rows=Math.max(1,Math.ceil(keys.length/8));
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=this.rows*128;const ctx=canvas.getContext('2d')!;
  keys.forEach((key,i)=>{const [kind,...values]=key.split('|'),text=values.join('|'),x=i%8*256,y=Math.floor(i/8)*128;ctx.save();ctx.translate(x,y);drawSign(ctx,kind,text);ctx.restore();});
  this.signTexture=new T.CanvasTexture(canvas);this.signTexture.colorSpace=T.SRGBColorSpace;this.signTexture.anisotropy=2;
  const material=new T.MeshStandardMaterial({map:this.signTexture,roughness:.52,alphaTest:.2,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  material.onBeforeCompile=shader=>{shader.vertexShader='attribute vec4 instanceAtlas;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv=vMapUv*instanceAtlas.zw+instanceAtlas.xy;\n#endif');};
  material.customProgramCacheKey=()=> 'tirana-completion-signs-v1';
  const geo=new T.PlaneGeometry(1,1);geo.setAttribute('instanceAtlas',new T.InstancedBufferAttribute(new Float32Array(128*4),4));
  this.signs=new T.InstancedMesh(geo,material,128);this.signs.count=0;this.signs.frustumCulled=false;this.group.add(this.signs);
  this.lenses=new T.InstancedMesh(new T.CircleGeometry(.122,12),new T.MeshBasicMaterial({color:0xffffff}),96*3);this.lenses.count=0;this.lenses.frustumCulled=false;this.group.add(this.lenses);
  const paint=new T.MeshStandardMaterial({color:0xe7e7df,roughness:.95,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  this.white=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),paint,1000);this.white.count=0;this.white.frustumCulled=false;this.white.receiveShadow=true;this.group.add(this.white);
  const arrowCanvas=document.createElement('canvas');arrowCanvas.width=128;arrowCanvas.height=256;const ac=arrowCanvas.getContext('2d')!;ac.fillStyle='#f0eee4';ac.beginPath();ac.moveTo(64,8);ac.lineTo(114,90);ac.lineTo(79,81);ac.lineTo(79,242);ac.lineTo(49,242);ac.lineTo(49,81);ac.lineTo(14,90);ac.closePath();ac.fill();
  this.arrowTexture=new T.CanvasTexture(arrowCanvas);this.arrowTexture.colorSpace=T.SRGBColorSpace;
  this.arrows=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2).rotateY(Math.PI),new T.MeshStandardMaterial({map:this.arrowTexture,alphaTest:.4,roughness:.95,polygonOffset:true,polygonOffsetFactor:-3}),160);this.arrows.count=0;this.arrows.frustumCulled=false;this.arrows.receiveShadow=true;this.group.add(this.arrows);
  this.group.userData={source:data.source,trees:data.trees.length,fixtures:fixtures.length,parkingAreas:data.parking.length,accuracy:'Mapped locations; authored models and estimated bay layout. See source coverage report.'};
 }
 private key(p:Fixture){return p.kind+'|'+(p.text||'');}
 private matrix(x:number,y:number,z:number,yaw=0,sx=1,sy=1,sz=1){this.dummy.position.set(x,y,z);this.dummy.rotation.set(0,yaw,0);this.dummy.scale.set(sx,sy,sz);this.dummy.updateMatrix();return this.dummy.matrix;}
 update(seconds:number,viewer?:Point,battery=false){
  if(this.dead||!viewer)return;
  this.trees.update(seconds,viewer,battery);
  if(seconds>=this.last&&seconds-this.last<.25)return;this.last=seconds;
  const radius=battery?110:210;
  const mounted=new Set<string>();
  for(const [name,b] of this.batches){
   const points=b.near(viewer,radius,battery?Math.min(b.capacity,40):b.capacity);let n=0;
   for(const p of points){const scale=p.scale||1,m=this.matrix(p.x,p.y??.065,p.z,p.yaw||0,scale,scale,scale);for(const mesh of b.meshes)mesh.setMatrixAt(n,m);if(name!=='shrub')mounted.add((p as Fixture).id);n++;}
   for(const mesh of b.meshes){mesh.count=n;mesh.visible=n>0;mesh.castShadow=!battery&&name!=='shrub';mesh.instanceMatrix.needsUpdate=true;}
  }
  this.selected=this.fixtures(viewer,radius,battery?64:128).filter(p=>mounted.has(p.id));this.signs.count=0;this.lenses.count=0;
  const uv=this.signs.geometry.getAttribute('instanceAtlas') as T.InstancedBufferAttribute;
  for(const p of this.selected){
   const glyph=this.glyphs.get(this.key(p));
   if(glyph!==undefined){const n=this.signs.count++,large=p.kind==='direction',sx=large?3.22:.74,sy=large?1.12:.80;
    const m=this.matrix(p.x+Math.sin(p.yaw)*.041,p.y+(large?3.23:2.43),p.z+Math.cos(p.yaw)*.041,p.yaw,sx,sy,1);this.signs.setMatrixAt(n,m);uv.setXYZW(n,(glyph%8+(large?.01:.25))/8,1-(Math.floor(glyph/8)+.99)/this.rows,(large?.98:.5)/8,.98/this.rows);
   }
   if(p.kind==='traffic_signals'){
    // Shared cardinal phases with two all-red intervals. Presentation only;
    // existing gameplay SIGNALS retain their authoritative signal clock.
    const phase=((seconds%48)+48)%48,axis=Math.abs(Math.sin(p.yaw))>.707?1:0;
    const green=axis===0?phase<19:phase>=24&&phase<43,amber=axis===0?phase>=19&&phase<22:phase>=43&&phase<46,lit=green?2:amber?1:0;
    for(let k=0;k<3;k++){const n=this.lenses.count++;this.lenses.setMatrixAt(n,this.matrix(p.x+Math.sin(p.yaw)*.307,p.y+3.8-k*.35,p.z+Math.cos(p.yaw)*.307,p.yaw));this.lenses.setColorAt(n,this.color.setHex(k===lit?[0xff3628,0xffb62a,0x3ce486][k]:0x17231e));}
   }
  }
  this.signs.instanceMatrix.needsUpdate=true;uv.needsUpdate=true;this.lenses.instanceMatrix.needsUpdate=true;if(this.lenses.instanceColor)this.lenses.instanceColor.needsUpdate=true;
  this.white.count=0;for(const p of this.bays(viewer,radius,battery?90:240)){
   const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
   for(const [x,z,w,d] of [[-p.w/2,0,.10,p.d],[p.w/2,0,.10,p.d],[0,-p.d/2,p.w,.10],[0,p.d/2,p.w,.10]]){
    if(this.white.count>=1000)break;this.white.setMatrixAt(this.white.count++,this.matrix(p.x+c*x+s*z,.105,p.z-s*x+c*z,p.yaw,w,1,d));
   }
  }this.white.instanceMatrix.needsUpdate=true;
  this.arrows.count=0;for(const p of this.arrowPoints(viewer,radius,battery?55:160))this.arrows.setMatrixAt(this.arrows.count++,this.matrix(p.x,.111,p.z,p.yaw,1.1,1,3.5));this.arrows.instanceMatrix.needsUpdate=true;
  this.group.userData.visible={fixtures:this.selected.length,bays:this.white.count/4,arrows:this.arrows.count};
 }
 retire(){this.dead=true;this.trees.retire();}
 dispose(){if(this.disposed)return;this.disposed=true;this.retire();this.trees.dispose();for(const b of this.batches.values())for(const m of b.meshes)m.geometry.dispose();this.materials.forEach(m=>m.dispose());for(const m of [this.signs,this.lenses,this.white,this.arrows]){m.geometry.dispose();(m.material as T.Material).dispose();}this.signTexture.dispose();this.arrowTexture.dispose();this.group.clear();this.group.removeFromParent();}
}
function drawSign(c:CanvasRenderingContext2D,kind:string,text:string){
 c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
 if(kind==='direction'){c.fillStyle='#14518a';c.fillRect(2,2,252,124);c.strokeStyle='#e9f1f1';c.lineWidth=3;c.strokeRect(6,6,244,116);c.fillStyle='#fff';c.font='600 20px Arial';const lines=text.split(';').slice(0,3);lines.forEach((s,i)=>c.fillText(s,112,64+(i-(lines.length-1)/2)*30,192));c.font='32px Arial';c.fillText('↑',231,64);return;}
 // Standard symbol proportions are kept square within the wide atlas cell.
 c.translate(64,0);c.fillStyle='#f1f0e9';c.strokeStyle='#bf332c';c.lineWidth=10;
 if(kind==='stop'){c.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,x=64+58*Math.cos(a),y=64+58*Math.sin(a);if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.fillStyle='#bd3028';c.fill();c.strokeStyle='#f3eee8';c.lineWidth=3;c.stroke();c.fillStyle='#fff';c.font='bold 28px Arial';c.fillText('STOP',64,64);}
 else if(kind==='give_way'){c.beginPath();c.moveTo(10,12);c.lineTo(118,12);c.lineTo(64,112);c.closePath();c.fill();c.stroke();}
 else if(kind==='speed'){c.beginPath();c.arc(64,64,54,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#20272a';c.font='bold 47px Arial';c.fillText(text,64,65);}
 else{c.fillStyle='#165aa4';c.fillRect(10,8,108,112);c.strokeStyle='#fff';c.lineWidth=4;c.strokeRect(14,12,100,104);c.fillStyle='#fff';c.font='bold 82px Arial';c.fillText('P',64,66);}
}
