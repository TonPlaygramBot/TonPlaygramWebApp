// @ts-nocheck -- Preserve source-extracted production JavaScript bodies byte for byte.
/**
 * Production Domino Royal motion logic, extracted by Babel AST.
 * Only this dependency-injection wrapper is preview-specific; the named
 * production functions below are unmodified source, with hashes for parity.
 * All hand targets, reach/grip timing, palm physics and collision resolution
 * therefore use the same implementation as public/domino-royal-game.js.
 */
import * as DefaultTHREE from 'three';
import * as P from './domino-royal-motion-helpers';

export const PRODUCTION_MOTION_SOURCE = Object.freeze({
  path: 'webapp/public/domino-royal-game.js',
  sha256: '0ee6e772de20577cb5dbb45fc286fa12316064f7b7befbe2dd039077f23727fc',
  functions: Object.freeze({
  "runSeatedHumanDominoAction": "12ff2a1c125031fae24cddccdc5e0f779cf34aa2e451b9f982c5ffdb1aecf39e",
  "getDominoHumanReachProfile": "c4097ce1541770bd1c8db613329978f37b05311f8101d7a53c615ae2cbfc18fa",
  "dominoSurfaceTarget": "82991064c2a9a100414bc7a9a29bd6e86dc533fb6fe2e8e5f17899eba1c12987",
  "dominoPickupTarget": "9265c8e2a05d1ac485be7e46bf4f0112fbe35980a47d1df4ff04335714e844ef",
  "blendDominoHandTargetFrame": "a10b999efbe86b760c19a6be583b5c670cdba14b55392ae6550286efcb5ab529",
  "resolveDominoHandWithdrawalPosition": "69416720b690db6941d5c7d1b408e82d6dc7ef5b1064a919fcd6fbdb81a38ec3",
  "getDominoRackTargets": "f2fc5992e79de6b36180c7c48ece0ee710803fb2d09f605305cdc6f9da5077e6",
  "poseDominoHands": "212c18cf892111b8b6985dcd766c3ecbc4677334afa5bae542469d83b2890ee6",
  "updateDominoIdleHands": "c2c453c26b2ff42f35deb0fae5e8745c7f321a857ce529f2de2c21e66de2630d",
  "poseDominoShuffleHands": "79c14e4db67c9a24c5e852dc3fab18724f596c3e5803c3d2bc3bd971c62878b3",
  "updateSeatedHumanDominoAction": "33057f65c2ed30f4aa892dba9c8b488addeca953730b56d9ed86ab260bea5877",
  "orientDominoFlat": "86dcb55a718137f3883a8ca616a1c47608015766b130a938557ea82ce959b472",
  "orientDominoFaceDown": "45d343759a6e611739d698aa740ce6143ce1d2cf8cd236a9f924b4a9334f7e4d",
  "shuffle": "09eba5674f88551d621d9662818b0f5d325c086944f7d2cce1891be0ca605b50",
  "spawnOpeningShuffleAnimation": "4b4d947f32a2ac5f3fd65d9e8ea002155b5a0803d588e4146ee057f0ced11eee",
  "updateDominoShuffleTiles": "14c65d3fc83cf4c1554a6b7809cdc4309a44ac082a0d4b5b2a1f1a17a76f95b0",
  "updateKnockAnimations": "fdd6cbe5ada9815ec494218e2179e8eb8bb7da9e2f68a84044b239e7936ec88b",
  "updateDrawDestination": "d7020f319867e2935e0f1b86be8682e5f6a111be8b74007ad2f476ff792e6cc9",
  "spawnDrawAnimation": "0610b6628186e1fc535f7b93c058236872f62cdb138c27fdcb98d5eb06d7f53d",
  "updateDrawAnimations": "2225b7b5468c5b8e8576f9455a6165d30b3b21faa037fc63b349835e4a12076a",
  "sampleDominoActionProgress": "d6c825347e3f695fc6a4eb56eb3ca01de0f2893b9aa196774542a33e8de02646",
  "revealPlacementFace": "14511384625dac02120f8212fa8c8e0e2cc30d53009cb69e55a06944c5cef1fc",
  "updatePlacementAnimations": "9c5a81f5558e18950c67bda9847a53062c91b42ccdb98642968970185f86e0ae"
})
});

export interface ProductionDominoMotionEnvironment {
  THREE?: typeof DefaultTHREE;
  piecesG: DefaultTHREE.Group;
  players: Array<any>;
  chairs: Array<DefaultTHREE.Object3D>;
  seatedHumanActors: Array<any>;
  DOMINO_SEATED_HUMANS: {
    applySeatedHumanPose?: (...args: any[]) => any;
    applySeatedHumanReachPose?: (...args: any[]) => any;
    applySeatedHumanHandTargets?: (...args: any[]) => any;
  };
  dominoHandContacts?: Map<number, any>;
  openingSequence?: any;
  placementAnimations?: Array<any>;
  drawAnimations?: Array<any>;
  knockAnimations?: Array<any>;
  activeHandMeshes?: Set<any>;
  boneyard?: Array<any>;
  human?: number;
  N?: number;
  cameraViewMode?: '2d' | '3d';
  dominoMotionTime?: number;
  gameFinished?: boolean;
  /** Required only when calling methods that create a domino mesh. */
  makeDomino?: (...args: any[]) => DefaultTHREE.Object3D;
  /** Preview lifecycle hooks and optional shared-rig instrumentation. */
  [key: string]: any;
}

/**
 * Mutate env.players, env.openingSequence or its arrays before a method call;
 * each entry refreshes its closure from that same environment. Production
 * sequence replacements are written back to env when the method finishes.
 * Disposal defaults to removal from the scene, keeping shared preview meshes
 * reusable for scrubbing. Supply lifecycle callbacks for their UI effects.
 */
