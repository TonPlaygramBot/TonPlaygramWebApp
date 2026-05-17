import * as THREE from 'three';
import { GAME_CONFIG } from './gameConfig';

export class CameraController {
  private desired = new THREE.Vector3();
  private target = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {
    this.camera.position.copy(GAME_CONFIG.camera.position);
  }

  update(dt: number, ballPosition: THREE.Vector3, playerPosition: THREE.Vector3) {
    const nearPlayer = ballPosition.z > 0.85;
    const lateralOffset = nearPlayer ? THREE.MathUtils.clamp((ballPosition.x - playerPosition.x) * 0.48, -0.3, 0.3) : 0;
    const lift = nearPlayer ? 0.14 : 0;
    this.desired.set(lateralOffset, GAME_CONFIG.camera.position.y + lift, GAME_CONFIG.camera.position.z);
    this.target.set(ballPosition.x * 0.12, GAME_CONFIG.camera.target.y + ballPosition.y * 0.07, GAME_CONFIG.camera.target.z);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-GAME_CONFIG.camera.damping * dt));
    this.camera.lookAt(this.target);
  }
}
