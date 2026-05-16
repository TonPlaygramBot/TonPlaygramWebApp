import * as THREE from "three";
import { clamp, clamp01, gameConfig, lerp, PlayerSide, ServeSide, ShotTechnique } from "./gameConfig";

export type AIPrediction = { landing: THREE.Vector3; t: number; descending: boolean };
export type AIIntercept = AIPrediction & { contact: THREE.Vector3; contactT: number; postBounce: boolean; reachable: boolean };

type ReturnContext = {
  receiverPos?: THREE.Vector3;
  prediction?: AIPrediction;
  hasBounced?: boolean;
};

const COURT_EDGE_PADDING = 0.55;

export class AIController {
  mistakeRoll(pressure = 0) {
    const pressureBonus = clamp01(pressure) * 0.012;
    return Math.random() < gameConfig.aiDifficulty.mistakeChance + pressureBonus;
  }

  predictLanding(pos: THREE.Vector3, vel: THREE.Vector3, spin = 0): AIPrediction {
    const p = pos.clone();
    const v = vel.clone();
    const dt = 1 / 90;
    for (let i = 0; i < 260; i++) {
      v.y -= gameConfig.gravity * (1 + Math.max(0, spin) * 0.18 - Math.max(0, -spin) * 0.07) * dt;
      v.z += Math.sign(v.z || 1) * Math.abs(spin) * 0.08 * gameConfig.worldScale * dt;
      v.x += Math.sin(spin * 0.72) * 0.024 * gameConfig.worldScale * dt;
      v.multiplyScalar(Math.exp(-gameConfig.airDrag * dt));
      spin *= Math.exp(-1.05 * dt);
      p.addScaledVector(v, dt);
      if (p.y <= gameConfig.ballR) return { landing: p.setY(gameConfig.ballR), t: i * dt, descending: v.y < 0 };
    }
    return { landing: p, t: 260 * dt, descending: v.y < 0 };
  }

  predictIntercept(pos: THREE.Vector3, vel: THREE.Vector3, spin = 0, receiverPos = new THREE.Vector3()): AIIntercept {
    const p = pos.clone();
    const v = vel.clone();
    const dt = 1 / 90;
    let firstLanding = p.clone();
    let firstLandingT = 0;
    let foundLanding = false;
    let postBounce = false;
    const contactMin = gameConfig.minContactHeight * 0.85;
    const contactMax = gameConfig.maxContactHeight * 1.06;

    for (let i = 0; i < 300; i++) {
      v.y -= gameConfig.gravity * (1 + Math.max(0, spin) * 0.18 - Math.max(0, -spin) * 0.07) * dt;
      v.z += Math.sign(v.z || 1) * Math.abs(spin) * 0.08 * gameConfig.worldScale * dt;
      v.x += Math.sin(spin * 0.72) * 0.024 * gameConfig.worldScale * dt;
      v.multiplyScalar(Math.exp(-gameConfig.airDrag * dt));
      spin *= Math.exp(-1.05 * dt);
      p.addScaledVector(v, dt);
      const t = i * dt;

      if (p.y <= gameConfig.ballR && v.y < 0) {
        if (!foundLanding) {
          firstLanding = p.clone().setY(gameConfig.ballR);
          firstLandingT = t;
          foundLanding = true;
        }
        p.y = gameConfig.ballR;
        const pace = Math.hypot(v.x, v.z);
        v.y = Math.abs(v.y) * gameConfig.bounceRestitution * clamp(1 - pace / (42 * gameConfig.worldScale), 0.82, 1);
        v.x *= gameConfig.groundFriction;
        v.z *= gameConfig.groundFriction;
        spin *= -0.42;
        postBounce = true;
      }

      const onAiSide = p.z < -gameConfig.serviceBuffer * 0.5;
      const hittableHeight = p.y >= contactMin && p.y <= contactMax;
      const courtX = Math.abs(p.x) <= gameConfig.courtW / 2 + gameConfig.worldScale;
      if (onAiSide && hittableHeight && courtX && v.z <= gameConfig.worldScale * 2.4) {
        const contact = p.clone();
        const targetFoot = new THREE.Vector3(
          clamp(contact.x, -gameConfig.courtW / 2 + COURT_EDGE_PADDING, gameConfig.courtW / 2 - COURT_EDGE_PADDING),
          receiverPos.y,
          clamp(contact.z + 0.28 * gameConfig.worldScale, -gameConfig.courtL / 2 - 0.85 * gameConfig.worldScale, -0.82 * gameConfig.worldScale)
        );
        const travel = receiverPos.distanceTo(targetFoot);
        const reachable = travel <= gameConfig.aiDifficulty.moveSpeed * Math.max(0.06, t + 0.2) + gameConfig.aiDifficulty.reachRadius * 0.42;
        return { landing: foundLanding ? firstLanding : contact.clone().setY(gameConfig.ballR), t: foundLanding ? firstLandingT : t, descending: v.y < 0, contact, contactT: t, postBounce, reachable };
      }
    }

    return {
      landing: foundLanding ? firstLanding : p.clone(),
      t: foundLanding ? firstLandingT : 300 * dt,
      descending: v.y < 0,
      contact: foundLanding ? firstLanding.clone().setY(gameConfig.minContactHeight) : p,
      contactT: foundLanding ? firstLandingT + 0.28 : 300 * dt,
      postBounce,
      reachable: false,
    };
  }