export function createProductionDominoMotion(env: ProductionDominoMotionEnvironment) {
  const THREE = env.THREE || DefaultTHREE;
  const { DOMINO_HAND_RETURN_DURATION, CLOTH_RADIUS, CLOTH_TOP, DOMINO_WIDTH, DOMINO_LENGTH, DOMINO_WORLD_SCALE, DRAW_ANIM_DURATION, KNOCK_CONTACT_PHASE, KNOCK_DURATION, OPENING_DEAL_ANIM_DURATION, PLACE_ANIM_ARC, PLACE_ANIM_CARRY_END, PLACE_ANIM_DURATION, PLACE_ANIM_LIFT_END, PLACE_ANIM_LOWER_END, PLACE_ANIM_PICK_HOLD } = P;
  const { layoutSeat, smoothPlacementStep, resolvePrecisionPlacementPosition } = P;
  const noop = () => {};
  env.openingSequence ??= null;
  env.placementAnimations ??= [];
  env.drawAnimations ??= [];
  env.knockAnimations ??= [];
  env.activeHandMeshes ??= new Set();
  env.dominoHandContacts ??= new Map();
  env.boneyard ??= [];
  let piecesG, players, chairs, seatedHumanActors, DOMINO_SEATED_HUMANS;
  let openingSequence, placementAnimations, drawAnimations, knockAnimations;
  let activeHandMeshes, dominoHandContacts, boneyard, human, N;
  let cameraViewMode, dominoMotionTime, gameFinished;
  const VIEW_MODES = Object.freeze({ threeD: '3d', twoD: '2d' });
  function syncFromEnvironment() {
    ({ piecesG, players, chairs, seatedHumanActors, DOMINO_SEATED_HUMANS,
      openingSequence, placementAnimations, drawAnimations, knockAnimations,
      activeHandMeshes, dominoHandContacts, boneyard } = env);
    human = env.human ?? 0;
    N = env.N ?? 4;
    cameraViewMode = env.cameraViewMode ?? VIEW_MODES.threeD;
    dominoMotionTime = env.dominoMotionTime ?? 0;
    gameFinished = env.gameFinished ?? false;
  }
  const getVisualSeatIndex = (seat) => P.getVisualSeatIndex(seat, { human, playerCount: N });
  const getDominoHandScale = (seat, count) => P.getDominoHandScale(seat, count, { human });
  const computeHandSlotPosition = (seat, slot, count, options = {}) =>
    P.computeHandSlotPosition(seat, slot, count, { ...options, human, playerCount: N });
  const callback = (name) => (...args) => (env[name] || noop)(...args);
  const makeDomino = (...args) => {
    if (!env.makeDomino) throw new Error('Production motion mesh creation requires env.makeDomino.');
    return env.makeDomino(...args);
  };
  const disposeDominoMesh = (mesh) => env.disposeDominoMesh ? env.disposeDominoMesh(mesh) : mesh?.removeFromParent();
  const setStatus = callback('setStatus');
  const renderBoneyardStack = callback('renderBoneyardStack');
  const refreshDominoControls = callback('refreshDominoControls');
  const showPassBubble = callback('showPassBubble');
  const nextTurn = callback('nextTurn');
  const flushPendingDominoState = callback('flushPendingDominoState');
  const renderHands = callback('renderHands');
  const renderChain = callback('renderChain');
  const SFX = {
    pass: (...args) => (env.SFX?.pass || noop)(...args),
    drawTile: (...args) => (env.SFX?.drawTile || noop)(...args),
    place: (...args) => (env.SFX?.place || noop)(...args)
  };
  const DOMINO_UP = new THREE.Vector3(0, 1, 0);
  const DOMINO_FORWARD = new THREE.Vector3();
  const DOMINO_RIGHT = new THREE.Vector3();
  const DOMINO_BASIS = new THREE.Matrix4();

  // BEGIN exact production function extracts.
function runSeatedHumanDominoAction(
  logicalSeatIndex,
  mode = 'placePiece',
  intensity = 1,
  grip = 0,
  motionProfile = null
) {
  const visualSeatIndex = getVisualSeatIndex(logicalSeatIndex);
  const restoredHuman = seatedHumanActors[visualSeatIndex];
  const applyPose = DOMINO_SEATED_HUMANS?.applySeatedHumanPose;
  if (!restoredHuman?.rig || !applyPose) return;
  applyPose(restoredHuman.rig, mode, intensity, grip, motionProfile);
}

function getDominoHumanReachProfile(anim) {
  const chair = chairs[getVisualSeatIndex(anim.sourceSeat)];
  if (!chair) return { forwardReach: 0.5, sideReach: 0 };
  piecesG.updateWorldMatrix(true, false);
  chair.updateWorldMatrix(true, false);
  const localTarget = chair.worldToLocal(piecesG.localToWorld(anim.end.clone()));
  return {
    forwardReach: THREE.MathUtils.clamp((-localTarget.z - 0.25) / 1.5, 0, 1),
    sideReach: THREE.MathUtils.clamp(localTarget.x / 1.25, -1, 1)
  };
}

function dominoSurfaceTarget(mesh, side = 1, grip = 0.4) {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.localToWorld(new THREE.Vector3(side * 0.5, -0.08, 0));
  const rotation = mesh.getWorldQuaternion(new THREE.Quaternion());
  const palmNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
  const tableDown = new THREE.Vector3(0, -1, 0).transformDirection(piecesG.matrixWorld);
  if (Math.abs(palmNormal.dot(tableDown)) > 0.65) palmNormal.copy(tableDown);
  return {
    position, grip, gripMode: 'support',
    approachDirection: new THREE.Vector3(-side, 0, 0).applyQuaternion(rotation),
    palmNormal,
    surfaceNormal: new THREE.Vector3(side, 0, 0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld))
  };
}

