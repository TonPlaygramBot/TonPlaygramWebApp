import {pointInUrbanBounds} from '../tiranastreets/shared/urbanBounds.mjs';
import {groundHeight} from '../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {signReferenceFor,referencedAdvertising,SIGN_REFERENCES} from './signReferences.mjs';
import {loadBrandArtwork} from './brandArtworkCache';
import {STREET_LIFE,type StreetLifeData} from './registry.mjs';
import {buildStreetModel,nearbyIndex} from './streetModels.mjs';
import {boulevardStorefronts} from './boulevardBusinesses.mjs';
import {storefrontBoard} from './verifiedStorefrontBoards.mjs';
import {mappedBusinessFascia,fasciaAtlasLayout} from './mappedBusinessFascia.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
type Point={x:number;z:number};
type Part={shape:string;color:number;p:number[];s:number[];pitch?:number};
type Sign={text:string;p:number[];s:number[];bg:string;fg:string;yaw:number;atlas?:number;brand?:string;caption?:string;plain?:boolean;frontage?:boolean};
type Model=Point&{id:string;yaw:number;type:string;parts:Part[];signs:Sign[]};
type Data=Pick<StreetLifeData,'storefronts'|'stops'|'fuel'|'advertising'>;

/** Three standard geometry draws, one optional parasol batch and a sign-atlas draw. Packaged brand artwork
 * updates the shared atlas asynchronously. Nearest objects win. */
