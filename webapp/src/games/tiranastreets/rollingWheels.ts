import * as T from 'three';
import layouts from './shared/rollingWheelRigs.mjs';
export type WheelRigLayout={axis:number[];wheels:{center:number[];radius:number;axis?:number[]}[];meshes:Record<string,{triangles:number;runs:number[][]}>};

export type RollingWheel = {pivot:T.Object3D; axis:T.Vector3; rest:T.Quaternion; angle:number; radius:number;steer?:T.Object3D};
const tau=Math.PI*2;

/** Wheels turn about an axle through the hub, in the asset's frame. Imported
 * cylinders have different local axes; rotating each mesh's Euler Z tilts the
 * tire and leaves merged spokes, rims and bolts behind. This also keeps reverse
 * travel correct without special cases for mirrored left/right wheels. */
export function collectRollingWheels(root:T.Object3D):RollingWheel[]{
 const wheels:RollingWheel[]=[];
 root.traverse(pivot=>{const rig=pivot.userData.rollingWheel;if(rig)wheels.push({pivot,axis:new T.Vector3().fromArray(rig.axis),radius:rig.radius,rest:pivot.quaternion.clone(),angle:0,steer:rig.front?pivot.parent??undefined:undefined});});
 return wheels;
}
export function rollWheels(wheels:readonly RollingWheel[],speed:number,dt:number){
 if(!Number.isFinite(speed)||!Number.isFinite(dt)||dt<=0)return;
 for(const wheel of wheels){
  wheel.angle=(wheel.angle+speed*dt/wheel.radius)%tau;
  wheel.pivot.quaternion.setFromAxisAngle(wheel.axis,wheel.angle).multiply(wheel.rest);
 }
}

/** Keep already authored centered pivots (force vehicles) and their steering
 * hierarchy. Their +X nose means the rolling angular velocity points along -Z. */
export function authoredRollingWheels(root:T.Object3D,radius:number):RollingWheel[]{
 const result:RollingWheel[]=[];
 root.traverse(pivot=>{if(/^Wheel_/.test(pivot.name))result.push({pivot,axis:new T.Vector3(0,0,-1),radius,rest:pivot.quaternion.clone(),angle:0});});
 return result;
}

/** The remaining Kenney fallback police/SUV models already have centered
 * +X axles. Match only their four road wheels: their rear spare and cockpit
 * steering wheel must never receive the tire animation. */
export function prepareLegacyWheels(root:T.Object3D){
 root.updateMatrixWorld(true);const tires:T.Object3D[]=[];
 root.traverse(o=>{if(/^wheel-(front|back)-(left|right)$/.test(o.name))tires.push(o);});
 for(const tire of tires){
  const parent=tire.parent!,center=tire.position.clone(),radius=new T.Box3().setFromObject(tire).getSize(new T.Vector3()).y/2;
  const steer=new T.Group(),pivot=new T.Group();steer.name=`Steering-${tire.name}`;steer.position.copy(center);parent.add(steer);steer.add(pivot);pivot.name=`Rolling-${tire.name}`;
  pivot.userData.rollingWheel={axis:[1,0,0],radius,front:tire.name.includes('front')};root.updateMatrixWorld(true);pivot.attach(tire);
 }
 return collectRollingWheels(root);
}

/** The bus GLB exports tire, rim and eight bolts as sibling meshes. Reparent
 * these once to one axle pivot, preserving the articulated rear parent. */
export function prepareBusWheels(root:T.Object3D){
 root.updateMatrixWorld(true);
 const tires:T.Mesh[]=[],parts:T.Object3D[]=[];
 root.traverse(o=>{if(o instanceof T.Mesh&&/^Wheel(?:\d|[._]|$)/.test(o.name)&&!/^Wheel(?:_|\s)?(?:hub|bolt)/i.test(o.name))tires.push(o);if(/^Wheel/.test(o.name))parts.push(o);});
 for(const tire of tires){
  const parent=tire.parent!,center=tire.position.clone(),pivot=new T.Group();
  pivot.name=`Rolling-${tire.name}`;pivot.position.copy(center);
  pivot.userData.rollingWheel={axis:[-1,0,0],radius:.51};parent.add(pivot);pivot.updateMatrixWorld(true);
  for(const part of parts){
   if(part.parent!==parent||Math.abs(part.position.z-center.z)>.24||Math.abs(part.position.y-center.y)>.24||Math.abs(part.position.x-center.x)>.24)continue;
   pivot.attach(part);
  }
 }
}