function dominoPickupTarget(mesh, edge, grip) {
  let target;
  if (edge < 2) target = dominoSurfaceTarget(mesh, edge === 0 ? -1 : 1, grip);
  else {
    mesh.updateWorldMatrix(true, false);
    const sign = edge === 2 ? -1 : 1;
    const rotation = mesh.getWorldQuaternion(new THREE.Quaternion());
    target = {
      position: mesh.localToWorld(new THREE.Vector3(0, sign, 0)), grip,
      approachDirection: new THREE.Vector3(0, -sign, 0).applyQuaternion(rotation),
      surfaceNormal: new THREE.Vector3(0, sign, 0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld))
    };
  }
  // Printed faces turn over during a draw. The hand stays above the table:
  // its palmar surface must not flip upward with a face-up domino.
  piecesG.updateWorldMatrix(true, false);
  target.gripMode = 'pinch';
  target.palmNormal = new THREE.Vector3(0, -1, 0).transformDirection(piecesG.matrixWorld);
  target.pinchSurface = {
    matrixWorld: mesh.matrixWorld.clone(),
    halfExtents: new THREE.Vector3(0.5, 1, 0.11)
  };
  return target;
}

function blendDominoHandTargetFrame(target, from, amount) {
  if (!from?.approachDirection || !from?.palmNormal) return;
  const frame = (value) => {
    const forward = value.approachDirection.clone().normalize();
    const palm = value.palmNormal.clone().addScaledVector(forward, -value.palmNormal.dot(forward));
    if (forward.lengthSq() < 1e-10 || palm.lengthSq() < 1e-10) return null;
    palm.normalize();
    const across = new THREE.Vector3().crossVectors(palm, forward).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, palm, forward));
  };
  const start = frame(from);
  const end = frame(target);
  if (!start || !end) return;
  start.slerp(end, THREE.MathUtils.clamp(amount, 0, 1));
  target.approachDirection.set(0, 0, 1).applyQuaternion(start);
  target.palmNormal.set(0, 1, 0).applyQuaternion(start);
  if (from.surfaceNormal && target.surfaceNormal) {
    const normalStart = from.surfaceNormal.clone().normalize();
    const turn = new THREE.Quaternion().setFromUnitVectors(normalStart, target.surfaceNormal.clone().normalize());
    const blend = new THREE.Quaternion().slerp(turn, THREE.MathUtils.clamp(amount, 0, 1));
    target.surfaceNormal.copy(normalStart).applyQuaternion(blend);
  }
}

function resolveDominoHandWithdrawalPosition(start, end, progress, up) {
  const lift = smoothPlacementStep(0, 0.3, progress);
  const across = smoothPlacementStep(0.18, 0.82, progress);
  const lower = 1 - smoothPlacementStep(0.7, 1, progress);
  return start.clone().lerp(end, across)
    .addScaledVector(up, DOMINO_WIDTH * 1.4 * lift * lower);
}

function getDominoRackTargets(seatIndex) {
  const hand = openingSequence?.handSlots?.[seatIndex] || players[seatIndex]?.hand || [];
  const meshes = hand.map((tile) => tile.mesh).filter((mesh) => mesh?.parent && !mesh.userData?.animating);
  const rig = seatedHumanActors[getVisualSeatIndex(seatIndex)]?.rig;
  if (!meshes.length || !rig) return {};
  const firstMesh = meshes[0];
  const lastMesh = meshes.at(-1);
  const row = lastMesh.getWorldPosition(new THREE.Vector3())
    .sub(firstMesh.getWorldPosition(new THREE.Vector3()));
  // A tile's local width reverses at the west seat and in the flat human view.
  // Select the two exterior faces from the rendered row, never a fixed axis.
  const firstWidth = new THREE.Vector3().setFromMatrixColumn(firstMesh.matrixWorld, 0);
  const lastWidth = new THREE.Vector3().setFromMatrixColumn(lastMesh.matrixWorld, 0);
  const firstSide = row.lengthSq() < 1e-10 || firstWidth.dot(row) >= 0 ? -1 : 1;
  const lastSide = row.lengthSq() < 1e-10 || lastWidth.dot(row) >= 0 ? 1 : -1;
  const first = dominoSurfaceTarget(firstMesh, firstSide);
  const last = dominoSurfaceTarget(lastMesh, lastSide);
  const leftShoulder = rig.leftUpperArm.getWorldPosition(new THREE.Vector3());
  const rightShoulder = rig.rightUpperArm.getWorldPosition(new THREE.Vector3());
  const straight = leftShoulder.distanceToSquared(first.position) + rightShoulder.distanceToSquared(last.position);
  const crossed = leftShoulder.distanceToSquared(last.position) + rightShoulder.distanceToSquared(first.position);
  return straight <= crossed ? { left: first, right: last } : { left: last, right: first };
}

