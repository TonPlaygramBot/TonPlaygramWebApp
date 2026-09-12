import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CANOPY_TREES} from './canopyRegistry.mjs';
import {nearbyIndex} from './streetModels.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
type Tree={id:string;x:number;z:number;shape:string;height:number;crown:number;seed:number;zone:string};
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
type Batch={shape:string;lod:number;wood:T.InstancedMesh;leaves:T.InstancedMesh};

/** Mapped trunks with separate height/crown scaling: tall street trees do not
 * become oversized spherical bushes. Every replaced source ID has one owner. */
export class MatureTreeLayer {
 readonly group=new T.Group();private disposed=false;private dead=false;private last=-Infinity;
 private batches:Batch[]=[];private materials:T.Material[]=[];private texture:T.CanvasTexture;
 private near:(p:{x:number;z:number},r:number,n:number)=>Tree[];
 private dummy=new T.Object3D();private color=new T.Color();
 private viewer={x:Infinity,z:Infinity};private battery?:boolean;
 constructor(trees:Tree[]=CANOPY_TREES,options:StreetDetailOptions={}){
  this.group.name='Tirana:mature-boulevard-and-square-trees';
  const blocked=options.track?ribbonExclusion(options.track):null;
  const eligible=trees.filter(t=>!blocked||!blocked(t.x,t.z,Math.max(.8,t.crown*.75)));this.near=nearbyIndex(eligible);
  this.group.userData={mappedTrunks:eligible.filter(t=>t.zone!=='estimated-area-canopy').length,estimatedAreaTrunks:eligible.filter(t=>t.zone==='estimated-area-canopy').length,accuracy:'Mapped trunks, interpolated rows and estimated canopy within mapped green spaces; not satellite verified'};
  // Original clustered leaf cutout. Repeated small cards leave daylight gaps;
  // opacity is tested instead of sorted transparency on mobile.
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d')!;
  for(let i=0;i<48;i++){
   const x=16+hash(i*5+1)*96,y=16+hash(i*5+2)*96;
   ctx.fillStyle=`rgb(${125+Math.floor(hash(i)*85)},${146+Math.floor(hash(i)*80)},${98+Math.floor(hash(i)*76)})`;
   ctx.beginPath();ctx.ellipse(x,y,4+hash(i+9)*6,2+hash(i+4)*3,hash(i+8)*Math.PI,0,Math.PI*2);ctx.fill();
  }
  this.texture=new T.CanvasTexture(canvas);this.texture.colorSpace=T.SRGBColorSpace;
  const wood=new T.MeshStandardMaterial({color:0x8b8170,roughness:1});
  const leafNear=new T.MeshStandardMaterial({map:this.texture,color:0x71815b,roughness:.94,alphaTest:.45,side:T.DoubleSide});
  const leafFar=new T.MeshStandardMaterial({color:0x526945,roughness:1,flatShading:true});this.materials.push(wood,leafNear,leafFar);
  for(const shape of ['upright','umbrella','column','garden'])for(const lod of [0,1,2]){
   const detail=lod===0,geometry=lod===2?distantTreeGeometry(shape):treeGeometry(shape,detail),capacity=lod===0?64:lod===1?384:6000;
   const trunk=new T.InstancedMesh(geometry.wood,wood,capacity),leaves=new T.InstancedMesh(geometry.leaves,detail?leafNear:leafFar,capacity);
   for(const mesh of [trunk,leaves]){mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=detail;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);}
   this.batches.push({shape,lod,wood:trunk,leaves});
  }
 }
 update(seconds:number,viewer?:{x:number;z:number},battery=false,force=false){
  if(this.dead||!viewer)return;
  if(!force&&this.battery===battery&&seconds>=this.last&&(seconds-this.last<.2||Math.hypot(viewer.x-this.viewer.x,viewer.z-this.viewer.z)<12))return;
  this.last=seconds;this.viewer={x:viewer.x,z:viewer.z};this.battery=battery;
  const trees=this.near(viewer,battery?850:1400,battery?2600:6000);let detailed=0,medium=0;
  this.batches.forEach(b=>{b.wood.count=0;b.leaves.count=0;});
  for(const t of trees){
   const distance=Math.hypot(t.x-viewer.x,t.z-viewer.z);
   const lod=!battery&&distance<65&&detailed<64?0:distance<(battery?120:240)&&medium<384?1:2;
   if(lod===0)detailed++;if(lod===1)medium++;
   const b=this.batches.find(b=>b.shape===t.shape&&b.lod===lod)??this.batches.find(b=>b.shape==='upright'&&b.lod===lod)!;
   if(b.wood.count>=b.wood.instanceMatrix.count)continue;
   this.dummy.position.set(t.x,.12,t.z);this.dummy.scale.set(t.crown,t.height,t.crown);this.dummy.rotation.set(0,t.seed*2.399,0);this.dummy.updateMatrix();
   b.wood.setMatrixAt(b.wood.count++,this.dummy.matrix);b.leaves.setMatrixAt(b.leaves.count,this.dummy.matrix);
   this.color.setHSL(.235+(t.seed%5)*.008,.2+(t.seed%4)*.02,.62+(t.seed%6)*.025);b.leaves.setColorAt(b.leaves.count++,this.color);
  }
  this.group.userData.visibleTrunks=trees.length;this.group.userData.radius=battery?850:1400;
  this.batches.forEach(b=>{b.wood.instanceMatrix.needsUpdate=true;b.leaves.instanceMatrix.needsUpdate=true;if(b.leaves.instanceColor)b.leaves.instanceColor.needsUpdate=true;});
 }
 retire(){this.dead=true;}
 dispose(){if(this.disposed)return;this.disposed=true;this.dead=true;this.group.removeFromParent();this.batches.forEach(b=>{b.wood.dispose();b.leaves.dispose();b.wood.geometry.dispose();b.leaves.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.texture.dispose();this.group.clear();}
}

function treeGeometry(shape:string,detail:boolean){
 const wood:T.BufferGeometry[]=[],leaves:T.BufferGeometry[]=[];
 const umbrella=shape==='umbrella',column=shape==='column',garden=shape==='garden';
 const trunkTop=umbrella?.77:column?.8:garden?.49:.64;
 const line=(a:number[],b:number[],r1:number,r2:number)=>{
  const start=new T.Vector3().fromArray(a),end=new T.Vector3().fromArray(b),direction=end.clone().sub(start);
  const geo=new T.CylinderGeometry(r2,r1,direction.length(),detail?7:5,1);
  geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize()));geo.translate(...start.add(end).multiplyScalar(.5).toArray() as [number,number,number]);wood.push(geo);
 };
 line([0,0,0],[.018,trunkTop*.53,-.025],.045,.03);line([.018,trunkTop*.53,-.025],[.065,trunkTop,.015],.03,.011);
 const clusters=umbrella?12:column?14:garden?13:17;
 for(let i=0;i<clusters;i++){
  const a=i*2.399,spread=column?.17:umbrella?.34:.24;
  const radial=spread*(.55+hash(i+20)*.6),x=Math.cos(a)*radial,z=Math.sin(a)*radial;
  const y=umbrella?.81+hash(i+31)*.1:column?.35+i/clusters*.57:garden?.46+hash(i+31)*.4:.43+i/clusters*.49;
  line([.025,trunkTop*.62,0],[x*.8,y-.04,z*.8],.012,.003);
  const rx=column?.19:umbrella?.22:.23,ry=umbrella?.09:column?.11:.18;
  if(detail){
   for(let j=0;j<18;j++){
    const theta=hash(i*81+j*3)*Math.PI*2,sy=hash(i*57+j*7)*2-1,sr=Math.sqrt(1-sy*sy),rr=.45+hash(i*45+j)*.55;
    const g=new T.PlaneGeometry(rx*.77,ry*.8);g.rotateX(hash(i*23+j)*Math.PI);g.rotateY(theta);g.rotateZ(hash(j*19+i)*Math.PI);
    g.translate(x+Math.cos(theta)*rx*rr*sr,y+sy*ry*rr,z+Math.sin(theta)*rx*rr*sr);leaves.push(g);
   }
  }else{
   const g=new T.IcosahedronGeometry(1,0);g.scale(rx,ry,rx*.86);g.translate(x,y,z);leaves.push(g);
  }
 }
 const merge=(geos:T.BufferGeometry[])=>{const out=mergeGeometries(geos)!;geos.forEach(g=>g.dispose());return out;};
 return {wood:merge(wood),leaves:merge(leaves)};
}

/** 30 triangles per distant tree instead of hundreds of crown/branch triangles. */
function distantTreeGeometry(shape:string){
 const column=shape==='column',umbrella=shape==='umbrella';
 const wood=new T.CylinderGeometry(.018,.035,.62,5).translate(0,.31,0);
 const leaves=new T.IcosahedronGeometry(1,0).scale(column?.2:.48,umbrella?.13:.32,column?.2:.43).translate(0,umbrella?.84:.7,0);
 return {wood,leaves};
}
