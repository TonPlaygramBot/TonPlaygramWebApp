import * as T from 'three';
import type {WheelRigLayout} from '../../src/games/tiranastreets/rollingWheels';
type WheelSpec = {center:T.Vector3; radius:number; halfWidth:number; axis:T.Vector3};
type Component = {mesh:T.Mesh; indices:number[]; triangles:number[]; bounds:T.Box3};
function components(mesh:T.Mesh,root:T.Object3D):Component[]{
 const geometry=mesh.geometry,position=geometry.getAttribute('position');
 if(!position||mesh instanceof T.SkinnedMesh)return[];
 const index=geometry.index,count=index?.count??position.count,parent=new Int32Array(position.count),weld=new Map<string,number>();
 const point=new T.Vector3();
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i);
  const key=`${Math.round(point.x*1e5)},${Math.round(point.y*1e5)},${Math.round(point.z*1e5)}`,known=weld.get(key);
  parent[i]=known??i;if(known===undefined)weld.set(key,i);
 }
 const find=(i:number):number=>{let p=i;while(parent[p]!==p)p=parent[p];while(parent[i]!==i){const next=parent[i];parent[i]=p;i=next;}return p;};
 const vertex=(i:number)=>index?index.getX(i):i;
 for(let i=0;i<count;i+=3){const a=find(vertex(i)),b=find(vertex(i+1)),c=find(vertex(i+2));parent[b]=a;parent[c]=a;}
 const grouped=new Map<number,Component>(),matrix=new T.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
 for(let i=0;i<count;i+=3){
  const key=find(vertex(i));let part=grouped.get(key);
  if(!part){part={mesh,indices:[],triangles:[],bounds:new T.Box3()};grouped.set(key,part);}
  part.triangles.push(i/3);
  for(let k=0;k<3;k++){const n=vertex(i+k);part.indices.push(n);part.bounds.expandByPoint(point.fromBufferAttribute(position,n).applyMatrix4(matrix));}
 }
 return [...grouped.values()];
}

function fitsWheel(root:T.Object3D,part:Component,wheel:WheelSpec){
 const matrix=new T.Matrix4().copy(root.matrixWorld).invert().multiply(part.mesh.matrixWorld),point=new T.Vector3();
 const position=part.mesh.geometry.getAttribute('position'),r2=(wheel.radius+.008)**2;
 for(const i of part.indices){
  point.fromBufferAttribute(position,i).applyMatrix4(matrix).sub(wheel.center);
  const depth=point.dot(wheel.axis);
  if(Math.abs(depth)>wheel.halfWidth+.02||point.lengthSq()-depth*depth>r2)return false;
 }
 return true;
}
function tireDimensions(root:T.Object3D,part:Component,center:T.Vector3):WheelSpec{
 const matrix=new T.Matrix4().copy(root.matrixWorld).invert().multiply(part.mesh.matrixWorld),point=new T.Vector3();
 const position=part.mesh.geometry.getAttribute('position'),unique=new Set(part.indices);let xx=0,xz=0,zz=0;
 for(const i of unique){point.fromBufferAttribute(position,i).applyMatrix4(matrix).sub(center);xx+=point.x*point.x;xz+=point.x*point.z;zz+=point.z*point.z;}
 // A few original front wheels have steering baked into their vertices. Find
 // their actual horizontal axle, so they roll without wobbling about world Z.
 const theta=.5*Math.atan2(2*xz,xx-zz),axis=new T.Vector3(Math.sin(theta),0,-Math.cos(theta));
 let radius=0,halfWidth=0;
 for(const i of unique){point.fromBufferAttribute(position,i).applyMatrix4(matrix).sub(center);const depth=point.dot(axis);halfWidth=Math.max(halfWidth,Math.abs(depth));radius=Math.max(radius,Math.sqrt(Math.max(0,point.lengthSq()-depth*depth)));}
 return {center,radius,halfWidth,axis};
}

export function analyzeWheelRig(root:T.Object3D,kind:'bike'|'collection'):WheelRigLayout{
 root.updateMatrixWorld(true);const all:Component[]=[],wheels:WheelSpec[]=[];
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;
  if(kind==='bike'&&/^wheel-(front|rear)$/.test(o.name)){
   const bounds=new T.Box3().setFromObject(o),center=root.worldToLocal(bounds.getCenter(new T.Vector3())),size=bounds.getSize(new T.Vector3());
   wheels.push({center,radius:size.y/2,halfWidth:Math.max(.045,size.x/2),axis:new T.Vector3(1,0,0)});
  }
  if(kind==='collection'||/^(wheel-|Rim|Spoke|Grip)/.test(o.name))all.push(...components(o,root));
 });
 if(kind==='collection')for(const part of all){
  const b=part.bounds,size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
  if(b.min.y>.035||b.min.y<-.04||size.y<.42||size.y>1.15||size.x/size.y<.90||size.x/size.y>1.1||size.z>size.y*.7||size.z<.08||Math.abs(center.z)<.45||Math.abs(center.x)<.45)continue;
  if(!wheels.some(w=>Math.hypot(w.center.x-center.x,w.center.z-center.z)<.2))wheels.push(tireDimensions(root,part,center));
 }
 const expected=kind==='bike'?2:4;
 if(wheels.length!==expected)throw Error(`Expected ${expected} tire surfaces; found ${wheels.length}`);
 wheels.sort((a,b)=>a.center.x-b.center.x||a.center.z-b.center.z);
 const assigned=new Map<T.Mesh,Int8Array>();
 for(const part of all){
  let destinations=assigned.get(part.mesh);if(!destinations){destinations=new Int8Array((part.mesh.geometry.index?.count??part.mesh.geometry.getAttribute('position').count)/3).fill(-1);assigned.set(part.mesh,destinations);}
  const materials=Array.isArray(part.mesh.material)?part.mesh.material:[part.mesh.material];
  if(materials.some(m=>/caliper|calliper|frein/i.test(m.name)))continue;
  const id=wheels.findIndex(w=>fitsWheel(root,part,w));
  for(const triangle of part.triangles)destinations[triangle]=id;
 }
 const meshes:WheelRigLayout['meshes']={};
 for(const [mesh,destinations]of assigned){
  if(!destinations.some(id=>id>=0))continue;
  const runs:number[][]=[];
  for(let i=0;i<destinations.length;){const start=i,id=destinations[i];while(i<destinations.length&&destinations[i]===id)i++;runs.push([start,i-start,id]);}
  meshes[mesh.name]={triangles:destinations.length,runs};
 }
 return {axis:kind==='bike'?[1,0,0]:[0,0,-1],wheels:wheels.map(w=>({center:w.center.toArray(),radius:w.radius,axis:w.axis.toArray()})),meshes};
}
