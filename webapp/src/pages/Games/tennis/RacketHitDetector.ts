import * as THREE from "three";
import { gameConfig } from "./gameConfig";

export type RacketContact = {
  racketHead: THREE.Vector3;
  racketGrip: THREE.Vector3;
  playerPos: THREE.Vector3;
  ballPos: THREE.Vector3;
  ballVel: THREE.Vector3;
  swingT: number;
  isServe?: boolean;
};

export class RacketHitDetector {
  static validate(c: RacketContact) {
    const radius = c.isServe ? gameConfig.racketHitRadius * 1.25 : gameConfig.racketHitRadius;
    const distance = c.ballPos.distanceTo(c.racketHead);
    const faceNormal = c.racketHead.clone().sub(c.racketGrip).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const incoming = c.ballVel.clone().normalize();
    const inFrontOfFace = c.isServe || faceNormal.lengthSq() < 0.01 || incoming.dot(faceNormal) <= 1 - gameConfig.contactAngleTolerance;
    const timingOk = c.isServe || (c.swingT >= gameConfig.timingWindow.start && c.swingT <= gameConfig.timingWindow.end);
    const heightOk = c.ballPos.y >= gameConfig.minContactHeight && c.ballPos.y <= gameConfig.maxContactHeight;
    const reachOk = c.playerPos.distanceTo(c.ballPos) <= gameConfig.maxReachDistance;
    const valid = distance <= radius && inFrontOfFace && timingOk && heightOk && reachOk;
    const timingQuality = c.isServe ? 1 : Math.max(0, 1 - Math.abs(c.swingT - 0.57) / 0.18);
    return { valid, distance, inFrontOfFace, timingOk, heightOk, reachOk, timingQuality };
  }
}
