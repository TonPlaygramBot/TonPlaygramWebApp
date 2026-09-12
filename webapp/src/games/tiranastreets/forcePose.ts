import * as T from 'three';
const rest = new WeakMap<T.Object3D, Map<T.Object3D, T.Quaternion>>();
const transitions=new WeakMap<T.Object3D,{aim:number;cover:number;ride:number}>();
/** Private cloned rigs only. Restore before sampling clips to avoid pose accumulation. */
export function resetForcePose(root:T.Object3D) {
  rest.get(root)?.forEach((q,bone)=>bone.quaternion.copy(q));
}
export function poseForce(root:T.Object3D, anim:string, alive=true,dt=1/60) {
  if(!alive)return;
  const weights=transitions.get(root)||{aim:0,cover:0,ride:0};
  const alpha=1-Math.exp(-Math.max(0,Math.min(dt,.1))*12);
  for(const key of ['aim','cover','ride'] as const)weights[key]+=((anim===key?1:0)-weights[key])*alpha;
  transitions.set(root,weights);
  const bases=new Map<T.Object3D,T.Quaternion>();
  const turn=(name:string,x:number,y=0,z=0)=>{
    const bone=root.getObjectByName(T.PropertyBinding.sanitizeNodeName(name)); if(!bone)return;
    bases.set(bone,bone.quaternion.clone());
    bone.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x,y,z)));
  };
  const total=weights.aim+weights.cover+weights.ride;
  // Aim a chain segment in world space so local bone authoring axes do not
  // determine the visible direction of the hands/weapon.
  const pointBone=(boneName:string,childName:string,target:T.Vector3)=>{
    const bone=root.getObjectByName(T.PropertyBinding.sanitizeNodeName(boneName)),child=root.getObjectByName(T.PropertyBinding.sanitizeNodeName(childName));
    if(!bone||!child||!bone.parent)return;
    bases.set(bone,bone.quaternion.clone());root.updateMatrixWorld(true);
    const p=bone.getWorldPosition(new T.Vector3()),q=child.getWorldPosition(new T.Vector3());
    const desired=root.localToWorld(target.clone()).sub(p).normalize();
    const rotation=new T.Quaternion().setFromUnitVectors(q.sub(p).normalize(),desired);
    const parent=bone.parent.getWorldQuaternion(new T.Quaternion());
    const wanted=bone.quaternion.clone().premultiply(parent.clone().invert().multiply(rotation).multiply(parent));
    bone.quaternion.slerp(wanted,Math.min(1,total));
  };
  if(total>.001) {
    const y=(weights.ride*1.08+weights.aim*1.3+weights.cover*1.02)/total;
    const z=(weights.ride*.46+weights.aim*.63+weights.cover*.38)/total;
    pointBone('upperarm01.R','lowerarm01.R',new T.Vector3(-.19,y,z));
    pointBone('lowerarm01.R','wrist.R',new T.Vector3(-.2,y,z));
    pointBone('upperarm01.L','lowerarm01.L',new T.Vector3(.04,y-.04,z+.15));
    pointBone('lowerarm01.L','wrist.L',new T.Vector3(.02,y-.04,z+.15));
  }
  const bend=weights.cover+weights.ride;
  if(bend>.001) {
    turn('upperleg01.L',-1.05*bend);turn('upperleg01.R',-1.05*bend);
    turn('lowerleg01.L',1.3*bend);turn('lowerleg01.R',1.3*bend);turn('spine02',.15*bend);
  }
  rest.set(root,bases);
}
