import { expect, it } from 'vitest';
import { Vector3, PerspectiveCamera } from 'three';
import { resolveLudoFirearmCameraPose, resolveLudoDiceCameraTarget, applyLudoCinematicPose, LUDO_CAMERA_PRESENTATION, resolveLudoBroadcastDuration } from './ludoCameraPresentation';
import { createSnakeCameraDirector } from './snakeCameraDirector';
const muzzle=new Vector3(0,.3,0), impact=new Vector3(0,.3,-1);
it('uses authored Ludo shoulder, projectile and impact offsets',()=>{
  const shoulder=resolveLudoFirearmCameraPose({muzzle,target:impact,elapsed:1000,preFireLeadMs:1000});
  expect(shoulder.position.toArray()).toEqual([-.13,.48,.46]);
  expect(shoulder.target.toArray()).toEqual([0,.318,-.72]);
  const projectile=resolveLudoFirearmCameraPose({muzzle,target:impact,phase:'projectile',projectile:new Vector3(0,.3,-.5)});
  expect(projectile.position.toArray()).toEqual([-.03,.382,-.35]);
  expect(projectile.lerp).toBe(.72);
  const hit=resolveLudoFirearmCameraPose({muzzle,target:impact,phase:'impact'});
  expect(hit.position.toArray()).toEqual([-.08,.45999999999999996,-.72]);
  expect(hit.lerp).toBe(.62);
});
it('keeps top/bottom dice framing still and blends side seats without chasing the die',()=>{
  const home=new Vector3(0,.04,-.02);
  for(const seat of [0,2])expect(resolveLudoDiceCameraTarget(home,new Vector3(0,.3,seat===0?1:-1),seat,.03,.01).equals(home)).toBe(true);
  const side=resolveLudoDiceCameraTarget(home,new Vector3(1,.3,0),1,.03,.01);
  expect(side.x).toBeCloseTo(.58*1.08);expect(side.y).toBe(.04);
  expect(LUDO_CAMERA_PRESENTATION.diceResultHoldMs).toBe(1500);
  expect(resolveLudoBroadcastDuration(3.2)).toBe(700);
});
it.each([30,60,90])('uses identical Ludo cinematic smoothing at %iHz and returns to local eyes',fps=>{
  const home=new Vector3(0,.4,1),target=new Vector3(0,.04,0),camera=new PerspectiveCamera(78);
  camera.position.copy(home);const director=createSnakeCameraDirector(camera,target);
  const pose=resolveLudoFirearmCameraPose({muzzle,target:impact,phase:'impact'});
  const expectedPosition=home.clone(),expectedTarget=target.clone();
  director.start({id:'capture',priority:3,points:()=>[impact],cameraPose:()=>pose},0,home,new Vector3(0,.04,0));
  for(let t=1000/fps;t<1000;t+=1000/fps){
    applyLudoCinematicPose(expectedPosition,expectedTarget,pose,1/fps);
    director.update(t,home,new Vector3(0,.04,0));
    expect(camera.position.distanceTo(expectedPosition)).toBeLessThan(1e-9);
    expect(target.distanceTo(expectedTarget)).toBeLessThan(1e-9);
  }
  expect(camera.fov).toBe(78);
  director.finish('capture',1000,0);director.update(1001,home,new Vector3(0,.04,0));
  director.update(1761,home,new Vector3(0,.04,0));
  expect(camera.position.equals(home)).toBe(true);expect(target.toArray()).toEqual([0,.04,0]);
});
it('manual or overhead cancellation cannot drag the camera back into a weapon shot',()=>{
  const camera=new PerspectiveCamera(),target=new Vector3(),home=new Vector3(0,1,2);
  const director=createSnakeCameraDirector(camera,target);
  director.start({id:'capture',priority:3,points:()=>[impact],cameraPose:()=>resolveLudoFirearmCameraPose({muzzle,target:impact})},0,home,target);
  director.cancel();camera.position.set(0,5,0);expect(director.update(500,home,target)).toBe(false);expect(camera.position.y).toBe(5);
});
it('preserves the original Ludo pose equations across orientations, weapon types and phases',()=>{
  for(const destination of [new Vector3(1,.5,-1),new Vector3(-1,.2,1),new Vector3(0,2,0)]) {
    for(const single of [false,true])for(const elapsed of [0,300,1200]) {
      const up=new Vector3(0,1,0),direction=destination.clone().sub(muzzle).normalize();
      const side=up.clone().cross(direction);if(side.lengthSq()<1e-7)side.set(1,0,0);side.normalize();
      const blend=Math.min(1,elapsed/1000);
      const expectedPosition=muzzle.clone().addScaledVector(direction,-(single?.36:.46))
        .addScaledVector(side,single?.09:.13).addScaledVector(up,.12+((single?.16:.18)-.12)*blend);
      const expectedTarget=muzzle.clone().lerp(destination,.42+(.72-.42)*blend).addScaledVector(up,.018);
      const pose=resolveLudoFirearmCameraPose({muzzle,target:destination,singleShot:single,elapsed,preFireLeadMs:1000,pickupLeadMs:400});
      expect(pose.position.distanceTo(expectedPosition)).toBeLessThan(1e-12);
      expect(pose.target.distanceTo(expectedTarget)).toBeLessThan(1e-12);expect(pose.lerp).toBe(elapsed<400?.1:.18);
      const bullet=new Vector3(.2,.4,-.6);
      const projectile=resolveLudoFirearmCameraPose({muzzle,target:destination,singleShot:single,phase:'projectile',projectile:bullet});
      expect(projectile.position.distanceTo(bullet.clone().addScaledVector(direction,-.15)
        .addScaledVector(side,single?.018:.03).addScaledVector(up,single?.07:.082))).toBeLessThan(1e-12);
      expect(projectile.target.distanceTo(bullet.clone().addScaledVector(direction,.34))).toBeLessThan(1e-12);
    }
  }
});
it('reduced motion keeps the local seat instead of starting cinematic camera travel',()=>{
  const camera=new PerspectiveCamera(78),home=new Vector3(0,1,2),target=new Vector3();camera.position.copy(home);
  const director=createSnakeCameraDirector(camera,target);
  director.start({id:'capture',priority:3,points:()=>[impact],cameraPose:()=>resolveLudoFirearmCameraPose({muzzle,target:impact})},0,home,target);
  director.update(500,home,new Vector3(),true);expect(camera.position.equals(home)).toBe(true);expect(camera.fov).toBe(78);
});