function poseDominoHands(seatIndex, overrides = {}, intensity = 1, mode = 'idle', motionProfile = null) {
  const rig = seatedHumanActors[getVisualSeatIndex(seatIndex)]?.rig;
  if (!rig) return;
  const targets = { ...getDominoRackTargets(seatIndex), ...overrides };
  runSeatedHumanDominoAction(seatIndex, mode, intensity, targets.right?.grip || 0, motionProfile);
  if (targets.right) {
    DOMINO_SEATED_HUMANS?.applySeatedHumanReachPose?.(rig, 'right', targets.right.position, {
      ...targets.right,
      torsoStrength: mode === 'idle' ? 0 : intensity,
      maxLean: THREE.MathUtils.degToRad(mode === 'idle' ? 12 : 88),
      maxArmExtension: mode === 'idle' ? 1 : (targets.right.maxArmExtension || 1.35)
    });
  }
  if (targets.left) targets.left.maxArmExtension = mode === 'idle' ? 1 : 1.35;
  DOMINO_SEATED_HUMANS?.applySeatedHumanHandTargets?.(rig, targets);
  let contacts = dominoHandContacts.get(seatIndex);
  if (!contacts) { contacts = {}; dominoHandContacts.set(seatIndex, contacts); }
  for (const side of ['left', 'right']) {
    if (targets[side]) contacts[side] = { ...targets[side], position: targets[side].position.clone() };
  }
}

function updateDominoIdleHands() {
  players.forEach((player, seatIndex) => {
    const active = placementAnimations.some((anim) => anim.sourceSeat === seatIndex)
      || drawAnimations[0]?.sourceSeat === seatIndex
      || knockAnimations[0]?.sourceSeat === seatIndex
      || (openingSequence?.phase === 'shuffle' && openingSequence.dealer === seatIndex);
    if (!active) poseDominoHands(seatIndex);
  });
}

function poseDominoShuffleHands(sequence, t) {
  const rig = seatedHumanActors[getVisualSeatIndex(sequence.dealer)]?.rig;
  if (!rig) return;
  const [seatX, seatZ] = layoutSeat(getVisualSeatIndex(sequence.dealer));
  piecesG.updateWorldMatrix(true, false);
  const targets = (sequence.palms || []).map((point) => ({
    position: piecesG.localToWorld(point.clone()), grip: 0.12, gripMode: 'palm',
    approachDirection: point.clone().sub(new THREE.Vector3(seatX, point.y, seatZ)).transformDirection(piecesG.matrixWorld),
    palmNormal: new THREE.Vector3(0, -1, 0).transformDirection(piecesG.matrixWorld)
  }));
  if (targets.length < 2) return;
  if (!sequence.palmOrder) {
    const left = rig.leftUpperArm.getWorldPosition(new THREE.Vector3());
    const right = rig.rightUpperArm?.getWorldPosition(new THREE.Vector3()) || left;
    const straight = left.distanceToSquared(targets[0].position) + right.distanceToSquared(targets[1].position);
    const crossed = left.distanceToSquared(targets[1].position) + right.distanceToSquared(targets[0].position);
    sequence.palmOrder = straight <= crossed ? [0, 1] : [1, 0];
  }
  poseDominoHands(sequence.dealer, {
    left: targets[sequence.palmOrder[0]], right: targets[sequence.palmOrder[1]]
  }, smoothPlacementStep(0, 0.1, t), 'reachPiece');
}

