import * as THREE from 'three';
import { GAME_CONFIG } from './gameConfig';

export class CameraController {
  private desired = new THREE.Vector3();
  private target = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {
    this.camera.position.copy(GAME_CONFIG.camera.position);
  }

  update(dt: number, ballPosition: THREE.Vector3, playerPosition: THREE.Vector3) {
    const nearPlayer = ballPosition.z > GAME_CONFIG.table.length * 0.21;
    const lateralClamp = GAME_CONFIG.table.width * 0.115;
    const lateralOffset = nearPlayer ? THREE.MathUtils.clamp((ballPosition.x - playerPosition.x) * 0.55, -lateralClamp, lateralClamp) : 0;
    this.desired.set(lateralOffset, GAME_CONFIG.camera.position.y + (nearPlayer ? GAME_CONFIG.table.topY * 0.237 : 0), GAME_CONFIG.camera.position.z);
    this.target.set(ballPosition.x * 0.14, GAME_CONFIG.camera.target.y + ballPosition.y * 0.08, GAME_CONFIG.camera.target.z);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-GAME_CONFIG.camera.damping * dt));
    this.camera.lookAt(this.target);
  }
}
