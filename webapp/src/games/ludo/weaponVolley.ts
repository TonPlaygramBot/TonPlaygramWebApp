import * as THREE from 'three';
import { V, world } from './characterContact';
import { createWeaponInteraction } from './weaponInteraction';
import { weaponPoints, weaponSpec, isThrownWeapon } from './weaponModels';
import { createLudoProjectile, createLudoImpact, projectileFlightPoint, sampleCasing, disposeEffect } from './weaponEffects';
import { getLudoFirearmTiming, getLudoFirearmBallistics, createCaliberShellCasingFx, createCaptureMuzzleFx } from '../../utils/ludoFirearmPresentation';

type Options = {
  scene:THREE.Object3D; entry:any; weapon:THREE.Object3D; id:string; surfaceY:number;
  applyPose:(mode:string,grip:number)=>void; target:()=>THREE.Vector3; isCurrent:()=>boolean;
  onShot:(ejectsCase:boolean)=>void; onImpact:(point:THREE.Vector3,direction:THREE.Vector3)=>void;
  onFrame?:(muzzle:THREE.Vector3,target:THREE.Vector3)=>void;
  requestFrame?:(callback:(now:number)=>void)=>unknown; now?:()=>number;
};
// Presentation only: authoritative moves/captures remain in the game controller.
export function playWeaponVolley(options:Options):Promise<boolean> {
  const {scene,entry,weapon,id,surfaceY}=options,timing=getLudoFirearmTiming(id),profile=getLudoFirearmBallistics(id),spec=weaponSpec(id);
  const now=options.now||(()=>performance.now()),request=options.requestFrame||requestAnimationFrame,start=now();
  const motion=entry?.rig?createWeaponInteraction(entry,weapon,scene,id,options.target(),timing,options.applyPose):null;
  if(motion)motion.startMs=start;
  const points=weaponPoints(weapon),flash=createCaptureMuzzleFx(),impact=createLudoImpact(id);
  scene.add(flash.root,impact.root);
  const bullets:Array<{mesh:THREE.Object3D;start:THREE.Vector3;end:THREE.Vector3;time:number;duration:number;final:boolean}>=[];
  const casings:Array<{mesh:THREE.Object3D;origin:THREE.Vector3;velocity:THREE.Vector3;time:number}>=[];
  let nextShot=0,impactTime=-1,lastShotTime=-1,settled=false;
  const finish=()=>{if(settled)return;settled=true;motion?.release();disposeEffect(flash.root);impact.dispose();
    for(const bullet of bullets){
      if(isThrownWeapon(id))disposeEffect(bullet.mesh);
      else {bullet.mesh.userData.dispose?.();bullet.mesh.removeFromParent();}
    }
    for(const casing of casings)disposeEffect(casing.mesh);
  };
  return new Promise((resolve,reject)=>{
    const frame=(time:number)=>{
      if(settled)return;
      try {
        if(!options.isCurrent()||motion?.finished){finish();resolve(false);return;}
        const elapsed=time-start,target=options.target();motion?.update(time,target);
        const muzzle=world(points.muzzle);options.onFrame?.(muzzle,target);
        // Catch up shot boundaries without losing shells at low frame rates.
        while(nextShot<timing.shots&&elapsed>=timing.preFireLeadMs+nextShot*timing.cadenceMs){
          const shotTime=timing.preFireLeadMs+nextShot*timing.cadenceMs;
          motion?.update(start+shotTime,target);
          const origin=world(points.muzzle),last=nextShot===timing.shots-1;
          for(let pellet=0;pellet<timing.pelletsPerShot;pellet++){
            const mesh=createLudoProjectile(id,profile),end=target.clone();
            if(timing.pelletsPerShot>1)end.add(V(Math.cos(pellet*2.399),Math.sin(pellet*2.399)*.5,Math.sin(pellet*1.719)).multiplyScalar(profile.tracerSpread*.5));
            scene.add(mesh);bullets.push({mesh,start:origin.clone(),end,time:shotTime,duration:last?620:120,final:last&&pellet===0});
          }
          if(spec.ejectsCase){
            const mesh=createCaliberShellCasingFx(profile),origin=world(points.ejection),q=weapon.getWorldQuaternion(new THREE.Quaternion());
            scene.add(mesh);casings.push({mesh,origin,velocity:V(.24,.34,-.07).applyQuaternion(q),time:shotTime+(spec.kind==='marksman'?180:0)});
          }
          lastShotTime=shotTime;options.onShot(spec.ejectsCase);nextShot++;
        }
        motion?.update(time,target);
        flash.root.visible=!isThrownWeapon(id)&&lastShotTime>=0&&elapsed-lastShotTime<60;
        flash.root.position.copy(world(points.muzzle));flash.root.quaternion.copy(weapon.getWorldQuaternion(new THREE.Quaternion()));
        for(const bullet of bullets){
          const age=elapsed-bullet.time,t=THREE.MathUtils.clamp(age/bullet.duration,0,1);
          bullet.mesh.visible=age>=0&&t<1;bullet.mesh.position.copy(projectileFlightPoint(bullet.start,bullet.end,t,isThrownWeapon(id)));
          const direction=bullet.end.clone().sub(bullet.start).normalize();
          if(!isThrownWeapon(id))bullet.mesh.quaternion.setFromUnitVectors(V(0,1,0),direction);
          else bullet.mesh.rotation.set(t*Math.PI*2,t*Math.PI*3,0);
          if(bullet.final&&t>=1&&impactTime<0){impactTime=elapsed;impact.root.position.copy(bullet.end);options.onImpact(bullet.end,direction);}
        }
        for(const casing of casings){
          const age=(elapsed-casing.time)/1000;casing.mesh.visible=age>=0;if(age<0)continue;
          casing.mesh.position.copy(sampleCasing(casing.origin,casing.velocity,age,surfaceY+.004));
          const spin=Math.min(age,.7);casing.mesh.rotation.set(spin*14,spin*9,spin*12);
        }
        if(impactTime>=0)impact.update((elapsed-impactTime)/700);
        if(elapsed<timing.durationMs||impactTime<0||elapsed<impactTime+700){request(frame);return;}
        finish();resolve(true);
      }catch(error){finish();reject(error);}
    };
    request(frame);
  });
}