function updateSeatedHumanDominoAction(anim, t) {
  if (!anim?.humanReachProfile || !anim.mesh) return;
  const rig = seatedHumanActors[getVisualSeatIndex(anim.sourceSeat)]?.rig;
  if (!rig) return;
  let mode = 'reachPiece';
  let grip = 0.4 * smoothPlacementStep(0, PLACE_ANIM_PICK_HOLD, t);
  if (t >= PLACE_ANIM_PICK_HOLD && t < PLACE_ANIM_LIFT_END) mode = 'gripPiece';
  else if (t < PLACE_ANIM_CARRY_END && t >= PLACE_ANIM_LIFT_END) mode = 'carryPiece';
  else if (t >= PLACE_ANIM_CARRY_END) mode = 'placePiece';
  if (t >= PLACE_ANIM_LOWER_END) grip = 0.4 * (1 - smoothPlacementStep(PLACE_ANIM_LOWER_END, 1, t));
  anim.handPhase = mode;
  // IK supplies the phased contact and finger motion. Keep the underlying
  // shoulder/elbow pose constant so phase boundaries cannot roll the forearm.
  const poseIntensity = smoothPlacementStep(0, PLACE_ANIM_PICK_HOLD, t)
    * (1 - smoothPlacementStep(PLACE_ANIM_LOWER_END, 1, t));
  runSeatedHumanDominoAction(anim.sourceSeat, 'reachPiece', poseIntensity, grip, anim.humanReachProfile);
  anim.mesh.updateWorldMatrix(true, false);
  if (anim.contactSide == null) {
    const wrist = rig.rightHand.getWorldPosition(new THREE.Vector3());
    const shoulder = rig.rightUpperArm.getWorldPosition(new THREE.Vector3());
    // Keep one grip edge throughout transport. Choose on the tabletop end,
    // where reach is longest, rather than an upright rack edge that rotates away.
    const contactMesh = anim.mesh.clone(false);
    if (anim.segment && anim.endQuat && anim.endScale) {
      contactMesh.position.copy(anim.end);
      contactMesh.quaternion.copy(anim.endQuat);
      contactMesh.scale.copy(anim.endScale);
    } else {
      contactMesh.position.copy(anim.start);
      contactMesh.quaternion.copy(anim.startQuat);
      contactMesh.scale.copy(anim.startScale);
    }
    contactMesh.parent = piecesG;
    const candidates = [0, 1, 2, 3].map((side) => ({ side, target: dominoPickupTarget(contactMesh, side, grip) }));
    candidates.sort((a, b) => {
      const aWrist = a.target.position.clone().addScaledVector(a.target.approachDirection, -DOMINO_WIDTH * 1.5);
      const bWrist = b.target.position.clone().addScaledVector(b.target.approachDirection, -DOMINO_WIDTH * 1.5);
      return shoulder.distanceToSquared(aWrist) - shoulder.distanceToSquared(bWrist);
    });
    anim.contactSide = candidates[0].side;
    const previousContact = dominoHandContacts.get(anim.sourceSeat)?.right;
    anim.startHandContact = previousContact?.position?.clone() || wrist;
    anim.startHandFrame = previousContact?.approachDirection && previousContact?.palmNormal ? {
      approachDirection: previousContact.approachDirection.clone(),
      palmNormal: previousContact.palmNormal.clone(),
      surfaceNormal: previousContact.surfaceNormal?.clone(),
      grip: previousContact.grip,
      gripMode: previousContact.gripMode
    } : null;
  }
  const target = dominoPickupTarget(anim.mesh, anim.contactSide, grip);
  // The far stock is beyond normal seated reach for the opposite seat.
  // Only this draw may use extra arm retargeting; the solver uses the minimum
  // needed and the next base pose restores the original skeleton lengths.
  target.maxArmExtension = !anim.segment && getVisualSeatIndex(anim.sourceSeat) === 2 && anim.start.z > DOMINO_WIDTH * 2
    ? 1.65 : 1.35;
  const shoulder = rig.rightUpperArm.getWorldPosition(new THREE.Vector3());
  const tableUp = new THREE.Vector3(0, 1, 0).transformDirection(piecesG.matrixWorld);
  target.approachDirection.copy(target.position).sub(shoulder);
  target.approachDirection.addScaledVector(tableUp, -target.approachDirection.dot(tableUp));
  target.approachDirection.normalize();
  if (t < PLACE_ANIM_PICK_HOLD) {
    const reach = smoothPlacementStep(0, PLACE_ANIM_PICK_HOLD, t);
    target.position.lerpVectors(anim.startHandContact, target.position, reach);
    blendDominoHandTargetFrame(target, anim.startHandFrame, reach);
    target.grip = THREE.MathUtils.lerp(anim.startHandFrame?.grip ?? 0.4, 0.4, reach);
    target.gripFromMode = anim.startHandFrame?.gripMode || 'support';
    target.gripModeBlend = reach;
  }
  // Once the domino rests on the table, fingers release and the arm returns to the rack.
  if (t > PLACE_ANIM_LOWER_END) {
    const rest = getDominoRackTargets(anim.sourceSeat).right;
    if (rest) {
      const release = smoothPlacementStep(PLACE_ANIM_LOWER_END, 1, t);
      if (anim.segment) target.position.lerp(rest.position, release);
      else target.position.copy(resolveDominoHandWithdrawalPosition(target.position, rest.position, release, tableUp));
      blendDominoHandTargetFrame(target, rest, 1 - release);
      target.grip = 0.4 * (1 - smoothPlacementStep(0, 0.25, release))
        + rest.grip * smoothPlacementStep(0.75, 1, release);
      target.gripMode = rest.gripMode || 'support';
      target.gripFromMode = 'pinch';
      target.gripModeBlend = release;
    }
  }
  poseDominoHands(anim.sourceSeat, { right: target }, poseIntensity, 'reachPiece', anim.humanReachProfile);
}

function orientDominoFlat(domino, yawAngle = 0) {
  const angle = Number.isFinite(yawAngle) ? yawAngle : 0;
  DOMINO_FORWARD.set(Math.cos(angle), 0, Math.sin(angle));
  if (DOMINO_FORWARD.lengthSq() === 0) {
    DOMINO_FORWARD.set(1, 0, 0);
  } else {
    DOMINO_FORWARD.normalize();
  }

  DOMINO_RIGHT.crossVectors(DOMINO_FORWARD, DOMINO_UP);
  if (DOMINO_RIGHT.lengthSq() === 0) {
    DOMINO_RIGHT.set(0, 0, 1);
  } else {
    DOMINO_RIGHT.normalize();
  }

  DOMINO_BASIS.makeBasis(DOMINO_RIGHT, DOMINO_FORWARD, DOMINO_UP);
  domino.setRotationFromMatrix(DOMINO_BASIS);
}

