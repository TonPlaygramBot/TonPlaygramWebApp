import * as THREE from "three";
import { clamp, clamp01, gameConfig, lerp, ShotTechnique } from "./gameConfig";

export class AIController {
  mistakeRoll() { return Math.random() < gameConfig.aiDifficulty.mistakeChance; }
  chooseTarget(nearPos: THREE.Vector3, ballPos: THREE.Vector3, ballVel: THREE.Vector3) {
    const pressure = clamp01((Math.abs(ballPos.z) - 0.6) / (gameConfig.courtL / 2 - 0.8));
    const attackToOpen = Math.abs(ballPos.x) > gameConfig.courtW * 0.32 ? -Math.sign(ballPos.x || 1) * (gameConfig.courtW * 0.36) : nearPos.x * 0.72;
    const x = clamp(attackToOpen + clamp(ballVel.x * 0.26, -0.5, 0.5) + (Math.random() - 0.5) * (1 - gameConfig.aiDifficulty.accuracy) * 1.4, -gameConfig.courtW / 2 + 0.35, gameConfig.courtW / 2 - 0.35);
    const z = lerp(1.2, gameConfig.courtL / 2 - 0.7, 0.42 + pressure * 0.5);
    const roll = Math.random();
    const technique: ShotTechnique = pressure > 0.72 ? "topspin" : roll > 0.82 ? "lob" : roll > 0.62 ? "slice" : "flat";
    return { target: new THREE.Vector3(x, gameConfig.ballR, z), power: clamp(0.56 + pressure * 0.42 + gameConfig.aiDifficulty.power * 0.2, 0.5, 1), technique };
  }
}
