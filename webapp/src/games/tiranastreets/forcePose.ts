import * as T from 'three';
import {npcWeaponPose} from './shared/npcWeaponPose.mjs';
type Joint={bone:T.Object3D;base:T.Quaternion;changed:boolean};
type Pose={joints:Map<string,Joint>;carry:number;cover:number;ride:number};
const rigs=new WeakMap<T.Object3D,Pose>();
const shoulder=new T.Vector3(),elbow=new T.Vector3(),hand=new T.Vector3(),target=new T.Vector3();
const axis=new T.Vector3(),pole=new T.Vector3(),bendPoint=new T.Vector3(),current=new T.Vector3(),desired=new T.Vector3();
const rotation=new T.Quaternion(),parentRotation=new T.Quaternion(),wanted=new T.Quaternion(),angles=new T.Euler();
function rig(root:T.Object3D){
 let pose=rigs.get(root);
 if(!pose){const joints=new Map<string,Joint>();root.traverse(bone=>{if(bone instanceof T.Bone)joints.set(bone.name,{bone,base:bone.quaternion.clone(),changed:false});});pose={joints,carry:0,cover:0,ride:0};rigs.set(root,pose);}
 return pose;
}
export function resetForcePose(root:T.Object3D){
 for(const j of rigs.get(root)?.joints.values()||[])if(j.changed){j.bone.quaternion.copy(j.base);j.changed=false;}
}
/** Two-bone arm IK uses the same grip anchors as the player and the NPC gun.
 * Only the affected bone ancestry is updated, never the entire uniform mesh. */
export function poseForce(root:T.Object3D,anim:string,alive=true,dt=1/60,pitch=0,weapon='ak47VolleyAttack'){
 if(!alive)return;
 const pose=rig(root),alpha=1-Math.exp(-Math.max(0,Math.min(dt,.15))*12);
 pose.cover+=((anim==='cover'?1:0)-pose.cover)*alpha;
 pose.ride+=((anim==='ride'?1:0)-pose.ride)*alpha;
 pose.carry+=((weapon||anim==='spray'||anim==='ride'?1:0)-pose.carry)*alpha;
 const get=(name:string)=>pose.joints.get(T.PropertyBinding.sanitizeNodeName(name));
 const remember=(j:Joint)=>{if(!j.changed){j.base.copy(j.bone.quaternion);j.changed=true;}};
 const turn=(name:string,x:number)=>{const j=get(name);if(j){remember(j);j.bone.quaternion.multiply(rotation.setFromEuler(angles.set(x,0,0)));}};
 const bend=pose.cover+pose.ride;
 if(bend>.001){turn('upperleg01.L',-1.05*bend);turn('upperleg01.R',-1.05*bend);turn('lowerleg01.L',1.3*bend);turn('lowerleg01.R',1.3*bend);turn('spine02',.15*bend);}
 if(pose.carry<.001)return;
 root.updateWorldMatrix(true,false);
 const grip=npcWeaponPose({weapon,anim,aimPitch:pitch,x:0,z:0,heading:0});
 const point=(j:Joint,child:Joint,goal:T.Vector3)=>{
  if(!j.bone.parent)return;remember(j);
  j.bone.getWorldPosition(current);child.bone.getWorldPosition(desired).sub(current).normalize();
  current.multiplyScalar(-1).add(goal).normalize();rotation.setFromUnitVectors(desired,current);
  j.bone.parent.getWorldQuaternion(parentRotation);
  wanted.copy(parentRotation).invert().multiply(rotation).multiply(parentRotation).multiply(j.bone.quaternion);
  j.bone.quaternion.slerp(wanted,pose.carry);
 };
 for(const side of ['R','L']){
  const upper=get(`upperarm01.${side}`),lower=get(`lowerarm01.${side}`),wrist=get(`wrist.${side}`);if(!upper||!lower||!wrist)continue;
  const g=side==='R'?grip.right:grip.left;
  target.set(g.x,g.y,g.z);
  if(anim==='spray')target.set(side==='R'?grip.origin.x:.16,side==='R'?grip.origin.y:1.1,side==='R'?grip.origin.z:.16);
  if(anim==='ride')target.set(side==='R'?-.2:.2,1.08,.46);
  target.applyMatrix4(root.matrixWorld);
  upper.bone.getWorldPosition(shoulder);lower.bone.getWorldPosition(elbow);wrist.bone.getWorldPosition(hand);
  const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(hand),distance=shoulder.distanceTo(target);
  if(a<.001||b<.001||distance<.001)continue;
  const d=T.MathUtils.clamp(distance,Math.abs(a-b)+.001,a+b-.001),along=(a*a-b*b+d*d)/(2*d);
  axis.copy(target).sub(shoulder).normalize();target.copy(shoulder).addScaledVector(axis,d);
  pole.set(side==='R'?-.5:.5,-1,-.25).transformDirection(root.matrixWorld);
  pole.addScaledVector(axis,-pole.dot(axis)).normalize();
  bendPoint.copy(shoulder).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
  point(upper,lower,bendPoint);point(lower,wrist,target);
 }
}