function orientDominoFaceDown(mesh, yaw = 0) {
  orientDominoFlat(mesh, yaw);
  // Rotate around the domino's long LOCAL axis, keeping its broad face horizontal.
  mesh.rotateY(Math.PI);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function spawnOpeningShuffleAnimation() {
  const tiles = shuffle([...boneyard]).map((tile, i) => {
    const mesh = makeDomino(0, 0, { flat: true, faceUp: false });
    const spacingX = Math.hypot(DOMINO_WIDTH, DOMINO_LENGTH) * 1.075;
    const spacingZ = DOMINO_LENGTH * 1.28;
    const home = new THREE.Vector3((i % 7 - 3) * spacingX,
      CLOTH_TOP + mesh.scale.z * 0.11 + 0.003,
      (Math.floor(i / 7) - 1.5) * spacingZ);
    const yaw = Math.PI / 2 + (Math.random() - 0.5) * 0.16;
    orientDominoFaceDown(mesh, yaw);
    mesh.position.copy(home);
    mesh.userData = { openingShuffle: true };
    piecesG.add(mesh);
    return { tile, mesh, home, yaw, velocity: new THREE.Vector3(), spin: (Math.random() - 0.5) * 1.6 };
  });
  openingSequence = {
    phase: 'waiting', startTime: dominoMotionTime, tiles,
    dealer: Math.min(1, N - 1), dealQueue: [], handSlots: [], firstPlay: null
  };
  renderBoneyardStack();
  setStatus('Preparing the table…');
  refreshDominoControls();
}

function updateDominoShuffleTiles(sequence, t, now) {
  const dt = Math.min(0.05, Math.max(0, (now - (sequence.lastShuffleTime ?? now)) / 1000));
  sequence.lastShuffleTime = now;
  const angle = t * Math.PI * 4;
  const envelope = Math.sin(Math.PI * t);
  const previousPalms = sequence.palms;
  const [seatX, seatZ] = layoutSeat(getVisualSeatIndex(sequence.dealer));
  const outward = new THREE.Vector3(seatX, 0, seatZ).normalize();
  const lateral = new THREE.Vector3(outward.z, 0, -outward.x);
  // Each hand washes its own lane, aligned with the dealer's shoulders. Even
  // at the closest point the palm centers stay 5.4 domino widths apart.
  sequence.palms = [-1, 1].map((side) => {
    const phase = angle + (side > 0 ? Math.PI : 0);
    const lane = side * DOMINO_WIDTH * 3.25 + Math.cos(phase) * DOMINO_WIDTH * 0.55;
    const reach = DOMINO_WIDTH * (2.2 + Math.sin(phase) * 1.35);
    const point = outward.clone().multiplyScalar(reach).addScaledVector(lateral, lane);
    point.y = CLOTH_TOP + DOMINO_WIDTH * 0.25;
    return point;
  });
  const palmVelocities = sequence.palms.map((point, i) => previousPalms && dt > 0
    ? point.clone().sub(previousPalms[i]).divideScalar(dt) : new THREE.Vector3());
  const footprint = Math.hypot(DOMINO_WIDTH * 0.5, DOMINO_LENGTH * 0.5) * 1.025;
  const boundary = Math.min(CLOTH_RADIUS, Math.max(footprint * 9, CLOTH_RADIUS * 0.52));
  sequence.tiles.forEach((entry) => {
    const position = entry.mesh.position;
    // Sliding friction and palm impulses wash the pieces in the tabletop plane.
    sequence.palms.forEach((palm, i) => {
      const distance = Math.hypot(position.x - palm.x, position.z - palm.z);
      const influence = Math.max(0, 1 - distance / (DOMINO_WIDTH * 3));
      entry.velocity.addScaledVector(palmVelocities[i], influence * dt * 5 * envelope);
    });
    entry.velocity.x += -position.z * dt * 0.9 * envelope;
    entry.velocity.z += position.x * dt * 0.9 * envelope;
    entry.velocity.multiplyScalar(Math.exp(-dt * 3.5));
    position.addScaledVector(entry.velocity, dt);
    position.y = entry.home.y;
    entry.yaw += entry.spin * dt * envelope;
    orientDominoFaceDown(entry.mesh, entry.yaw);
  });
  // Conservative circular footprints contain every rotated tile corner.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < sequence.tiles.length; i++) {
      const a = sequence.tiles[i];
      for (let j = i + 1; j < sequence.tiles.length; j++) {
        const b = sequence.tiles[j];
        let dx = b.mesh.position.x - a.mesh.position.x;
        let dz = b.mesh.position.z - a.mesh.position.z;
        let distance = Math.hypot(dx, dz);
        if (distance >= footprint * 2) continue;
        if (distance < 1e-8) { dx = 1e-8; dz = 0; distance = 1e-8; }
        const push = (footprint * 2 - distance) * 0.5;
        const nx = dx / Math.max(distance, 1e-8), nz = dz / Math.max(distance, 1e-8);
        a.mesh.position.x -= nx * push; a.mesh.position.z -= nz * push;
        b.mesh.position.x += nx * push; b.mesh.position.z += nz * push;
        a.velocity.multiplyScalar(0.85); b.velocity.multiplyScalar(0.85);
      }
      const distance = Math.hypot(a.mesh.position.x, a.mesh.position.z);
      if (distance > boundary - footprint) {
        const scale = (boundary - footprint) / distance;
        a.mesh.position.x *= scale; a.mesh.position.z *= scale;
        a.velocity.multiplyScalar(0.6);
      }
    }
  }
}