  chooseReturnTarget(opponentPos: THREE.Vector3, ballPos: THREE.Vector3, ballVel: THREE.Vector3, context: ReturnContext = {}) {
    const prediction = context.prediction ?? this.predictLanding(ballPos, ballVel);
    const landing = prediction.landing;
    const receiverX = context.receiverPos?.x ?? 0;
    const pressure = clamp01((Math.abs(ballPos.z) - gameConfig.serviceLineZ * 0.2) / (gameConfig.courtL / 2 - 0.65));
    const stretched = clamp01((Math.abs(ballPos.x - receiverX) - gameConfig.reach * 0.38) / (gameConfig.courtW * 0.42));
    const opponentOpenCourt = opponentPos.x >= 0 ? -1 : 1;
    const ballWide = Math.abs(landing.x) > gameConfig.courtW * 0.28 || Math.abs(ballPos.x) > gameConfig.courtW * 0.3;
    const opponentDeep = opponentPos.z > gameConfig.serviceLineZ * 0.58;
    const attackable = pressure > 0.5 && stretched < 0.62 && ballPos.y > gameConfig.minContactHeight * 1.08;

    let xBase = ballWide
      ? -Math.sign(landing.x || ballPos.x || 1) * gameConfig.courtW * 0.36
      : opponentOpenCourt * gameConfig.courtW * (attackable ? 0.34 : 0.24);
    if (Math.abs(opponentPos.x) > gameConfig.courtW * 0.24) xBase = -Math.sign(opponentPos.x) * gameConfig.courtW * 0.36;

    const shortReply = stretched > 0.68 || (opponentDeep && Math.random() > 0.62);
    const zDepth = shortReply
      ? lerp(gameConfig.serviceLineZ * 0.2, gameConfig.serviceLineZ * 0.78, Math.random())
      : lerp(gameConfig.serviceLineZ * 0.5, gameConfig.courtL / 2 - 0.9 * gameConfig.worldScale, 0.34 + pressure * 0.58);
    const x = clamp(
      xBase + clamp(ballVel.x * 0.08, -0.28 * gameConfig.worldScale, 0.28 * gameConfig.worldScale) + (Math.random() - 0.5) * (1 - gameConfig.aiDifficulty.accuracy) * gameConfig.worldScale,
      -gameConfig.courtW / 2 + COURT_EDGE_PADDING,
      gameConfig.courtW / 2 - COURT_EDGE_PADDING
    );

    const roll = Math.random();
    let technique: ShotTechnique = "flat";
    if (shortReply) technique = stretched > 0.66 ? "block" : "drop";
    else if (stretched > 0.74) technique = "slice";
    else if (attackable && roll > 0.22) technique = "topspin";
    else if (opponentPos.z < gameConfig.serviceLineZ * 0.28 && roll > 0.72) technique = "lob";
    else if (roll > 0.76) technique = "slice";

    const controlledPower = shortReply ? 0.38 : attackable ? 0.66 : 0.52;
    const power = clamp(
      controlledPower + pressure * 0.13 + (1 - stretched) * 0.08 + gameConfig.aiDifficulty.power * 0.08,
      gameConfig.shotPower.min,
      gameConfig.shotPower.max
    );

    return { target: new THREE.Vector3(x, gameConfig.ballR, zDepth), power, technique };
  }

  chooseServeTarget(side: ServeSide, server: PlayerSide = "far") {
    const targetZ = server === "far"
      ? lerp(1.25 * gameConfig.worldScale, gameConfig.serviceLineZ - 0.75 * gameConfig.worldScale, 0.58)
      : -lerp(1.25 * gameConfig.worldScale, gameConfig.serviceLineZ - 0.75 * gameConfig.worldScale, 0.58);
    const laneSign = side === "deuce" ? (server === "far" ? -1 : 1) : (server === "far" ? 1 : -1);
    const targetX = laneSign * lerp(gameConfig.courtW * 0.16, gameConfig.courtW * 0.36, Math.random());
    const technique: ShotTechnique = Math.random() > 0.42 ? "topspin" : "slice";
    return {
      target: new THREE.Vector3(targetX, gameConfig.ballR, targetZ),
      power: clamp(0.58 + gameConfig.aiDifficulty.serveQuality * 0.16 + Math.random() * 0.035, gameConfig.servePower.min, gameConfig.servePower.max),
      technique,
    };
  }

}
