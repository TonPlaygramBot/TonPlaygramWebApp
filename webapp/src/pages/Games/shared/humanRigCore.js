import * as THREE from 'three';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const UP = Y_AXIS;
const BASIS_MAT = new THREE.Matrix4();

const BASE_CFG = {
  poseLambda: 9,
  moveLambda: 5.6,
  rotLambda: 8.5,
  humanScale: 1.18,
  humanVisualYawFix: Math.PI,
  stanceWidth: 0.52,
  bridgePalmTableLift: 0.006,
  bridgeCueLift: 0.018,
  bridgeHandBackFromBall: 0.235,
  bridgeHandSide: -0.012,
  chinToCueHeight: 0.11,
  footGroundY: 0.035,
  footLockStrength: 1.0,
  kneeBendShot: 0.16,
  rightElbowShotRise: 0.18,
  rightElbowShotSide: -0.46,
  rightElbowShotBack: -0.78,
  rightForearmOutward: 0.36,
  rightForearmBack: 0.44,
  rightForearmDown: 0.48,
  rightForearmLength: 0.34,
  rightStrokePull: 0.30,
  rightStrokePush: 0.24,
  rightHandShotLift: -0.30,
  shootCueGripFromBack: 0.58,
  idleRightHandY: 0.8,
  idleRightHandX: 0.31,
  idleRightHandZ: -0.015,
  idleCueGripFromBack: 0.24,
  idleCueDir: new THREE.Vector3(0.055, 0.965, -0.13),
  rightHandRollIdle: -2.2,
  rightHandRollShoot: -2.05,
  rightHandDownPose: 0.42,
  rightHandCueSocketLocal: new THREE.Vector3(-0.004, -0.014, 0.092),
  edgeMargin: 0.58,
  desiredShootDistance: 1.06,
  strikeTime: 0.12,
  holdTime: 0.05,
  tableTopY: 0.84
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - ((1 - t) ** 3);
const easeInOut = (t) => t * t * (3 - 2 * t);
const dampScalar = (c, t, l, dt) => THREE.MathUtils.lerp(c, t, 1 - Math.exp(-l * dt));
const dampVector = (c, t, l, dt) => c.lerp(t, 1 - Math.exp(-l * dt));
const yawFromForward = (f) => Math.atan2(-f.x, -f.z);
const cleanName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function makeBasisQuaternion(side, up, forward) {
  BASIS_MAT.makeBasis(side.clone().normalize(), up.clone().normalize(), forward.clone().normalize());
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}
function findBone(all, aliases) { const list = all.map((bone) => ({ bone, name: cleanName(bone.name) })); for (const alias of aliases.map(cleanName)) { const m = list.find((x) => x.name === alias || x.name.endsWith(alias) || x.name.includes(alias)); if (m) return m.bone; } return undefined; }
function buildAvatarBones(model) { const all = []; model.traverse((o) => o?.isBone && all.push(o)); const f = (...n) => findBone(all, n); return { hips: f('hips','pelvis','mixamorigHips'), spine: f('spine','spine01','mixamorigSpine'), chest: f('spine2','chest','upperchest','mixamorigSpine2','mixamorigSpine1'), neck: f('neck','mixamorigNeck'), head: f('head','mixamorigHead'), leftUpperArm: f('leftupperarm','leftarm','upperarml','mixamorigLeftArm'), leftLowerArm: f('leftforearm','leftlowerarm','forearml','mixamorigLeftForeArm'), leftHand: f('lefthand','handl','mixamorigLeftHand'), rightUpperArm: f('rightupperarm','rightarm','upperarmr','mixamorigRightArm'), rightLowerArm: f('rightforearm','rightlowerarm','forearmr','mixamorigRightForeArm'), rightHand: f('righthand','handr','mixamorigRightHand'), leftUpperLeg: f('leftupleg','leftupperleg','leftthigh','mixamorigLeftUpLeg'), leftLowerLeg: f('leftleg','leftlowerleg','leftcalf','mixamorigLeftLeg'), leftFoot: f('leftfoot','footl','mixamorigLeftFoot'), rightUpperLeg: f('rightupleg','rightupperleg','rightthigh','mixamorigRightUpLeg'), rightLowerLeg: f('rightleg','rightlowerleg','rightcalf','mixamorigRightLeg'), rightFoot: f('rightfoot','footr','mixamorigRightFoot') }; }
const collectFingerBones = (hand) => { const out = []; hand?.traverse((o) => { if (!o?.isBone || o === hand) return; const n = cleanName(o.name); if (['thumb','index','middle','ring','pinky','little','finger'].some((s) => n.includes(s))) out.push(o); }); return out; };
function normalizeHuman(model, cfg) { model.scale.setScalar(cfg.humanScale); model.rotation.set(0, cfg.humanVisualYawFix, 0); model.position.set(0,0,0); model.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(model); const c = box.getCenter(new THREE.Vector3()); model.position.set(-c.x, -box.min.y, -c.z); }
function setBoneWorldQuaternion(bone, q) { if (!bone || !q) return; const p = new THREE.Quaternion(); bone.parent?.getWorldQuaternion(p); bone.quaternion.copy(p.invert().multiply(q)); bone.updateMatrixWorld(true); }
function firstBoneChild(bone) { return bone?.children.find((c) => c?.isBone); }
function rotateBoneToward(bone, target, strength = 1, fallbackDir = UP) { if (!bone || strength <= 0) return; const bp = bone.getWorldPosition(new THREE.Vector3()); const cp = firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) || bp.clone().addScaledVector(fallbackDir, 0.25); const current = cp.sub(bp).normalize(); const desired = target.clone().sub(bp); if (desired.lengthSq() < 1e-6) return; const delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()), clamp01(strength)); setBoneWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()))); }
const twistBone = (bone, axis, amount) => bone && Math.abs(amount) > 1e-5 && setBoneWorldQuaternion(bone, new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
const aimTwoBone = (u,l,e,h,p,us=0.96,ls=0.98) => { for(let i=0;i<4;i+=1){ rotateBoneToward(u,e,us,p); rotateBoneToward(l,h,ls,p);} };
function setHandBasis(bone, side, up, forward, roll = 0, strength = 1) { if (!bone) return; const q = makeBasisQuaternion(side, up, forward); if (Math.abs(roll) > 1e-4) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll)); setBoneWorldQuaternion(bone, bone.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength))); }
function cueSocketOffsetWorld(side, up, forward, roll, socketLocal) { const q = makeBasisQuaternion(side, up, forward); if (Math.abs(roll) > 1e-5) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll)); return socketLocal.clone().applyQuaternion(q); }
function poseFingers(fingers, mode, weight) {
  const w = clamp01(weight);
  fingers.forEach((finger, i) => {
    const n = cleanName(finger.name);
    const thumb = n.includes('thumb');
    const index = n.includes('index');
    const middle = n.includes('middle');
    const ring = n.includes('ring');
    const pinky = n.includes('pinky') || n.includes('little');
    const base = !(n.includes('2') || n.includes('3') || n.includes('intermediate') || n.includes('distal'));
    const mid = n.includes('2') || n.includes('intermediate');
    const tip = n.includes('3') || n.includes('distal');
    if (mode === 'idle') {
      finger.rotation.x += 0.018 * w;
      finger.rotation.z += 0.01 * w * (i % 2 ? -1 : 1);
      return;
    }
    if (mode === 'grip') {
      if (thumb) {
        finger.rotation.x += 0.48 * w;
        finger.rotation.y += -0.82 * w;
        finger.rotation.z += 0.54 * w;
        return;
      }
      const curl = index ? (base ? 0.58 : mid ? 0.9 : 0.68)
        : middle ? (base ? 0.76 : mid ? 1.02 : 0.76)
        : ring ? (base ? 0.72 : mid ? 0.92 : 0.7)
        : pinky ? (base ? 0.62 : mid ? 0.82 : 0.62)
        : 0;
      finger.rotation.x += curl * w;
      finger.rotation.y += (index ? -0.12 : middle ? -0.03 : ring ? 0.04 : pinky ? 0.08 : 0) * w;
      finger.rotation.z += (index ? -0.08 : middle ? -0.02 : ring ? 0.06 : pinky ? 0.12 : 0) * w;
      return;
    }
    if (thumb) {
      finger.rotation.x += -0.18 * w;
      finger.rotation.y += 0.95 * w;
      finger.rotation.z += -0.95 * w;
    } else if (index) {
      finger.rotation.x += (base ? 0.26 : mid ? 0.42 : 0.28) * w;
      finger.rotation.y += -0.46 * w;
      finger.rotation.z += -0.42 * w;
    } else if (middle) {
      finger.rotation.x += (base ? 0.18 : mid ? 0.32 : 0.22) * w;
      finger.rotation.y += -0.12 * w;
      finger.rotation.z += -0.14 * w;
    } else if (ring || pinky) {
      finger.rotation.x += (base ? (ring ? 0.08 : 0.05) : mid ? (ring ? 0.18 : 0.16) : tip ? (ring ? 0.12 : 0.1) : 0.1) * w;
      finger.rotation.y += (ring ? 0.18 : 0.34) * w;
      finger.rotation.z += (ring ? 0.28 : 0.46) * w;
    }
  });
}

