import * as T from 'three';
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
