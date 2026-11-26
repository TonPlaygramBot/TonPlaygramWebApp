import * as T from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {CollectionVehicle} from './shared/vehicleCollection.mjs';

/** Rotate a private bone in world space, independent of its authored local axes. */
function aim(root: T.Object3D, bone: T.Object3D, child: T.Object3D, target: T.Vector3) {
  root.updateMatrixWorld(true);
  const p = bone.getWorldPosition(new T.Vector3());
  const from = child.getWorldPosition(new T.Vector3()).sub(p).normalize();
  const to = target.clone().sub(p).normalize();
  const delta = new T.Quaternion().setFromUnitVectors(from, to);
  const parent = bone.parent!.getWorldQuaternion(new T.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  root.updateMatrixWorld(true);
}

/** Two-bone IK retains limb lengths while bending knees and elbows at the seat. */
function reach(root: T.Object3D, names: [string, string, string], end: T.Vector3, pole: T.Vector3) {
  const [a, b, c] = names.map(name => root.getObjectByName(name));
  if (!a || !b || !c) throw Error(`Driver rig is missing ${names.join('/')}`);
  root.updateMatrixWorld(true);
  const start = a.getWorldPosition(new T.Vector3());
  const mid = b.getWorldPosition(new T.Vector3());
  const tip = c.getWorldPosition(new T.Vector3());
  const l1 = start.distanceTo(mid), l2 = mid.distanceTo(tip);
  const direction = end.clone().sub(start).normalize();
  const d = T.MathUtils.clamp(start.distanceTo(end), Math.abs(l1-l2)+.001, l1+l2-.001);
  const along = (l1*l1+d*d-l2*l2)/(2*d);
  const bend = pole.clone().sub(start).addScaledVector(direction, -pole.clone().sub(start).dot(direction)).normalize();
  const elbow = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0,l1*l1-along*along)));
  aim(root, a, b, elbow);
  aim(root, b, c, start.addScaledVector(direction,d));
}

/** Reuse the game's detailed RPM human. Vehicle geometry/materials are untouched.
 * One private skeleton per occupant; meshes and PBR textures remain shared. */
export function createNpcVehicleDriver(source: T.Group, asset: CollectionVehicle, carId: string): T.Group {
  const model = clone(source) as T.Group;
  const pose = new T.Group(); pose.add(model);
  pose.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(model);
  const height = box.max.y-box.min.y;
  if (!Number.isFinite(height) || height < .1) throw Error('Invalid driver height');
  model.scale.multiplyScalar(1.68/height);
  pose.updateMatrixWorld(true);
  const hips = pose.getObjectByName('Hips');
  if (!hips) throw Error('Expected the existing Chess human Hips rig');
  model.position.sub(hips.getWorldPosition(new T.Vector3()));
  pose.updateMatrixWorld(true);
  const ankleY = Math.max(.22, asset.driverSeat[1]-.42)-asset.driverSeat[1];
  for (const side of ['Left','Right'] as const) {
    const x = side==='Left' ? .11 : -.11;
    reach(pose,[`${side}UpLeg`,`${side}Leg`,`${side}Foot`],new T.Vector3(x,ankleY,.48),new T.Vector3(x,.08,.8));
    const foot=pose.getObjectByName(`${side}Foot`)!,toe=pose.getObjectByName(`${side}ToeBase`)!;
    aim(pose,foot,toe,foot.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,-.02,.2)));
    reach(pose,[`${side}Arm`,`${side}ForeArm`,`${side}Hand`],new T.Vector3(x*1.7,.25,.49),new T.Vector3(x*3.2,.02,.30));
  }
  // RPM faces +Z; the unchanged vehicle GLBs face +X.
  pose.rotation.y = Math.PI/2;
  const driver = new T.Group(); driver.add(pose);
  driver.name = `npc-driver:${carId}`;
  driver.position.fromArray(asset.driverSeat);
  driver.userData = {role:'npc-driver', carId, character:'chess-human', seated:true};
  driver.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  return driver;
}
