import * as THREE from "three";
import { clamp, clamp01, gameConfig, lerp, PlayerSide, ServeSide, ShotTechnique } from "./gameConfig";

export type AIPrediction = { landing: THREE.Vector3; t: number; descending: boolean };

export class AIController {
  mistakeRoll() { return Math.random() < gameConfig.aiDifficulty.mistakeChance; }

  predictLanding(pos: THREE.Vector3, vel: THREE.Vector3, spin = 0): AIPrediction {
    const p = pos.clone();
    const v = vel.clone();
    const dt = 1 / 90;
    for (let i = 0; i < 220; i++) {
      v.y -= gameConfig.gravity * (1 + spin * 0.18) * dt;
      v.multiplyScalar(Math.exp(-gameConfig.airDrag * dt));
      p.addScaledVector(v, dt);
      if (p.y <= gameConfig.ballR) return { landing: p.setY(gameConfig.ballR), t: i * dt, descending: v.y < 0 };
    }
    return { landing: p, t: 220 * dt, descending: v.y < 0 };
  }

  chooseReturnTarget(opponentPos: THREE.Vector3, ballPos: THREE.Vector3, ballVel: THREE.Vector3) {
    const pressure = clamp01((Math.abs(ballPos.z) - gameConfig.serviceLineZ * 0.25) / (gameConfig.courtL / 2 - 0.8));
    const opponentOpenCourt = opponentPos.x >= 0 ? -1 : 1;
    const ballWide = Math.abs(ballPos.x) > gameConfig.courtW * 0.3;
    const xBase = ballWide ? -Math.sign(ballPos.x || 1) * gameConfig.courtW * 0.34 : opponentOpenCourt * gameConfig.courtW * 0.28;
    const x = clamp(
      xBase + clamp(ballVel.x * 0.12, -0.34, 0.34) + (Math.random() - 0.5) * (1 - gameConfig.aiDifficulty.accuracy) * 0.9,
      -gameConfig.courtW / 2 + 0.55,
      gameConfig.courtW / 2 - 0.55
    );
    const z = lerp(gameConfig.serviceLineZ * 0.42, gameConfig.courtL / 2 - 1.05, 0.36 + pressure * 0.54);
    const roll = Math.random();
    const technique: ShotTechnique = pressure > 0.72 ? "topspin" : roll > 0.9 ? "lob" : roll > 0.7 ? "slice" : "flat";
    return { target: new THREE.Vector3(x, gameConfig.ballR, z), power: clamp(0.6 + pressure * 0.32 + gameConfig.aiDifficulty.power * 0.18, gameConfig.shotPower.min + 0.24, gameConfig.shotPower.max), technique };
  }

  chooseServeTarget(side: ServeSide, server: PlayerSide = "far") {
    const targetZ = server === "far"
      ? lerp(1.25 * gameConfig.worldScale, gameConfig.serviceLineZ - 0.75 * gameConfig.worldScale, 0.58)
      : -lerp(1.25 * gameConfig.worldScale, gameConfig.serviceLineZ - 0.75 * gameConfig.worldScale, 0.58);
    const laneSign = side === "deuce" ? (server === "far" ? -1 : 1) : (server === "far" ? 1 : -1);
    const targetX = laneSign * lerp(gameConfig.courtW * 0.16, gameConfig.courtW * 0.36, Math.random());
    return {
      target: new THREE.Vector3(targetX, gameConfig.ballR, targetZ),
      power: clamp(0.74 + gameConfig.aiDifficulty.serveQuality * 0.18 + Math.random() * 0.04, gameConfig.servePower.min + 0.1, gameConfig.servePower.max),
      technique: "topspin" as ShotTechnique,
    };
  }
}
