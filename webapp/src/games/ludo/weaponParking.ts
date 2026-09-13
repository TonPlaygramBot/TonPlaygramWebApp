import * as THREE from 'three';
import { V, world, setWorldPose } from './characterContact';
import { weaponPoints, weaponSpec, isThrownWeapon } from './weaponModels';

// Camera-facing seats use +right on the portrait screen. Keep the pickup grip
// near the player and lay long barrels diagonally across the right-hand rail.
export function parkWeapon(weapon:THREE.Object3D,id:string,seat:THREE.Vector3,center:THREE.Vector3,surfaceY:number,
  outerRadius:(direction:THREE.Vector3)=>number) {
  const outward=seat.clone().sub(center).setY(0).normalize(),inward=outward.clone().negate(),right=inward.clone().cross(V(0,1,0));
  const spec=weaponSpec(id),angle=spec.twoHands?Math.PI*.4:.18;
  const forward=inward.clone().multiplyScalar(Math.cos(angle)).addScaledVector(right,Math.sin(angle));
  const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),forward);
  if(!isThrownWeapon(id)&&spec.kind!=='tank')q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),Math.PI/2));
  const radius=outerRadius(outward),grip=weaponPoints(weapon).grip.position.clone().multiply(weapon.getWorldScale(V())).applyQuaternion(q);
  const anchor=center.clone().addScaledVector(outward,radius-(spec.twoHands?.16:.095)).addScaledVector(right,.11).setY(surfaceY);
  setWorldPose(weapon,anchor.sub(grip),q);
  // Constrain the footprint, including long stocks, without changing its size.
  for(let pass=0;pass<10;pass++){
    const bounds=new THREE.Box3().setFromObject(weapon);let excess=0;
    for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z]){
      const d=V(x-center.x,0,z-center.z),r=d.length();if(r>0)excess=Math.max(excess,r-outerRadius(d.divideScalar(r))+.012);
    }
    if(excess<=.001)break;
    setWorldPose(weapon,world(weapon).addScaledVector(inward,excess));
  }
  const bounds=new THREE.Box3().setFromObject(weapon);
  const position=world(weapon);position.y+=surfaceY+.006-bounds.min.y;setWorldPose(weapon,position);
}
