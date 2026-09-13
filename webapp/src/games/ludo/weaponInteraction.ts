import { createDiceGesture, DICE_RELEASE_MS } from './diceMotion';
import * as THREE from 'three';
import { V, world, setWorldPose, palmMarker, palmOrientation, solveArm, smooth, armScale, savePose, blendPose, type Rig } from './characterContact';
import { weaponPoints, weaponSpec, isThrownWeapon } from './weaponModels';
export function aimWeaponFromPivot(weapon:THREE.Object3D, pivot:THREE.Vector3, anchor:THREE.Vector3, target:THREE.Vector3) {
  const points=weaponPoints(weapon),scale=weapon.getWorldScale(V());
  const local=points.muzzle.position.clone().sub(pivot).multiply(scale),d=target.clone().sub(anchor);
  const horizontal=Math.hypot(d.x,d.z);
  const yaw=Math.atan2(d.x,d.z)-Math.asin(THREE.MathUtils.clamp(local.x/Math.max(horizontal,.0001),-.98,.98));
  const z=Math.sqrt(Math.max(.0001,horizontal*horizontal-local.x*local.x));
  const pitch=Math.atan2(d.y,z)-Math.asin(THREE.MathUtils.clamp(local.y/Math.hypot(d.y,z),-.98,.98));
  const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch,yaw,0,'YXZ'));
  return {quaternion,position:anchor.clone().sub(pivot.clone().multiply(scale).applyQuaternion(quaternion))};
}
type Entry={actor:THREE.Object3D;rig:Rig;propMotion?:any};
type Timing={pickupLeadMs:number;preFireLeadMs:number;shots:number;cadenceMs:number;durationMs:number};
export function createWeaponInteraction(entry:Entry, weapon:THREE.Object3D, scene:THREE.Object3D, id:string, target:THREE.Vector3,
  timing:Timing, applyPose:(mode:string,grip:number)=>void) {
  entry.propMotion?.cancel?.();
  const spec=weaponSpec(id),points=weaponPoints(weapon),rig=entry.rig;
  const home={parent:weapon.parent!,position:weapon.position.clone(),quaternion:weapon.quaternion.clone(),scale:weapon.scale.clone()};
  const park=world(weapon),parkQ=weapon.getWorldQuaternion(new THREE.Quaternion());scene.attach(weapon);
  const palm=palmMarker(rig,'right'),support=palmMarker(rig,'left');
  const handStart=world(palm),supportStart=world(support),startHandQ=rig.rightHand.getWorldQuaternion(new THREE.Quaternion()),original=savePose(rig);
  let finished=false,lastTarget=target.clone(),thrown=false;
  const throwGesture=isThrownWeapon(id)?createDiceGesture(entry,weapon,applyPose,{startMs:0,isCurrent:()=>!finished,onRelease:()=>{thrown=true;}}):null;
  const interaction={weapon,muzzle:points.muzzle,offhandTarget:points.support,ejection:points.ejection,twoHanded:spec.twoHands,muzzleForward:V(0,0,1),startMs:performance.now(),
    get finished(){return finished;},
    update(now:number,liveTarget?:THREE.Vector3){
      if(finished)return;if(liveTarget)lastTarget.copy(liveTarget);
      const elapsed=now-this.startMs;
      if(throwGesture){throwGesture.update(elapsed*DICE_RELEASE_MS/timing.preFireLeadMs);weapon.visible=!thrown;return;}
      const lift=smooth((elapsed-timing.pickupLeadMs)/Math.max(1,timing.preFireLeadMs-timing.pickupLeadMs));
      const returning=elapsed>timing.durationMs-500,blend=returning?1-smooth((elapsed-timing.durationMs+500)/400):lift;
      applyPose(spec.kind==='pistol'||spec.kind==='revolver'?'firearmAimPistol':spec.kind==='smg'?'firearmAimSmg':'firearmAimRifle',1);
      const reach=returning?1-smooth((elapsed-timing.durationMs+100)/100):smooth(elapsed/timing.pickupLeadMs);
      const authored=savePose(rig);blendPose(rig,original,authored,reach);entry.actor.updateWorldMatrix(true,true);
      const localTarget=entry.actor.worldToLocal(lastTarget.clone());
      const torsoYaw=THREE.MathUtils.clamp(Math.atan2(localTarget.x,localTarget.z),-.85,.85)*blend;
      rig.spine?.rotateY(torsoYaw);
      rig.head?.rotateY(torsoYaw*.18);
      entry.actor.updateWorldMatrix(true,true);
      const scale=armScale(rig),forward=entry.actor.getWorldDirection(V()).setY(0).normalize();
      const shoulder=world(rig.rightUpperArm),across=world(rig.leftUpperArm).sub(shoulder).normalize();
      const anchor=points.stock?shoulder.clone().addScaledVector(across,.025*scale).addScaledVector(forward,.03*scale)
        :world(rig.leftUpperArm).lerp(shoulder,.5).addScaledVector(forward,.38*scale).add(V(0,.055*scale,0));
      const aim=aimWeaponFromPivot(weapon,spec.kind==='tank'?V():points.stock?.position||points.grip.position,spec.kind==='tank'?park:anchor,lastTarget);
      // At close range, tuck a long stock under the arm so the barrel stays
      // behind the target. Translation along the bore preserves the aim ray.
      if (points.stock) {
        const direction=V(0,0,1).applyQuaternion(aim.quaternion);
        const muzzle=points.muzzle.position.clone().multiply(weapon.getWorldScale(V())).applyQuaternion(aim.quaternion).add(aim.position);
        const clearance=lastTarget.clone().sub(muzzle).dot(direction);
        if(clearance<.045)aim.position.addScaledVector(direction,clearance-.045);
      }
      const shooting=elapsed>=timing.preFireLeadMs&&elapsed<timing.preFireLeadMs+timing.shots*timing.cadenceMs;
      const kick=shooting?Math.max(0,1-((elapsed-timing.preFireLeadMs)%timing.cadenceMs)/94)*.012*scale:0;
      aim.position.addScaledVector(V(0,0,-1).applyQuaternion(aim.quaternion),kick);
      if(spec.kind==='tank'){setWorldPose(weapon,park,parkQ.clone().slerp(aim.quaternion,blend));return;}
      setWorldPose(weapon,park.clone().lerp(aim.position,blend),parkQ.clone().slerp(aim.quaternion,blend));
      const gunQ=weapon.getWorldQuaternion(new THREE.Quaternion()),up=V(0,1,0).applyQuaternion(gunQ),gunForward=V(0,0,1).applyQuaternion(gunQ);
      solveArm(rig,'right',palm,handStart.clone().lerp(world(points.grip),reach),startHandQ.clone().slerp(palmOrientation(rig,'right',gunForward,up),reach),blend<1);
      if(spec.twoHands)solveArm(rig,'left',support,supportStart.clone().lerp(world(points.support),blend),palmOrientation(rig,'left',gunForward.clone().negate(),up));
      weapon.visible=!isThrownWeapon(id)||elapsed<timing.preFireLeadMs;
      entry.actor.updateWorldMatrix(true,true);
    },
    release(){if(finished)return;throwGesture?.cancel();finished=true;home.parent.add(weapon);weapon.position.copy(home.position);weapon.quaternion.copy(home.quaternion);weapon.scale.copy(home.scale);weapon.visible=true;if(entry.propMotion===interaction)entry.propMotion=null;},
    cancel(){this.release();}
  };
  entry.propMotion=interaction;return interaction;
}
