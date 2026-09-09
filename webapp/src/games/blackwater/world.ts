import {makeEnemy as makeOriginalEnemy,type ActorVisual} from './primitiveWorld';
export * from './primitiveWorld';
/** Preserve the operation's hitboxes, equipment, muzzle flash and AI interface.
 * The city renderer may replace only the primitive body with a shared game rig. */
export function makeEnemy():ActorVisual {
  const actor=makeOriginalEnemy();
  actor.group.userData.tiranaHumanId=actor.group.uuid;
  // The original factory's final four children are its three gun meshes + flash.
  for(const child of actor.group.children.slice(-4))child.userData.tiranaKeepEquipment=true;
  return actor;
}
