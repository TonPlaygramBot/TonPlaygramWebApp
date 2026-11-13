import * as T from 'three';
import {solveHumanoidLimb} from './humanoidRig.mjs';
const handSpace={origin:new T.Vector3(),along:new T.Vector3(),across:new T.Vector3(),normal:new T.Vector3(),spare:new T.Vector3(),
 facing:new T.Quaternion(),pitch:new T.Quaternion(),xAxis:new T.Vector3(1,0,0),toAlong:new T.Vector3(),toNormal:new T.Vector3(),toAcross:new T.Vector3(),
 source:new T.Matrix4(),desired:new T.Matrix4(),delta:new T.Quaternion(),parent:new T.Quaternion(),q:new T.Quaternion(),
 forward:new T.Vector3(),axis:new T.Vector3(),jointWorld:new T.Quaternion(),turn:new T.Quaternion()};
/** Orient the original open palm around a grip and curl its existing fingers.
 * Measured palm axes avoid copying rotations across differently rolled bones. */
export function poseHumanoidHandGrip(root,get,remember,side,pitch,amount){
 const wrist=get(`wrist.${side}`),middle=get(`finger3-1.${side}`),index=get(`finger2-1.${side}`),little=get(`finger5-1.${side}`);
 if(!wrist||!middle||!index||!little||!wrist.bone.parent)return;
 const h=handSpace,origin=wrist.bone.getWorldPosition(h.origin);
 const along=middle.bone.getWorldPosition(h.along).sub(origin).normalize();
 const across=index.bone.getWorldPosition(h.across).sub(little.bone.getWorldPosition(h.spare));
 across.addScaledVector(along,-across.dot(along)).normalize();
 const normal=h.normal.crossVectors(across,along).normalize();
 if(across.lengthSq()<.5||along.lengthSq()<.5)return;
 root.getWorldQuaternion(h.facing);h.pitch.setFromAxisAngle(h.xAxis,-pitch);
 const toAlong=h.toAlong.set(side==='R'?0:1,side==='R'?.93:0,side==='R'?.36:.1).normalize().applyQuaternion(h.pitch).applyQuaternion(h.facing);
 const toNormal=h.toNormal.set(side==='R'?1:0,side==='R'?0:1,0).applyQuaternion(h.pitch).applyQuaternion(h.facing);
 toNormal.addScaledVector(toAlong,-toNormal.dot(toAlong)).normalize();
 const toAcross=h.toAcross.crossVectors(toAlong,toNormal).normalize();
 h.source.makeBasis(across,along,normal);h.desired.makeBasis(toAcross,toAlong,toNormal);
 const delta=h.delta.setFromRotationMatrix(h.desired.multiply(h.source.invert()));
 remember(wrist);const parent=wrist.bone.parent.getWorldQuaternion(h.parent);
 const q=h.q.copy(parent).invert().multiply(delta).multiply(parent).multiply(wrist.bone.quaternion);
 wrist.bone.quaternion.slerp(q,amount);wrist.bone.updateWorldMatrix(false,true);
 for(let finger=1;finger<=5;finger++)for(let segment=1;segment<=3;segment++){
  const joint=get(`finger${finger}-${segment}.${side}`);if(!joint||!joint.bone.parent)continue;
  const child=joint.bone.children.find(o=>o instanceof T.Bone);
  const forward=child?child.getWorldPosition(h.forward).sub(joint.bone.getWorldPosition(h.spare)).normalize():h.forward.set(0,1,0).applyQuaternion(joint.bone.getWorldQuaternion(h.jointWorld));
  const axis=h.axis.crossVectors(forward,toNormal).normalize();if(axis.lengthSq()<.5)continue;
  remember(joint);joint.bone.parent.getWorldQuaternion(parent);
  const curl=(finger===1?.3:segment===1?.65:segment===2?1.05:.65)*amount;
  const turn=h.turn.setFromAxisAngle(axis,curl);
  joint.bone.quaternion.premultiply(q.copy(parent).invert().multiply(turn).multiply(parent));
  joint.bone.updateWorldMatrix(false,true);
 }
}

const contactScratch = new WeakMap();
function gripScratch(root) {
 let s=contactScratch.get(root);
 if(!s){s={origin:new T.Vector3(),along:new T.Vector3(),across:new T.Vector3(),normal:new T.Vector3(),spare:new T.Vector3(),palm:new T.Vector3(),offset:new T.Vector3(),target:new T.Vector3(),toAlong:new T.Vector3(),toNormal:new T.Vector3(),toAcross:new T.Vector3(),source:new T.Matrix4(),desired:new T.Matrix4(),delta:new T.Quaternion(),world:new T.Quaternion(),parent:new T.Quaternion(),forward:new T.Vector3(),axis:new T.Vector3(),turn:new T.Quaternion(),q:new T.Quaternion()};contactScratch.set(root,s);}
 return s;
}
/** Mid-palm contact, measured from the authored metacarpals instead of treating
 * the wrist joint as the skin's contact point. No rig names or scales change. */
