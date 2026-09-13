import * as THREE from 'three';
import { V, world, setWorldPose } from './characterContact';
import { weaponPoints, weaponSpec, isThrownWeapon } from './weaponModels';

// Seat-facing +right is visually right in the portrait camera. Choose the
// closest reachable grip placement whose whole model fits on the table.
export function parkWeapon(weapon:THREE.Object3D,id:string,seat:THREE.Vector3,center:THREE.Vector3,surfaceY:number,
  outerRadius:(direction:THREE.Vector3)=>number) {
  const outward=seat.clone().sub(center).setY(0).normalize(),inward=outward.clone().negate(),right=inward.clone().cross(V(0,1,0));
  const spec=weaponSpec(id),grip=weaponPoints(weapon).grip.position,scale=weapon.getWorldScale(V());
  const corners:THREE.Vector3[]=[];
  weapon.updateWorldMatrix(true,true);
  weapon.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh||!mesh.visible)return;
    mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox!;
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
      corners.push(weapon.worldToLocal(V(x,y,z).applyMatrix4(mesh.matrixWorld)).sub(grip).multiply(scale));
    }
  });
  let best:{score:number;anchor:THREE.Vector3;q:THREE.Quaternion}|null=null;
  const radius=outerRadius(outward);
  for(const angle of spec.twoHands?[.65,.8,.95,1.1,1.25]:[.18]){
    const forward=inward.clone().multiplyScalar(Math.cos(angle)).addScaledVector(right,Math.sin(angle));
    const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),forward);
    if(!isThrownWeapon(id)&&spec.kind!=='tank')q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),Math.PI/2));
    const rotated=corners.map(point=>point.clone().applyQuaternion(q));
    for(const side of [.08,.12,.16])for(let r=radius-.06;r>radius*.25;r-=.01){
      const anchor=outward.clone().multiplyScalar(r).addScaledVector(right,side);
      if(rotated.some(point=>{const d=point.clone().add(anchor).setY(0),length=d.length();return length>outerRadius(d.divideScalar(length))-.012;}))continue;
      const score=r-Math.abs(side-.10)*.15;
      if(!best||score>best.score)best={score,anchor:anchor.add(center).setY(surfaceY),q};
      break;
    }
  }
  if(!best)return;
  setWorldPose(weapon,best.anchor.sub(grip.clone().multiply(scale).applyQuaternion(best.q)),best.q);
  const bounds=new THREE.Box3().setFromObject(weapon),position=world(weapon);position.y+=surfaceY+.006-bounds.min.y;setWorldPose(weapon,position);
}