/** Compact an index partition without changing UVs, normals, colors or any
 * source triangle. Keeping only referenced vertices avoids duplicating the
 * complete car's buffers for each wheel. Instances then share these geometries. */
function geometryPart(source:T.BufferGeometry,indices:number[]){
 const remap=new Map<number,number>(),vertices:number[]=[],out:number[]=[];
 for(const index of indices){let local=remap.get(index);if(local===undefined){local=vertices.length;vertices.push(index);remap.set(index,local);}out.push(local);}
 const geometry=new T.BufferGeometry();
 for(const [name,attribute]of Object.entries(source.attributes)){
  const ArrayType=attribute.array.constructor as {new(length:number):T.TypedArray};
  const array=new ArrayType(vertices.length*attribute.itemSize),copy=new T.BufferAttribute(array,attribute.itemSize,attribute.normalized);
  for(let i=0;i<vertices.length;i++)for(let c=0;c<attribute.itemSize;c++){
   // Access raw values to preserve normalized integer attributes exactly.
   const src=attribute as T.InterleavedBufferAttribute;
   array[i*attribute.itemSize+c]=src.isInterleavedBufferAttribute?src.data.array[vertices[i]*src.data.stride+src.offset+c]:attribute.array[vertices[i]*attribute.itemSize+c];
  }
  geometry.setAttribute(name,copy);
 }
 geometry.setIndex(out);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** Geometry partitions are prepared offline from the checked-in GLBs. Runtime
 * loading performs linear copies only, with no connectivity search on phones. */
export function prepareModelWheels(root:T.Object3D,assetId:string){
 const layout=(layouts as Record<string,WheelRigLayout>)[assetId];if(!layout)return;
 const meshes=new Map<string,T.Mesh>();root.traverse(o=>{if(o instanceof T.Mesh)meshes.set(o.name,o);});
 // A replacement asset must get a new rig manifest, never partially use old
 // triangle ranges and accidentally remove body panels.
 for(const [name,partition]of Object.entries(layout.meshes)){
  const mesh=meshes.get(name);if(!mesh||(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)!==partition.triangles*3){root.userData.wheelRigWarning=`Wheel geometry changed: ${name}`;return;}
 }
 const pivots=layout.wheels.map((wheel,i)=>{const pivot=new T.Group();pivot.name=`Rolling-wheel-${i}`;pivot.position.fromArray(wheel.center);pivot.userData.rollingWheel={axis:wheel.axis??layout.axis,radius:wheel.radius};root.add(pivot);return pivot;});
 root.updateMatrixWorld(true);
 for(const [name,partition]of Object.entries(layout.meshes)){
  const mesh=meshes.get(name)!,original=mesh.geometry,index=original.index,groups=new Map<number,number[]>();
  for(const [start,count,id]of partition.runs){
   let indices=groups.get(id);if(!indices){indices=[];groups.set(id,indices);}
   for(let i=start*3;i<(start+count)*3;i++)indices.push(index?index.getX(i):i);
  }
  if(groups.size===1){const id=groups.keys().next().value!;if(id>=0)pivots[id].attach(mesh);continue;}
  for(const [id,indices]of groups){
   const part=mesh.clone(false);part.geometry=geometryPart(original,indices);part.name=`${mesh.name}-${id<0?'stationary':`wheel-${id}`}`;
   mesh.parent!.add(part);part.updateMatrixWorld(true);if(id>=0)pivots[id].attach(part);
  }
  mesh.removeFromParent();original.dispose();
 }
}