export function humanoidPalmPoint(bones,side,out=new T.Vector3()) {
 const wrist=bones.get(side+'hand');if(!wrist)return out.set(0,0,0);
 const middle=bones.get(side+'handmiddle1'),ring=bones.get(side+'handring1');
 wrist.getWorldPosition(out);
 if(!middle)return out;
 const s=gripScratch(wrist),base=middle.getWorldPosition(s.spare);
 if(ring)base.add(ring.getWorldPosition(s.origin)).multiplyScalar(.5);
 return out.lerp(base,.62);
}

/** Fix palm contact to an object in WORLD space. Desired finger/palm axes are
 * measured independently from bone rolls, then the wrist target compensates
 * for the palm offset. IK can rotate the forearm without twisting the grip. */
export function solveHumanoidGrip(root,bones,side,target,along,normal,curl=1) {
 const wrist=bones.get(side+'hand'),middle=bones.get(side+'handmiddle1'),index=bones.get(side+'handindex1'),little=bones.get(side+'handpinky1');
 if(!wrist?.parent||!middle||!index||!little)return false;
 const s=gripScratch(root);
 wrist.getWorldPosition(s.origin);
 middle.getWorldPosition(s.along).sub(s.origin).normalize();
 index.getWorldPosition(s.across).sub(little.getWorldPosition(s.spare));
 s.across.addScaledVector(s.along,-s.across.dot(s.along)).normalize();
 s.normal.crossVectors(s.across,s.along).normalize();
 s.toAlong.copy(along).normalize();s.toNormal.copy(normal).addScaledVector(s.toAlong,-normal.dot(s.toAlong)).normalize();
 s.toAcross.crossVectors(s.toAlong,s.toNormal).normalize();
 if([s.along,s.across,s.toAlong,s.toNormal].some(v=>!Number.isFinite(v.lengthSq())||v.lengthSq()<.5))return false;
 s.source.makeBasis(s.across,s.along,s.normal);s.desired.makeBasis(s.toAcross,s.toAlong,s.toNormal);
 s.delta.setFromRotationMatrix(s.desired.multiply(s.source.invert()));
 wrist.getWorldQuaternion(s.world).premultiply(s.delta);
 wrist.parent.getWorldQuaternion(s.parent);
 wrist.quaternion.copy(s.parent.invert().multiply(s.world));wrist.updateWorldMatrix(false,true);
 humanoidPalmPoint(bones,side,s.palm);wrist.getWorldPosition(s.origin);
 s.offset.copy(s.palm).sub(s.origin);s.target.copy(target).sub(s.offset);
 if(!solveHumanoidLimb(root,bones,side,s.target))return false;
 wrist.parent.getWorldQuaternion(s.parent);
 wrist.quaternion.copy(s.parent.invert().multiply(s.world));wrist.updateWorldMatrix(false,true);
 curlHumanoidFingers(root,bones,side,s.toNormal,curl);
 return true;
}

/** Curl using actual phalanx directions, including differently rolled rigs. */
export function curlHumanoidFingers(root,bones,side,normal,curl=1){
 const s=gripScratch(bones.get(side+'hand')||root);
 const amount=T.MathUtils.clamp(curl,0,1);
 for(const [number,finger] of ['thumb','index','middle','ring','pinky'].entries())for(let segment=1;segment<=3;segment++){
  const joint=bones.get(`${side}hand${finger}${segment}`);if(!joint?.parent)continue;
  const child=joint.children.find(o=>o.isBone);if(!child)continue;
  child.getWorldPosition(s.forward).sub(joint.getWorldPosition(s.spare)).normalize();
  s.axis.crossVectors(s.forward,normal).normalize();if(s.axis.lengthSq()<.5)continue;
  // Thumb opposition stays modest; the index remains less clenched on the trigger.
  const bend=(number===0?.28:number===1?(segment===1?.4:.7):segment===1?.65:segment===2?1.05:.65)*amount;
  s.turn.setFromAxisAngle(s.axis,bend);joint.parent.getWorldQuaternion(s.parent);
  joint.quaternion.premultiply(s.q.copy(s.parent).invert().multiply(s.turn).multiply(s.parent));
  joint.updateWorldMatrix(false,true);
 }
}
export function poseHumanoidFist(root,bones,side,amount=1){
 const wrist=bones.get(side+'hand'),middle=bones.get(side+'handmiddle1'),index=bones.get(side+'handindex1'),little=bones.get(side+'handpinky1');
 if(!wrist||!middle||!index||!little)return;
 const s=gripScratch(root);
 middle.getWorldPosition(s.along).sub(wrist.getWorldPosition(s.origin)).normalize();
 index.getWorldPosition(s.across).sub(little.getWorldPosition(s.spare)).normalize();
 s.normal.crossVectors(s.across,s.along).normalize();
 curlHumanoidFingers(root,bones,side,s.normal,amount);
}