export class StreetLifeLayer {
 readonly group=new T.Group();
 private disposed=false;private dead=false;private last=-Infinity;
 private near:(p:Point,r:number,n:number)=>Model[];
 private meshes=new Map<string,T.InstancedMesh>();
 private labels:T.InstancedMesh;private atlas:T.CanvasTexture;
 private dummy=new T.Object3D();private parent=new T.Object3D();private color=new T.Color();
 private columns=8;private rows=1;
 private brandRequests=new Map<string,()=>void>();private requestedBrands=new Set<string>();
 private material:T.MeshStandardMaterial;private glassMaterial:T.MeshStandardMaterial;private signMaterial:T.MeshStandardMaterial;
 constructor(data:Data=STREET_LIFE,options:StreetDetailOptions={},private labelsOnly=false,tradesOnly=false){
  this.group.name='Tirana:mapped-storefronts-stops-and-fuel';
  const blocked=options.track?ribbonExclusion(options.track):null;
  const models:Model[]=[];
  // Keep the source registry immutable; only the one shared full renderer
  // mounts the reviewed public façade/terrace interpretations.
  const stores=data===STREET_LIFE?boulevardStorefronts(data.storefronts):data.storefronts;
  for(const [key,type] of [['storefronts','storefront'],['stops','stop'],['fuel','fuel'],['advertising','advertising']] as const)
   for(const s of key==='storefronts'?stores:data[key]){
    if(!pointInUrbanBounds(s,4)||(blocked&&blocked(s.x,s.z,Math.max(4,'width' in s?Number(s.width):0))))continue;
    const model=buildStreetModel(type==='advertising'?referencedAdvertising(s,data.storefronts):s,tradesOnly&&type==='storefront'?'store-detail':type);
    if(this.labelsOnly){
     // The neighbourhood renderer keeps its existing fascia and trade models.
     for(const sign of model.signs)sign.p[2]=Math.max(.238,sign.p[2]);
     model.parts=[];
    }
    if(type==='storefront'&&!tradesOnly){
     for(const face of model.signs)Object.assign(face,mappedBusinessFascia(s,face));
     const board=storefrontBoard(s);
     if(board){model.parts.push(...board.parts);model.signs.push(...board.signs);}
    }
    models.push(model);
   }
  const signs:Sign[]=[],signIndex=new Map<string,number>();
  for(const sign of models.flatMap(m=>m.signs)){sign.brand=sign.plain?undefined:signReferenceFor(sign.text)?.id;const key=JSON.stringify([sign.text,sign.caption,sign.plain,sign.frontage,sign.bg,sign.fg,Math.round(sign.s[0]/sign.s[1]*10)]);if(!signIndex.has(key)){signIndex.set(key,signs.length);signs.push(sign);}sign.atlas=signIndex.get(key)!;}
  // The full neighbourhood has more than 1,300 unique boards: eight columns
  // exceeded 4096 pixels vertically and could disappear on mobile GPUs.
  const {columns,rows,cellHeight}=fasciaAtlasLayout(signs.length);
  this.columns=columns;this.rows=rows;
  const canvas=document.createElement('canvas');canvas.width=this.columns*256;canvas.height=this.rows*cellHeight;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Street sign canvas unavailable');
  ctx.scale(1,cellHeight/48);
  signs.forEach((s,i)=>{
   const x=(i%this.columns)*256,y=Math.floor(i/this.columns)*48;
   ctx.fillStyle=s.bg;ctx.fillRect(x,y,256,48);ctx.fillStyle=s.fg;
   ctx.font='600 27px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
   if(s.caption){
    // Canvas cells are wide for fascia. Correct the narrow projecting plate's
    // aspect in texture space rather than stretching the finished typography.
    const xScale=(256/48)/(s.s[0]/s.s[1]),maxWidth=230/xScale;
    ctx.save();ctx.translate(x+128,y);ctx.scale(xScale,1);
    const words=s.text.split(' ');
    if(!s.frontage&&s.text.length>9&&words.length>1){
     const split=Math.ceil(words.length/2);ctx.font='bold 12px Arial';
     ctx.fillText(words.slice(0,split).join(' '),0,12,maxWidth);ctx.fillText(words.slice(split).join(' '),0,25,maxWidth);
    }else{
     ctx.font='bold 23px Arial';
     const measured=ctx.measureText(s.text).width;
     if(measured>maxWidth)ctx.font=`bold ${Math.max(10,23*maxWidth/measured)}px Arial`;
     ctx.fillText(s.text,0,19,maxWidth);
    }
    ctx.font='bold 9px Arial';ctx.fillText(s.caption,0,38,maxWidth);ctx.restore();
   }else ctx.fillText(s.text,x+128,y+24,240);
   if(s.text==='TIRANË'){ctx.globalAlpha=.16;for(let k=0;k<8;k++)ctx.fillRect(x+k*32,y+35,18,13);ctx.globalAlpha=1;}
  });
  this.atlas=new T.CanvasTexture(canvas);this.atlas.colorSpace=T.SRGBColorSpace;this.atlas.anisotropy=2;
  const usedBrands=new Set(signs.map(s=>s.brand).filter(Boolean));
  for(const reference of SIGN_REFERENCES.filter(r=>usedBrands.has(r.id))){
   this.brandRequests.set(reference.id,()=>{void loadBrandArtwork(reference.logo).then(image=>{
    if(this.dead||!image)return;
    signs.forEach((sign,i)=>{
     if(sign.brand!==reference.id)return;
     const x=(i%this.columns)*256,y=Math.floor(i/this.columns)*48;
     ctx.fillStyle=reference.background;ctx.fillRect(x,y,256,48);
     const [sx,sy,sw,sh]=reference.crop??[0,0,image.naturalWidth,image.naturalHeight];
     if(!sw||!sh)return;
     const physicalRatio=sign.s[0]/sign.s[1],ratio=(sw/sh)*256/48/physicalRatio;
     const h=Math.min(40,232/ratio),w=h*ratio;
     if('keepName' in reference&&reference.keepName){
      const iw=Math.min(48,w);ctx.drawImage(image,sx,sy,sw,sh,x+10,y+4,iw,40);ctx.fillStyle=reference.foreground;ctx.font='bold 24px Arial';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(sign.text,x+68,y+24,178);
     }else ctx.drawImage(image,sx,sy,sw,sh,x+(256-w)/2,y+(48-h)/2,w,h);
    });
    this.atlas.needsUpdate=true;
   });});
  }
  this.material=new T.MeshStandardMaterial({color:0xffffff,roughness:.66,metalness:.15});
  this.glassMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.12,metalness:.18,transparent:true,opacity:.43,depthWrite:false});
  this.glassMaterial.userData.environmentLight='business';
  this.glassMaterial.userData.nightIntensity=.42;
  // 96 selected models x a tested maximum of 70 parts, with independent budgets.
  for(const shape of this.labelsOnly?(models.some(m=>m.parts.length>0)?['box']:[]):['box','glass','cylinder',...(models.some(model=>model.parts.some(p=>p.shape==='cone'))?['cone']:[])]){
   const geo=shape==='cylinder'?new T.CylinderGeometry(1,1,1,8):shape==='cone'?new T.ConeGeometry(1,1,8):new T.BoxGeometry(1,1,1);
   const mesh=new T.InstancedMesh(geo,shape==='glass'?this.glassMaterial:this.material,this.labelsOnly?48:6720);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.meshes.set(shape,mesh);this.group.add(mesh);
  }
  this.signMaterial=new T.MeshStandardMaterial({map:this.atlas,roughness:.7,emissiveMap:this.atlas,emissive:0xffffff,emissiveIntensity:.18,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  this.signMaterial.userData.environmentLight='business';
  this.signMaterial.userData.nightIntensity=1.4;
  this.signMaterial.onBeforeCompile=shader=>{
   shader.vertexShader='attribute vec4 instanceAtlas;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv=vMapUv*instanceAtlas.zw+instanceAtlas.xy;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv=vEmissiveMapUv*instanceAtlas.zw+instanceAtlas.xy;\n#endif');
  };
  this.signMaterial.customProgramCacheKey=()=> 'tirana-street-atlas-v1';
  const geometry=new T.PlaneGeometry(1,1);geometry.setAttribute('instanceAtlas',new T.InstancedBufferAttribute(new Float32Array(384*4),4).setUsage(T.DynamicDrawUsage));
  this.labels=new T.InstancedMesh(geometry,this.signMaterial,384);this.labels.count=0;this.labels.frustumCulled=false;this.labels.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(this.labels);
  this.near=nearbyIndex(models);this.group.userData={storefronts:stores.length,stops:data.stops.length,fuel:data.fuel.length,accuracy:'OSM locations and names; original approximate exteriors. Advertising locations authored.'};
 }
 update(seconds:number,viewer?:Point,battery=false,force=false){
  if(this.dead||!viewer||(!force&&seconds-this.last<.2))return;this.last=seconds;
  const selected=this.near(viewer,battery?100:185,this.labelsOnly?(battery?24:48):(battery?40:96));
  this.meshes.forEach(m=>m.count=0);this.labels.count=0;
  const uv=this.labels.geometry.getAttribute('instanceAtlas') as T.InstancedBufferAttribute;
  for(const model of selected){
   this.parent.position.set(model.x,groundHeight(model.x,model.z)+.12,model.z);this.parent.rotation.set(0,model.yaw,0);this.parent.updateMatrix();
   for(const p of model.parts){
    const mesh=this.meshes.get(p.shape)!;if(mesh.count>=mesh.instanceMatrix.count)continue;
    this.dummy.position.fromArray(p.p);this.dummy.scale.fromArray(p.s);this.dummy.rotation.set(p.pitch||0,0,0);this.dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count,this.dummy.matrix.premultiply(this.parent.matrix));mesh.setColorAt(mesh.count++,this.color.setHex(p.color));
   }
   for(const s of model.signs){
    if(s.brand&&!this.requestedBrands.has(s.brand)){this.requestedBrands.add(s.brand);this.brandRequests.get(s.brand)?.();}
    if(this.labels.count>=384)break;const n=this.labels.count++,a=s.atlas!;
    this.dummy.position.fromArray(s.p);this.dummy.scale.fromArray(s.s);this.dummy.rotation.set(0,s.yaw,0);this.dummy.updateMatrix();
    this.labels.setMatrixAt(n,this.dummy.matrix.premultiply(this.parent.matrix));uv.setXYZW(n,(a%this.columns+.025)/this.columns,1-(Math.floor(a/this.columns)+.97)/this.rows,.95/this.columns,.94/this.rows);
   }
  }
  this.meshes.forEach(m=>{m.visible=m.count>0;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;});this.labels.instanceMatrix.needsUpdate=true;uv.needsUpdate=true;
 }
 retire(){this.dead=true;}
 dispose(){if(this.disposed)return;this.disposed=true;this.dead=true;this.brandRequests.clear();this.requestedBrands.clear();this.group.removeFromParent();this.meshes.forEach(m=>m.geometry.dispose());this.labels.geometry.dispose();this.material.dispose();this.glassMaterial.dispose();this.signMaterial.dispose();this.atlas.dispose();this.group.clear();}
}
