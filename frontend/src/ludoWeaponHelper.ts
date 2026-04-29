import * as THREE from 'three';

export type GripMode = 'one-hand' | 'two-hand';

export type GripConfig = {
  muzzleLocal: THREE.Vector3;
  rightHandOffset: THREE.Vector3;
  leftHandOffset: THREE.Vector3;
  mode: GripMode;
};

export class WeaponGripHelper {
  private tmp = new THREE.Vector3();

  alignWeaponToTarget(weapon: THREE.Object3D, targetWorld: THREE.Vector3) {
    const origin = weapon.getWorldPosition(this.tmp);
    const dir = targetWorld.clone().sub(origin).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    weapon.quaternion.slerp(q, 0.22);
  }

  attachHands(
    weapon: THREE.Object3D,
    rightHand: THREE.Object3D | null,
    leftHand: THREE.Object3D | null,
    cfg: GripConfig
  ) {
    if (rightHand) {
      rightHand.position.copy(cfg.rightHandOffset);
      rightHand.rotation.set(0, Math.PI, 0);
      weapon.add(rightHand);
    }

    if (leftHand) {
      leftHand.visible = cfg.mode === 'two-hand';
      leftHand.position.copy(cfg.leftHandOffset);
      leftHand.rotation.set(0, Math.PI, 0);
      weapon.add(leftHand);
    }
  }
}