export function createHumanRig(scene, opts = {}) {
  const cfg = { ...BASE_CFG, ...opts };
  const human = { root: new THREE.Group(), modelRoot: new THREE.Group(), model: null, bones: {}, leftFingers: [], rightFingers: [], restQuats: new Map(), activeGlb: false, poseT:0, walkT:0, yaw:0, breathT:0, settleT:0, strikeRoot:new THREE.Vector3(), strikeYaw:0, strikeClock:0, cfg };
  human.root.visible = false; human.modelRoot.visible = false; scene.add(human.root, human.modelRoot);
  const { loader, modelUrl } = opts;
  if (!loader || !modelUrl) return human;
  loader.setCrossOrigin?.('anonymous');
  loader.load(modelUrl, (gltf) => { const model = gltf?.scene; if (!model) return; normalizeHuman(model, cfg); model.traverse((o)=>{ if(!o?.isMesh) return; o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}); human.bones=buildAvatarBones(model); human.leftFingers=collectFingerBones(human.bones.leftHand); human.rightFingers=collectFingerBones(human.bones.rightHand); [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((b)=>b&&human.restQuats.set(b,b.quaternion.clone())); human.activeGlb=Boolean(human.bones.hips&&human.bones.spine&&human.bones.head&&human.bones.rightUpperArm&&human.bones.rightLowerArm&&human.bones.rightHand); human.model=model; human.modelRoot.add(model); human.modelRoot.visible=human.activeGlb; });
  return human;
}

function driveHuman(human, frame) { if (!human.activeGlb || !human.model) return; const cfg = human.cfg; human.modelRoot.visible=true; human.modelRoot.position.copy(frame.rootWorld); human.modelRoot.rotation.y=human.yaw; human.modelRoot.updateMatrixWorld(true); human.restQuats.forEach((q,b)=>b.quaternion.copy(q)); human.modelRoot.updateMatrixWorld(true);
  const b = human.bones; const ik = easeInOut(clamp01(frame.t)); const idle=1-ik; const cueDir = frame.cueTipWorld.clone().sub(frame.cueBackWorld).normalize(); const standingCueDir = cfg.idleCueDir.clone().applyAxisAngle(Y_AXIS, human.yaw).normalize();
  if (frame.walkAmount * idle > 0.001) {
    const s = Math.sin(human.walkT * 6.2);
    const c = Math.cos(human.walkT * 6.2);
    const w = frame.walkAmount * idle;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += s * 0.22 * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x -= s * 0.22 * w;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += Math.max(0, -s) * 0.18 * w;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += Math.max(0, s) * 0.18 * w;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x -= s * 0.2 * w;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += s * 0.2 * w;
    if (b.spine) b.spine.rotation.z += c * 0.02 * w;
    if (b.hips) b.hips.rotation.z -= c * 0.014 * w;
  }

  if (ik >= 0.025) {
    const shotQ = makeBasisQuaternion(frame.side, UP, frame.forward);
    rotateBoneToward(b.hips, frame.torsoCenterWorld, (0.12 + 0.35 * ik) * ik, frame.forward);
    twistBone(b.hips, frame.side, -0.045 * ik);
    twistBone(b.hips, frame.forward, -0.025 * ik);
    rotateBoneToward(b.spine, frame.chestCenterWorld, (0.34 + 0.34 * ik) * ik, frame.forward);
    twistBone(b.spine, frame.side, -0.2 * ik);
    twistBone(b.spine, frame.forward, -0.04 * ik);
    rotateBoneToward(b.chest, frame.neckWorld, (0.5 + 0.28 * ik) * ik, frame.forward);
    twistBone(b.chest, frame.side, -0.32 * ik);
    twistBone(b.chest, frame.forward, -0.025 * ik);
    rotateBoneToward(b.neck, frame.headCenterWorld, 0.64 * ik, frame.forward);
    twistBone(b.neck, frame.side, -0.12 * ik);
    setBoneWorldQuaternion(b.head, b.head ? b.head.getWorldQuaternion(new THREE.Quaternion()).slerp(shotQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(frame.side, -0.12 * ik)).multiply(new THREE.Quaternion().setFromAxisAngle(frame.forward, -0.025 * ik)), 0.74 * ik) : shotQ);
    human.modelRoot.updateMatrixWorld(true);
  }
  const rightGrip = frame.rightHandWorld.clone(); const rightIdleElbow = rightGrip.clone().addScaledVector(UP,0.04+0.14*ik).addScaledVector(frame.side,-0.2).addScaledVector(frame.forward,-0.03*idle); const rightElbow=frame.rightElbow.clone().lerp(rightIdleElbow,idle*0.5); const pole = frame.side.clone().multiplyScalar(-1).addScaledVector(UP,0.32).addScaledVector(frame.forward,-0.55).normalize(); aimTwoBone(b.rightUpperArm,b.rightLowerArm,rightElbow,rightGrip,pole,0.9+0.1*ik,1.0);
  const standingHandSide = frame.side.clone().multiplyScalar(-1).addScaledVector(UP,-0.55).addScaledVector(frame.forward,0.16).normalize(); const standingHandUp = UP.clone().multiplyScalar(-1).addScaledVector(frame.side,-0.64).addScaledVector(frame.forward,0.2).normalize(); const handForward = ik>=0.025 ? standingCueDir : cueDir; const roll = ik>=0.025 ? cfg.rightHandRollIdle : cfg.rightHandRollIdle + 0.02*frame.stroke; setHandBasis(b.rightHand, standingHandSide, standingHandUp, handForward, roll, 1.0); poseFingers(human.rightFingers,'grip',0.95);
  if (ik < 0.025) { poseFingers(human.leftFingers,'idle',1); return; }
  const leftHand = frame.leftHandWorld.clone().addScaledVector(frame.forward, 0.032 * ik).addScaledVector(frame.side, -0.018 * ik).addScaledVector(UP, -0.018 * ik); const leftElbow = frame.leftElbow.clone().addScaledVector(frame.forward, 0.045 * ik).addScaledVector(frame.side, -0.05 * ik).addScaledVector(UP, -0.01 * ik); aimTwoBone(b.leftUpperArm,b.leftLowerArm,leftElbow,leftHand,frame.side.clone().multiplyScalar(-1).addScaledVector(UP,0.1).normalize(),0.98*ik,1.0*ik);
  twistBone(b.leftUpperArm, frame.forward, -0.2 * ik);
  twistBone(b.leftLowerArm, frame.forward, 0.025 * ik);
  const bridgeSide = frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward,-0.52).normalize(); const bridgeUp = UP.clone().multiplyScalar(0.78).addScaledVector(frame.forward,-0.28).addScaledVector(frame.side,-0.16).normalize(); setHandBasis(b.leftHand, bridgeSide, bridgeUp, cueDir, -0.68*ik, 1.0*ik); poseFingers(human.leftFingers,'bridge',ik);
  aimTwoBone(b.leftUpperLeg, b.leftLowerLeg, frame.leftKnee, frame.leftFootWorld, frame.forward.clone().addScaledVector(UP, 0.18).normalize(), 0.9 * ik, 1.0 * ik);
  twistBone(b.leftUpperLeg, frame.forward, -0.035 * ik);
  setHandBasis(b.leftFoot, frame.side, frame.up, frame.forward, -0.02 * ik, cfg.footLockStrength * ik);
  aimTwoBone(b.rightUpperLeg, b.rightLowerLeg, frame.rightKnee, frame.rightFootWorld, frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.18).normalize(), 0.9 * ik, 1.0 * ik);
  twistBone(b.rightUpperLeg, frame.forward, 0.03 * ik);
  setHandBasis(b.rightFoot, frame.side, frame.up, frame.forward, 0.02 * ik, cfg.footLockStrength * ik);
}