function updateKnockAnimations(now) {
  if (drawAnimations.length || openingSequence || placementAnimations.length) return;
  const anim = knockAnimations[0];
  if (!anim) return;
  if (anim.startTime == null) anim.startTime = now;
  const t = Math.min(1, (now - anim.startTime) / KNOCK_DURATION);
  const [sx, sz] = layoutSeat(getVisualSeatIndex(anim.sourceSeat));
  const outward = new THREE.Vector3(sx, 0, sz).normalize();
  const right = new THREE.Vector3(outward.z, 0, -outward.x).negate();
  const point = outward.multiplyScalar(CLOTH_RADIUS * 0.7).addScaledVector(right, DOMINO_WIDTH * 1.3);
  point.y = CLOTH_TOP + 0.008;
  const lift = t < KNOCK_CONTACT_PHASE
    ? Math.sin(Math.PI * smoothPlacementStep(0, KNOCK_CONTACT_PHASE, t)) * 0.085
    : Math.sin(Math.PI * smoothPlacementStep(KNOCK_CONTACT_PHASE, 1, t)) * 0.035;
  point.y += lift;
  if (anim.startHandTarget === undefined) {
    const previous = dominoHandContacts.get(anim.sourceSeat)?.right || getDominoRackTargets(anim.sourceSeat).right;
    anim.startHandTarget = previous ? {
      ...previous, position: previous.position.clone(),
      approachDirection: previous.approachDirection.clone(),
      palmNormal: previous.palmNormal.clone(), surfaceNormal: previous.surfaceNormal?.clone()
    } : null;
    anim.startContact = anim.startHandTarget?.position.clone();
  }
  const clench = smoothPlacementStep(0, 0.3, t);
  const returning = smoothPlacementStep(0.76, 1, t);
  if (anim.startContact && t < 0.18) {
    const world = piecesG.localToWorld(point.clone());
    world.lerpVectors(anim.startContact, world, smoothPlacementStep(0, 0.18, t));
    point.copy(piecesG.worldToLocal(world));
  }
  const rest = t > 0.76 ? getDominoRackTargets(anim.sourceSeat).right : null;
  if (rest) point.lerp(piecesG.worldToLocal(rest.position.clone()), returning);
  piecesG.updateWorldMatrix(true, false);
  const approach = point.clone().sub(new THREE.Vector3(sx, point.y, sz)).transformDirection(piecesG.matrixWorld);
  const target = {
    position: piecesG.localToWorld(point),
    grip: THREE.MathUtils.lerp(anim.startHandTarget?.grip || 0, 0.9, clench),
    gripMode: 'fist', gripFromMode: anim.startHandTarget?.gripMode || 'support', gripModeBlend: clench,
    approachDirection: approach,
    palmNormal: new THREE.Vector3(0, -1, 0).transformDirection(piecesG.matrixWorld)
  };
  if (clench < 1 && anim.startHandTarget) {
    blendDominoHandTargetFrame(target, anim.startHandTarget, clench);
    if (anim.startHandTarget.surfaceNormal) {
      target.surfaceNormal = anim.startHandTarget.surfaceNormal.clone();
      target.surfacePaddingScale = 1 - clench;
    }
  }
  if (rest) {
    blendDominoHandTargetFrame(target, rest, 1 - returning);
    target.grip = THREE.MathUtils.lerp(0.9, rest.grip, returning);
    target.gripMode = rest.gripMode || 'support';
    target.gripFromMode = 'fist';
    target.gripModeBlend = returning;
    target.surfaceNormal = rest.surfaceNormal?.clone();
    target.surfacePaddingScale = returning;
  }
  poseDominoHands(anim.sourceSeat, { right: target }, Math.min(1, t / 0.18), 'reachPiece');
  if (!anim.impactPlayed && t >= KNOCK_CONTACT_PHASE) {
    anim.impactPlayed = true;
    SFX.pass();
    showPassBubble(anim.sourceSeat);
  }
  if (t >= 1) {
    knockAnimations.shift();
    if (!gameFinished && !anim.remote) nextTurn('pass');
    flushPendingDominoState();
  }
}

function updateDrawDestination(anim) {
  const hand = openingSequence?.handSlots?.[anim.sourceSeat] || players[anim.sourceSeat]?.hand || [];
  const count = Math.max(1, hand.length);
  const index = Math.max(0, hand.indexOf(anim.tile));
  const isTopDown = cameraViewMode === VIEW_MODES.twoD;
  const openFlat = isTopDown && anim.sourceSeat === human;
  anim.end = computeHandSlotPosition(anim.sourceSeat, index, count, { isTopDown });
  const [x, z] = layoutSeat(getVisualSeatIndex(anim.sourceSeat));
  const orient = new THREE.Object3D();
  if (openFlat) orientDominoFlat(orient, Math.PI / 2);
  else orient.rotation.set(0, anim.sourceSeat === human ? 0 : Math.atan2(-x, -z), 0);
  anim.endQuat = orient.quaternion.clone();
  anim.endScale = new THREE.Vector3(0.1, openFlat ? 0.016 / 0.22 : 0.1, openFlat ? 0.1 : 0.016 / 0.22)
    .multiplyScalar(DOMINO_WORLD_SCALE * getDominoHandScale(anim.sourceSeat, count));
}

function spawnDrawAnimation(startWorld, seatIndex = human, tile = players[seatIndex]?.hand?.at(-1), options = {}) {
  if (!startWorld || !tile) return;
  const start = piecesG.worldToLocal(startWorld.clone());
  const domino = makeDomino(tile.a, tile.b, { flat: true, faceUp: seatIndex === human });
  orientDominoFaceDown(domino, Math.PI / 2);
  if (options.mesh) {
    domino.quaternion.copy(options.mesh.quaternion);
    domino.scale.copy(options.mesh.scale);
    disposeDominoMesh(options.mesh);
  }
  domino.userData = { stockAnim: true };
  domino.position.copy(start);
  piecesG.add(domino);
  tile.inTransit = true;
  if (tile.mesh) {
    activeHandMeshes.delete(tile.mesh);
    disposeDominoMesh(tile.mesh);
    tile.mesh = null;
  }
  const anim = {
    mesh: domino, tile, sourceSeat: seatIndex, start,
    startQuat: domino.quaternion.clone(), startScale: domino.scale.clone(),
    startTime: null, duration: options.opening ? OPENING_DEAL_ANIM_DURATION : DRAW_ANIM_DURATION,
    arc: PLACE_ANIM_ARC, opening: Boolean(options.opening), onComplete: options.onComplete,
    end: start.clone()
  };
  drawAnimations.push(anim);
  updateDrawDestination(anim);
  anim.humanReachProfile = getDominoHumanReachProfile(anim);
  refreshDominoControls();
}

