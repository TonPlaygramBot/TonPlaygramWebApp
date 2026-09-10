import * as T from 'three';
import {STREET_LIFE,type StreetLifeData} from './registry.mjs';
import {buildStreetModel,nearbyIndex} from './streetModels.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
type Point={x:number;z:number};
type Part={shape:string;color:number;p:number[];s:number[];pitch?:number};
type Sign={text:string;p:number[];s:number[];bg:string;fg:string;yaw:number;atlas?:number};
type Model=Point&{id:string;yaw:number;type:string;parts:Part[];signs:Sign[]};
type Data=Pick<StreetLifeData,'storefronts'|'stops'|'fuel'|'advertising'>;

/** Three geometry draws + one shared sign-atlas draw. No remote logos, one texture
 * per shop, async loaders, or thousands of scene nodes. Nearest objects win. */
export class StreetLifeLayer {
 readonly group=new T.Group();
 private disposed=false;private dead=false;private last=-Infinity;
 private near:(p:Point,r:number,n:number)=>Model[];
 private meshes=new Map<string,T.InstancedMesh>();
 private labels:T.InstancedMesh;private atlas:T.CanvasTexture;
 private dummy=new T.Object3D();private parent=new T.Object3D();private color=new T.Color();
 private columns=8;private rows=1;
 private material:T.MeshStandardMaterial;private glassMaterial:T.MeshStandardMaterial;private signMaterial:T.MeshStandardMaterial;
 constructor(data:Data=STREET_LIFE,options:StreetDetailOptions={}){
  this.group.name='Tirana:mapped-storefronts-stops-and-fuel';
  const blocked=options.track?ribbonExclusion(options.track):null;
  const models:Model[]=[];
  for(const [key,type] of [['storefronts','storefront'],['stops','stop'],['fuel','fuel'],['advertising','advertising']] as const)
   for(const s of data[key])if(!blocked||!blocked(s.x,s.z,Math.max(4,'width' in s?Number(s.width):0)))models.push(buildStreetModel(s,type));
  const signs:Sign[]=[],signIndex=new Map<string,number>();
  for(const sign of models.flatMap(m=>m.signs)){const key=JSON.stringify([sign.text,sign.bg,sign.fg]);if(!signIndex.has(key)){signIndex.set(key,signs.length);signs.push(sign);}sign.atlas=signIndex.get(key)!;}
  this.rows=Math.max(1,Math.ceil(signs.length/this.columns));
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=this.rows*48;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Street sign canvas unavailable');
  signs.forEach((s,i)=>{
   const x=(i%this.columns)*256,y=Math.floor(i/this.columns)*48;
   ctx.fillStyle=s.bg;ctx.fillRect(x,y,256,48);ctx.fillStyle=s.fg;
   ctx.font='600 27px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.text,x+128,y+24,240);
   if(s.text==='TIRANË'){ctx.globalAlpha=.16;for(let k=0;k<8;k++)ctx.fillRect(x+k*32,y+35,18,13);ctx.globalAlpha=1;}
  });
  this.atlas=new T.CanvasTexture(canvas);this.atlas.colorSpace=T.SRGBColorSpace;this.atlas.anisotropy=2;
  this.material=new T.MeshStandardMaterial({color:0xffffff,roughness:.66,metalness:.15});
  this.glassMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.23,metalness:.48});
  // 96 selected models x a tested maximum of 70 parts, with independent budgets.
  for(const [shape,geo] of [['box',new T.BoxGeometry(1,1,1)],['glass',new T.BoxGeometry(1,1,1)],['cylinder',new T.CylinderGeometry(1,1,1,8)]] as const){
   const mesh=new T.InstancedMesh(geo,shape==='glass'?this.glassMaterial:this.material,6720);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.meshes.set(shape,mesh);this.group.add(mesh);
  }
  this.signMaterial=new T.MeshStandardMaterial({map:this.atlas,roughness:.7,emissiveMap:this.atlas,emissive:0xffffff,emissiveIntensity:.07});
  this.signMaterial.onBeforeCompile=shader=>{
   shader.vertexShader='attribute vec4 instanceAtlas;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv=vMapUv*instanceAtlas.zw+instanceAtlas.xy;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv=vEmissiveMapUv*instanceAtlas.zw+instanceAtlas.xy;\n#endif');
  };
  this.signMaterial.customProgramCacheKey=()=> 'tirana-street-atlas-v1';
  const geometry=new T.PlaneGeometry(1,1);geometry.setAttribute('instanceAtlas',new T.InstancedBufferAttribute(new Float32Array(384*4),4).setUsage(T.DynamicDrawUsage));
  this.labels=new T.InstancedMesh(geometry,this.signMaterial,384);this.labels.count=0;this.labels.frustumCulled=false;this.labels.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(this.labels);
  this.near=nearbyIndex(models);this.group.userData={storefronts:data.storefronts.length,stops:data.stops.length,fuel:data.fuel.length,accuracy:'OSM locations and names; original approximate exteriors. Advertising locations authored.'};
 }
 update(seconds:number,viewer?:Point,battery=false,force=false){
  if(this.dead||!viewer||(!force&&seconds-this.last<.2))return;this.last=seconds;
  const selected=this.near(viewer,battery?100:185,battery?40:96);
  this.meshes.forEach(m=>m.count=0);this.labels.count=0;
  const uv=this.labels.geometry.getAttribute('instanceAtlas') as T.InstancedBufferAttribute;
  for(const model of selected){
   this.parent.position.set(model.x,.12,model.z);this.parent.rotation.set(0,model.yaw,0);this.parent.updateMatrix();
   for(const p of model.parts){
    const mesh=this.meshes.get(p.shape)!;if(mesh.count>=mesh.instanceMatrix.count)continue;
    this.dummy.position.fromArray(p.p);this.dummy.scale.fromArray(p.s);this.dummy.rotation.set(p.pitch||0,0,0);this.dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count,this.dummy.matrix.premultiply(this.parent.matrix));mesh.setColorAt(mesh.count++,this.color.setHex(p.color));
   }
   for(const s of model.signs){
    if(this.labels.count>=384)break;const n=this.labels.count++,a=s.atlas!;
    this.dummy.position.fromArray(s.p);this.dummy.scale.fromArray(s.s);this.dummy.rotation.set(0,s.yaw,0);this.dummy.updateMatrix();
    this.labels.setMatrixAt(n,this.dummy.matrix.premultiply(this.parent.matrix));uv.setXYZW(n,(a%this.columns+.025)/this.columns,1-(Math.floor(a/this.columns)+.97)/this.rows,.95/this.columns,.94/this.rows);
   }
  }
  this.meshes.forEach(m=>{m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;});this.labels.instanceMatrix.needsUpdate=true;uv.needsUpdate=true;
 }
 retire(){this.dead=true;}
 dispose(){if(this.disposed)return;this.disposed=true;this.dead=true;this.group.removeFromParent();this.meshes.forEach(m=>m.geometry.dispose());this.labels.geometry.dispose();this.material.dispose();this.glassMaterial.dispose();this.signMaterial.dispose();this.atlas.dispose();this.group.clear();}
}