export function updateHumanPose(human, dt, frameData){ if(!human||!frameData) return; const cfg=human.cfg; const state=frameData.state||'idle'; human.poseT=dampScalar(human.poseT,state==='idle'?0:1,cfg.poseLambda,dt); human.breathT+=dt*(state==='idle'?1.05:0.5); human.settleT=dampScalar(human.settleT,state==='dragging'?1:0,5.5,dt); if(state==='striking'){ if(human.strikeClock===0){ human.strikeRoot.copy(human.root.position.lengthSq()>0.001?human.root.position:frameData.rootTarget); human.strikeYaw=human.yaw;} human.strikeClock+=dt;} else human.strikeClock=0;
 const rootGoal=state==='striking'?human.strikeRoot:frameData.rootTarget; dampVector(human.root.position,rootGoal,state==='striking'?12:cfg.moveLambda,dt); const moveAmountRaw=human.root.position.distanceTo(rootGoal); human.walkT+=dt*(2+Math.min(7,moveAmountRaw*10)); human.yaw=dampScalar(human.yaw,state==='striking'?human.strikeYaw:yawFromForward(frameData.aimForward),cfg.rotLambda,dt);
 const t=easeInOut(human.poseT), idle=1-t; const breath=Math.sin(human.breathT*Math.PI*2)*(0.006+idle*0.004); const walk=Math.sin(human.walkT*6.2)*Math.min(1,moveAmountRaw*12); const walkAmount=clamp01(moveAmountRaw*18)*idle; const strikeFollow=state==='striking'?Math.sin(clamp01(human.strikeClock/(cfg.strikeTime+cfg.holdTime))*Math.PI):0; const powerLean=(frameData.power||0)*t; const forward = new THREE.Vector3(0,0,-1).applyAxisAngle(Y_AXIS,human.yaw).normalize(); const side = new THREE.Vector3(forward.z,0,-forward.x).normalize(); const local = (v)=>v.clone().applyAxisAngle(Y_AXIS,human.yaw).add(human.root.position);
 const rootWorld = human.root.position.clone().addScaledVector(forward, (0.018 * powerLean + 0.026 * strikeFollow)); rootWorld.y = 0;
 const torso = local(new THREE.Vector3(0, lerp(1.3,1.14,t)+breath, lerp(0.02,-0.16,t)-0.014*powerLean)); const chest=local(new THREE.Vector3(0,lerp(1.52,1.24,t)+breath,lerp(0.02,-0.42,t)-0.024*powerLean)); const neck=local(new THREE.Vector3(0,lerp(1.68,1.28,t)+breath,lerp(0.02,-0.61,t)-0.028*powerLean)); const head=local(new THREE.Vector3(0,lerp(1.84,1.37,t)+breath-cfg.chinToCueHeight*0.16*t,lerp(0.04,-0.72,t)-0.028*powerLean)); const leftShoulder=local(new THREE.Vector3(-0.23,lerp(1.58,1.36,t)+breath,lerp(0,-0.46,t)-0.018*human.settleT)); const rightShoulder=local(new THREE.Vector3(0.23,lerp(1.58,1.36,t)+breath,lerp(0,-0.34,t)-0.018*human.settleT));
 const leftHip=local(new THREE.Vector3(-0.13,0.92,0.02)); const rightHip=local(new THREE.Vector3(0.13,0.92,0.02)); const leftFoot=local(new THREE.Vector3(-0.13,cfg.footGroundY,0.03+walk*0.018).lerp(new THREE.Vector3(-cfg.stanceWidth*0.42,cfg.footGroundY,-0.34),t)); const rightFoot=local(new THREE.Vector3(0.13,cfg.footGroundY,-0.03-walk*0.018).lerp(new THREE.Vector3(cfg.stanceWidth*0.5,cfg.footGroundY,0.34),t));
 const bridgePalm = frameData.bridgeTarget.clone().addScaledVector(forward,-0.006*t).addScaledVector(side,-0.012*t).setY(cfg.tableTopY+cfg.bridgePalmTableLift).addScaledVector(UP, -0.01 * human.settleT); const leftHand = frameData.idleLeft.clone().lerp(bridgePalm,t); const cueDir = frameData.cueTip.clone().sub(frameData.cueBack).normalize(); const handIk=easeInOut(clamp01(t)); const idleGripSide=side.clone().multiplyScalar(-1).addScaledVector(UP,-0.55).addScaledVector(forward,0.16).normalize(); const idleGripUp=UP.clone().multiplyScalar(-1).addScaledVector(side,-0.64).addScaledVector(forward,0.2).normalize(); const liveGripSide=side.clone().multiplyScalar(-1).addScaledVector(UP,lerp(-0.55,-0.62,handIk)).addScaledVector(side,0.5*handIk).addScaledVector(forward,lerp(0.16,-0.08,handIk)).normalize(); const liveGripUp=UP.clone().multiplyScalar(lerp(-1.0,0.12,handIk)).addScaledVector(side,lerp(-0.64,-0.04,handIk)).addScaledVector(forward,lerp(0.2,-0.48,handIk)).normalize();
 const lockedRightElbow = rightShoulder.clone().addScaledVector(UP, lerp(0.04,cfg.rightElbowShotRise,t)).addScaledVector(side,lerp(-0.18,cfg.rightElbowShotSide,t)).addScaledVector(forward,lerp(-0.04,cfg.rightElbowShotBack,t)); const pullBack = state==='dragging' ? -cfg.rightStrokePull*easeOutCubic(frameData.power||0) : 0; const push = state==='striking' ? cfg.rightStrokePush*Math.sin(clamp01(human.strikeClock/(cfg.strikeTime+cfg.holdTime))*Math.PI):0; const forearmBase = lockedRightElbow.clone().addScaledVector(side,cfg.rightForearmOutward*t).addScaledVector(UP,-cfg.rightForearmDown*t).addScaledVector(UP,cfg.rightHandShotLift*t).addScaledVector(forward,-cfg.rightForearmBack*t).addScaledVector(cueDir,cfg.rightForearmLength); const liveGripPoint = forearmBase.clone().addScaledVector(cueDir,pullBack+push); const idleWrist=frameData.idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide,idleGripUp,cueDir,cfg.rightHandRollIdle,cfg.rightHandCueSocketLocal)); const liveWrist=liveGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide,liveGripUp,cueDir,lerp(cfg.rightHandRollIdle,cfg.rightHandRollShoot-cfg.rightHandDownPose,handIk),cfg.rightHandCueSocketLocal));
 const rightHand = idleWrist.clone().lerp(liveWrist,t); const leftElbow = leftShoulder.clone().lerp(leftHand,0.62); const leftKnee = leftHip.clone().lerp(leftFoot,0.53).addScaledVector(UP,lerp(0.2,cfg.kneeBendShot,t)); const rightKnee = rightHip.clone().lerp(rightFoot,0.52).addScaledVector(UP,lerp(0.2,cfg.kneeBendShot*0.88,t));
 human.root.visible=true; driveHuman(human,{t,stroke:pullBack+push,walkAmount,forward,side,up:UP,rootWorld,torsoCenterWorld:torso,chestCenterWorld:chest,neckWorld:neck,headCenterWorld:head,leftElbow,rightElbow:lockedRightElbow,leftHandWorld:leftHand,rightHandWorld:rightHand,leftKnee,rightKnee,leftFootWorld:leftFoot,rightFootWorld:rightFoot,cueBackWorld:frameData.cueBack,cueTipWorld:frameData.cueTip});
}

export function chooseHumanEdgePosition(cueBallWorld, aimForward, opts = {}) { const cfg = { ...BASE_CFG, ...opts }; const desired = cueBallWorld.clone().addScaledVector(aimForward, -cfg.desiredShootDistance); const xEdge = (opts.tableW ?? 2.0)/2 + cfg.edgeMargin; const zEdge = (opts.tableL ?? 3.6)/2 + cfg.edgeMargin; const c=[new THREE.Vector3(-xEdge,0,clamp(desired.z,-zEdge,zEdge)),new THREE.Vector3(xEdge,0,clamp(desired.z,-zEdge,zEdge)),new THREE.Vector3(clamp(desired.x,-xEdge,xEdge),0,-zEdge),new THREE.Vector3(clamp(desired.x,-xEdge,xEdge),0,zEdge)]; return c.sort((a,b)=>a.distanceToSquared(desired)-b.distanceToSquared(desired))[0].clone(); }