function updateDrawAnimations(now) {
  const anim = drawAnimations[0];
  if (!anim) return;
  if (anim.startTime == null) anim.startTime = now;
  const { tileT: t, handT, finished } = sampleDominoActionProgress(now - anim.startTime, anim.duration);
  updateDrawDestination(anim);
  const rotateT = smoothPlacementStep(PLACE_ANIM_LIFT_END, PLACE_ANIM_LOWER_END, t);
  anim.mesh.position.copy(resolvePrecisionPlacementPosition(anim, t));
  anim.mesh.quaternion.slerpQuaternions(anim.startQuat, anim.endQuat, rotateT);
  anim.mesh.scale.lerpVectors(anim.startScale, anim.endScale, rotateT);
  updateSeatedHumanDominoAction(anim, handT);
  if (!anim.pickupPlayed && t >= PLACE_ANIM_PICK_HOLD) { anim.pickupPlayed = true; SFX.drawTile(); }
  if (finished) {
    disposeDominoMesh(anim.mesh);
    drawAnimations.shift();
    anim.tile.inTransit = false;
    anim.tile.openingPending = false;
    renderHands();
    anim.onComplete?.();
    flushPendingDominoState();
  }
}

function sampleDominoActionProgress(elapsed, duration) {
  const time = Math.max(0, elapsed);
  const motionDuration = Math.max(1, duration);
  const touchdown = motionDuration * PLACE_ANIM_LOWER_END;
  const totalDuration = touchdown + DOMINO_HAND_RETURN_DURATION;
  const tileT = THREE.MathUtils.clamp(time / motionDuration, 0, 1);
  const returnProgress = THREE.MathUtils.clamp((time - touchdown) / DOMINO_HAND_RETURN_DURATION, 0, 1);
  const handT = time <= touchdown ? tileT
    : PLACE_ANIM_LOWER_END + (1 - PLACE_ANIM_LOWER_END) * returnProgress;
  return { tileT, handT, finished: time >= totalDuration, totalDuration };
}

function revealPlacementFace(anim) {
  if (anim.faceRevealed || !anim.segment?.tile) return;
  anim.faceRevealed = true;
  const { a, b } = anim.segment.tile;
  const visible = makeDomino(a, b, { flat: true, faceUp: true, preserveOrder: true });
  visible.position.copy(anim.mesh.position);
  visible.quaternion.copy(anim.mesh.quaternion);
  visible.scale.copy(anim.mesh.scale);
  visible.userData = { animating: true };
  visible.traverse((child) => { child.renderOrder = 6; });
  disposeDominoMesh(anim.mesh);
  piecesG.add(visible);
  anim.mesh = visible;
}

function updatePlacementAnimations(now) {
  const timestamp = Number.isFinite(now) ? now : performance.now();
  for (let i = placementAnimations.length - 1; i >= 0; i--) {
    const anim = placementAnimations[i];
    const elapsed = timestamp - anim.startTime;
    const duration = anim.duration || PLACE_ANIM_DURATION;
    const { tileT: t, handT, finished } = sampleDominoActionProgress(elapsed, duration);
    const rotateT = smoothPlacementStep(PLACE_ANIM_LIFT_END, PLACE_ANIM_LOWER_END, t);

    anim.mesh.position.copy(resolvePrecisionPlacementPosition(anim, t));
    if (anim.endQuat && anim.startQuat) {
      const quat = anim.startQuat.clone().slerp(anim.endQuat, rotateT);
      anim.mesh.quaternion.copy(quat);
    }

    if (anim.endScale && anim.startScale) {
      const scale = anim.startScale.clone().lerp(anim.endScale, rotateT);
      anim.mesh.scale.copy(scale);
    }

    if (t >= PLACE_ANIM_PICK_HOLD) revealPlacementFace(anim);
    updateSeatedHumanDominoAction(anim, handT);
    if (!anim.impactPlayed && t >= PLACE_ANIM_LOWER_END) { anim.impactPlayed = true; SFX.place(); }

    if (finished) {
      if (anim.segment) {
        anim.segment.animating = false;
      }
      disposeDominoMesh(anim.mesh);
      placementAnimations.splice(i, 1);
      renderChain();
      anim.onComplete?.();
      flushPendingDominoState();
    }
  }
}

  // END exact production function extracts.

  /** Exact transform statements extracted from updateDrawAnimations, without lifecycle mutation. */
  function sampleDominoTravelTransform(anim, t) {
  const rotateT = smoothPlacementStep(PLACE_ANIM_LIFT_END, PLACE_ANIM_LOWER_END, t);
  anim.mesh.position.copy(resolvePrecisionPlacementPosition(anim, t));
  anim.mesh.quaternion.slerpQuaternions(anim.startQuat, anim.endQuat, rotateT);
  anim.mesh.scale.lerpVectors(anim.startScale, anim.endScale, rotateT);
    return anim.mesh;
  }

  const production = {
    runSeatedHumanDominoAction,
    getDominoHumanReachProfile,
    dominoSurfaceTarget,
    dominoPickupTarget,
    blendDominoHandTargetFrame,
    resolveDominoHandWithdrawalPosition,
    getDominoRackTargets,
    poseDominoHands,
    updateDominoIdleHands,
    poseDominoShuffleHands,
    updateSeatedHumanDominoAction,
    orientDominoFlat,
    orientDominoFaceDown,
    shuffle,
    spawnOpeningShuffleAnimation,
    updateDominoShuffleTiles,
    updateKnockAnimations,
    updateDrawDestination,
    spawnDrawAnimation,
    updateDrawAnimations,
    sampleDominoActionProgress,
    revealPlacementFace,
    updatePlacementAnimations,
    sampleDominoTravelTransform
  };
  const api = {} as { [K in keyof typeof production]: (...args: Parameters<(typeof production)[K]>) => ReturnType<(typeof production)[K]> };
  for (const [name, fn] of Object.entries(production)) {
    api[name] = (...args) => {
      syncFromEnvironment();
      try { return fn(...args); }
      finally { env.openingSequence = openingSequence; }
    };
  }
  return api;
}
