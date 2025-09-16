import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
// Snooker uses its own slimmer power slider
import { SnookerPowerSlider } from '../../../../snooker-power-slider.js';
import '../../../../snooker-power-slider.css';
import {
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { SnookerRules } from '../../../../src/rules/SnookerRules.ts';
import { useAimCalibration } from '../../hooks/useAimCalibration.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

// --------------------------------------------------
// Pocket jaws
// --------------------------------------------------
const JAW_H = 3.0;
const JAW_T = 1.25;
const SECTOR_START = -Math.PI * 0.65;
const SECTOR_END = Math.PI * 0.65;
const jawMat = new THREE.MeshPhysicalMaterial({
  color: 0x111111,
  roughness: 0.35,
  metalness: 0.1,
  clearcoat: 0.4
});
function makeJawSector(
  R = POCKET_VIS_R,
  T = JAW_T,
  start = SECTOR_START,
  end = SECTOR_END
) {
  const r = R - T;
  const s = new THREE.Shape();
  s.absarc(0, 0, R, start, end, false);
  s.absarc(0, 0, r, end, start, true);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: JAW_H,
    bevelEnabled: false
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}
function addPocketJaws(parent, playW, playH) {
  const HALF_PLAY_W = playW * 0.5;
  const HALF_PLAY_H = playH * 0.5;
  const POCKET_MAP = [
    { id: 'corner_tl', type: 'corner', pos: [-HALF_PLAY_W, -HALF_PLAY_H] },
    { id: 'corner_tr', type: 'corner', pos: [HALF_PLAY_W, -HALF_PLAY_H] },
    { id: 'corner_bl', type: 'corner', pos: [-HALF_PLAY_W, HALF_PLAY_H] },
    { id: 'corner_br', type: 'corner', pos: [HALF_PLAY_W, HALF_PLAY_H] },
    { id: 'side_top', type: 'side', pos: [0, -HALF_PLAY_H] },
    { id: 'side_bottom', type: 'side', pos: [0, HALF_PLAY_H] }
  ];
  const jaws = [];
  const geoCorner = makeJawSector();
  const geoSide = makeJawSector(POCKET_VIS_R, JAW_T * 0.8);
  for (const entry of POCKET_MAP) {
    const p = new THREE.Vector2(entry.pos[0], entry.pos[1]);
    const towardCenter2 = p.clone().multiplyScalar(-1).normalize();
    const offset = entry.type === 'side' ? POCKET_VIS_R * 1.15 : POCKET_VIS_R;
    const pShift = p.clone().add(towardCenter2.multiplyScalar(offset));
    const geom = entry.type === 'side' ? geoSide.clone() : geoCorner.clone();
    const jaw = new THREE.Mesh(geom, jawMat);
    jaw.castShadow = true;
    jaw.receiveShadow = true;
    jaw.position.set(pShift.x, TABLE_Y + 0.01, pShift.y);
    jaw.lookAt(new THREE.Vector3(0, TABLE_Y, 0));
    if (entry.type === 'side') {
      jaw.rotateY(Math.PI / 2);
    }
    parent.add(jaw);
    jaws.push(jaw);
  }
  return jaws;
}

/**
 * NEW SNOOKER GAME — fresh build (keep ONLY Guret for balls)
 * Per kërkesën tënde:
 *  • Kamera rotullohet si një person te tavolina (orbit e butë), me kënd pak të ulët, pa rënë në nivelin e cloth.
 *  • 6 gropa të prera realisht në cloth (Shape.holes + Extrude) + kapje (capture radius) → guret bien brenda.
 *  • Power slider i RI: i madh, djathtas ekranit, me gjest **PULL** (tërhiq POSHTË sa fort do → fuqi), dhe **gjuan në release**.
 *  • Playable: aiming line + tick, përplasje, kapje në xhepa, logjikë bazë snooker (reds→colour, pastaj colours in order, fouls, in‑hand).
 */

// --------------------------------------------------
// Config
// --------------------------------------------------
// separate scales for table and balls
// Dimensions enlarged for a roomier snooker table but globally reduced by 30%
const SIZE_REDUCTION = 0.7;
const GLOBAL_SIZE_FACTOR = 0.85 * SIZE_REDUCTION; // apply uniform 30% shrink from previous tuning
const WORLD_SCALE = 0.85 * GLOBAL_SIZE_FACTOR;
const BALL_SCALE = 1;
const TABLE_SCALE = 1.3;
const TABLE = {
  W: 66 * TABLE_SCALE,
  H: 132 * TABLE_SCALE,
  THICK: 1.8 * TABLE_SCALE,
  WALL: 2.6 * TABLE_SCALE
};
const PLAY_W = TABLE.W - 2 * TABLE.WALL;
const PLAY_H = TABLE.H - 2 * TABLE.WALL;
const BALL_R = 2 * BALL_SCALE;
const POCKET_R = BALL_R * 2; // pockets twice the ball radius
// slightly larger visual radius so rails align with pocket rings
const POCKET_VIS_R = POCKET_R / 0.85;
const FRICTION = 0.995;
const STOP_EPS = 0.02;
const CAPTURE_R = POCKET_R; // pocket capture radius
// Make the four round legs taller to lift the entire table
// Increase scale so the table sits roughly twice as high and legs reach the rug
const LEG_SCALE = 6.2;
const TABLE_H = 0.75 * LEG_SCALE; // physical height of table used for legs/skirt
// raise overall table position so the longer legs are visible
const TABLE_Y = -2 + (TABLE_H - 0.75) + TABLE_H;
const CUE_TIP_GAP = BALL_R * 1.2; // pull cue stick slightly farther back for a more natural stance
const CUE_Y = BALL_R; // keep cue stick level with the cue ball center
// angle for cushion cuts guiding balls into pockets
const CUSHION_CUT_ANGLE = 30;

// shared UI reduction factor so overlays and controls shrink alongside the table
const UI_SCALE = SIZE_REDUCTION;

// Updated colors for dark cloth and standard balls
// includes separate tones for rails, base wood and cloth markings
const COLORS = Object.freeze({
  cloth: 0x1e7b1e,
  rail: 0x3a2a1a,
  base: 0x5b3a1a,
  markings: 0xffffff,
  cue: 0xffffff,
  red: 0xff0000,
  yellow: 0xffff00,
  green: 0x006400,
  brown: 0x8b4513,
  blue: 0x0000ff,
  pink: 0xff69b4,
  black: 0x000000
});

function spotPositions(baulkZ) {
  const halfH = PLAY_H / 2;
  return {
    yellow: [-PLAY_W * 0.22, baulkZ],
    green: [PLAY_W * 0.22, baulkZ],
    brown: [0, baulkZ],
    blue: [0, 0],
    pink: [0, PLAY_H * 0.25],
    black: [0, halfH - PLAY_H * 0.09]
  };
}

// Kamera: lejojmë ulje më të madhe (phi më i vogël), por mos shko kurrë krejt në nivel (limit ~0.5rad)
const CAMERA = {
  fov: 44,
  near: 0.1,
  far: 4000,
  minR: 36 * TABLE_SCALE * GLOBAL_SIZE_FACTOR,
  maxR: 200 * TABLE_SCALE * GLOBAL_SIZE_FACTOR,
  minPhi: 0.5,
  // keep the camera slightly above the horizontal plane but allow a lower sweep
  maxPhi: Math.PI / 2 - 0.04
};
const BREAK_VIEW = Object.freeze({
  radius: 180 * TABLE_SCALE * GLOBAL_SIZE_FACTOR,
  phi: 1.12
});
const SHOT_VIEW_OFFSET = Object.freeze({
  radiusFactor: 1.05,
  phiOffset: -0.05
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fitRadius = (camera, margin = 1.1) => {
  const a = camera.aspect,
    f = THREE.MathUtils.degToRad(camera.fov);
  const halfW = (TABLE.W / 2) * margin,
    halfH = (TABLE.H / 2) * margin;
  const dzH = halfH / Math.tan(f / 2);
  const dzW = halfW / (Math.tan(f / 2) * a);
  // Nudge camera closer so the table fills more of the view
  const r = Math.max(dzH, dzW) * 0.92 * GLOBAL_SIZE_FACTOR;
  return clamp(r, CAMERA.minR, CAMERA.maxR);
};


// --------------------------------------------------
// Utilities
// --------------------------------------------------
const pocketCenters = () => [
  new THREE.Vector2(-PLAY_W / 2, -PLAY_H / 2),
  new THREE.Vector2(PLAY_W / 2, -PLAY_H / 2),
  new THREE.Vector2(-PLAY_W / 2, PLAY_H / 2),
  new THREE.Vector2(PLAY_W / 2, PLAY_H / 2),
  new THREE.Vector2(-PLAY_W / 2, 0),
  new THREE.Vector2(PLAY_W / 2, 0)
];
const allStopped = (balls) => balls.every((b) => b.vel.length() < STOP_EPS);
function reflectRails(ball) {
  const limX = TABLE.W / 2 - BALL_R - TABLE.WALL;
  const limY = TABLE.H / 2 - BALL_R - TABLE.WALL;
  // If the ball is near any pocket, skip rail reflections so it can drop in
  const nearPocket = pocketCenters().some(
    (c) => ball.pos.distanceTo(c) < POCKET_VIS_R + BALL_R
  );
  if (nearPocket) return;
  if (ball.pos.x < -limX && ball.vel.x < 0) {
    ball.pos.x = -limX;
    ball.vel.x *= -1;
  }
  if (ball.pos.x > limX && ball.vel.x > 0) {
    ball.pos.x = limX;
    ball.vel.x *= -1;
  }
  if (ball.pos.y < -limY && ball.vel.y < 0) {
    ball.pos.y = -limY;
    ball.vel.y *= -1;
  }
  if (ball.pos.y > limY && ball.vel.y > 0) {
    ball.pos.y = limY;
    ball.vel.y *= -1;
  }
}

// calculate impact point and post-collision direction for aiming guide
function calcTarget(cue, dir, balls) {
  const cuePos = cue.pos.clone();
  let tHit = Infinity;
  let targetBall = null;
  let railNormal = null;

  const limX = TABLE.W / 2 - BALL_R - TABLE.WALL;
  const limY = TABLE.H / 2 - BALL_R - TABLE.WALL;
  const checkRail = (t, normal) => {
    if (t >= 0 && t < tHit) {
      tHit = t;
      railNormal = normal;
      targetBall = null;
    }
  };
  if (dir.x < 0) checkRail((-limX - cuePos.x) / dir.x, new THREE.Vector2(1, 0));
  if (dir.x > 0) checkRail((limX - cuePos.x) / dir.x, new THREE.Vector2(-1, 0));
  if (dir.y < 0) checkRail((-limY - cuePos.y) / dir.y, new THREE.Vector2(0, 1));
  if (dir.y > 0) checkRail((limY - cuePos.y) / dir.y, new THREE.Vector2(0, -1));

  const diam = BALL_R * 2;
  const diam2 = diam * diam;
  balls.forEach((b) => {
    if (!b.active || b === cue) return;
    const v = b.pos.clone().sub(cuePos);
    const proj = v.dot(dir);
    if (proj <= 0) return;
    const perp2 = v.lengthSq() - proj * proj;
    if (perp2 > diam2) return;
    const thc = Math.sqrt(diam2 - perp2);
    const t = proj - thc;
    if (t >= 0 && t < tHit) {
      tHit = t;
      targetBall = b;
      railNormal = null;
    }
  });

  const impact = cuePos.clone().add(dir.clone().multiplyScalar(tHit));
  let afterDir = null;
  if (targetBall) {
    afterDir = targetBall.pos.clone().sub(impact).normalize();
  } else if (railNormal) {
    const n = railNormal.clone().normalize();
    afterDir = dir
      .clone()
      .sub(n.clone().multiplyScalar(2 * dir.dot(n)))
      .normalize();
  }
  return { impact, afterDir, targetBall, railNormal, tHit };
}

// --------------------------------------------------
// ONLY kept component: Guret (balls factory)
// --------------------------------------------------
function Guret(parent, id, color, x, y) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.2,
    clearcoat: 0.92,
    clearcoatRoughness: 0.16,
    specularIntensity: 1
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 64, 48),
    material
  );
  mesh.position.set(x, BALL_R, y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (id === 'cue') {
    const dotSize = BALL_R * 0.15;
    const dotGeom = new THREE.SphereGeometry(dotSize, 16, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    [
      [BALL_R * 0.7, 0, 0],
      [-BALL_R * 0.7, 0, 0],
      [0, BALL_R * 0.7, 0],
      [0, -BALL_R * 0.7, 0]
    ].forEach(([dx, dy, dz]) => {
      const d = new THREE.Mesh(dotGeom, dotMat);
      d.position.set(dx, dy, dz);
      mesh.add(d);
    });
  }
  parent.add(mesh);
  return {
    id,
    color,
    mesh,
    pos: new THREE.Vector2(x, y),
    vel: new THREE.Vector2(),
    active: true
  };
}

// --------------------------------------------------
// Table with CUT pockets + markings (fresh)
// --------------------------------------------------

function Table3D(parent) {
  const table = new THREE.Group();
  const halfW = PLAY_W / 2;
  const halfH = PLAY_H / 2;

  const clothMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.cloth,
    roughness: 0.97,
    sheen: 0.6,
    sheenRoughness: 0.9
  });
  const cushionMat = clothMat.clone();
  const railWoodMat = new THREE.MeshStandardMaterial({
    color: COLORS.rail,
    metalness: 0.3,
    roughness: 0.8
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: COLORS.base,
    metalness: 0.2,
    roughness: 0.8
  });

  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.lineTo(-halfW, -halfH);
  pocketCenters().forEach((p) => {
    const h = new THREE.Path();
    h.absellipse(p.x, p.y, 6, 6, 0, Math.PI * 2);
    shape.holes.push(h);
  });
  const clothGeo = new THREE.ExtrudeGeometry(shape, {
    depth: TABLE.THICK,
    bevelEnabled: false
  });
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = -TABLE.THICK;
  table.add(cloth);

  const markingMat = new THREE.LineBasicMaterial({
    color: COLORS.markings,
    linewidth: 2
  });
  const baulkZ = -PLAY_H / 4;
  const baulkGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfW, 0.02, baulkZ),
    new THREE.Vector3(halfW, 0.02, baulkZ)
  ]);
  const baulkLine = new THREE.Line(baulkGeom, markingMat);
  table.add(baulkLine);
  const dRadius = PLAY_W * 0.15;
  const dCurve = new THREE.ArcCurve(
    0,
    baulkZ,
    dRadius,
    Math.PI,
    Math.PI * 2,
    false
  );
  const dPoints = dCurve
    .getPoints(64)
    .map((p) => new THREE.Vector3(p.x, 0.02, p.y));
  const dGeom = new THREE.BufferGeometry().setFromPoints(dPoints);
  const dLine = new THREE.Line(dGeom, markingMat);
  table.add(dLine);

  function addSpot(x, z) {
    const spotGeo = new THREE.CircleGeometry(0.5, 32);
    const spotMat = new THREE.MeshBasicMaterial({
      color: COLORS.markings
    });
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(x, 0.021, z);
    table.add(spot);
  }
  addSpot(0, baulkZ);
  addSpot(-PLAY_W * 0.25, baulkZ);
  addSpot(PLAY_W * 0.25, baulkZ);
  addSpot(0, 0);
  addSpot(0, PLAY_H * 0.25);
  addSpot(0, PLAY_H * 0.5 - PLAY_H * 0.05);

  const railH = TABLE.THICK * 2.0;
  const railW = TABLE.WALL * 0.9 * 0.5;
  const FRAME_W = railW * 2.5;
  const outerHalfW = halfW + 2 * railW + FRAME_W;
  const outerHalfH = halfH + 2 * railW + FRAME_W;

  const frameShape = new THREE.Shape();
  frameShape.moveTo(-outerHalfW, -outerHalfH);
  frameShape.lineTo(outerHalfW, -outerHalfH);
  frameShape.lineTo(outerHalfW, outerHalfH);
  frameShape.lineTo(-outerHalfW, outerHalfH);
  frameShape.lineTo(-outerHalfW, -outerHalfH);
  const innerRect = new THREE.Path();
  innerRect.moveTo(-halfW - railW, -halfH - railW);
  innerRect.lineTo(halfW + railW, -halfH - railW);
  innerRect.lineTo(halfW + railW, halfH + railW);
  innerRect.lineTo(-halfW - railW, halfH + railW);
  innerRect.lineTo(-halfW - railW, -halfH - railW);
  frameShape.holes.push(innerRect);
  // extend the side rails downward without altering the top surface
  const frameDepth = railH * 3;
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: frameDepth,
    bevelEnabled: false
  });
  const frame = new THREE.Mesh(frameGeo, railWoodMat);
  frame.rotation.x = -Math.PI / 2;
  // lower the frame so the top remains aligned with the play field
  frame.position.y = -TABLE.THICK + 0.01 - railH * 2;
  table.add(frame);

  // simple wooden skirt beneath the play surface
  const skirtGeo = new THREE.BoxGeometry(
    outerHalfW * 2,
    TABLE_H * 0.2,
    outerHalfH * 2
  );
  const skirt = new THREE.Mesh(skirtGeo, woodMat);
  skirt.position.y = -TABLE.THICK - TABLE_H * 0.1;
  table.add(skirt);

  // wooden table legs at the four corners, now thinner and taller
  const pocketRadius = 6.2 * 0.5; // radius used for pocket holes
  const pocketHeight = railH * 3.0 * 1.15; // height of pocket cylinders
  const legRadius = pocketRadius * 3 * 0.5; // 50% thinner legs
  const legHeight = pocketHeight * 2.25; // 50% taller legs
  const legGeo = new THREE.CylinderGeometry(
    legRadius,
    legRadius,
    legHeight,
    12
  );
  const legY = -TABLE.THICK - legHeight / 2;
  [
    [outerHalfW - 6, outerHalfH - 6],
    [-outerHalfW + 6, outerHalfH - 6],
    [outerHalfW - 6, -outerHalfH + 6],
    [-outerHalfW + 6, -outerHalfH + 6]
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(x, legY, z);
    table.add(leg);
  });

  const cushionRaiseY = -TABLE.THICK + 0.02;
  const cushionW = TABLE.WALL * 0.9 * 1.08;
  const cushionExtend = 6 * 0.85;
  function cushionProfile(len) {
    const L = len + cushionExtend + 6;
    const half = L / 2;
    const backY = cushionW / 2;
    const frontY = -cushionW / 2;
    const cut = cushionW / Math.tan(THREE.MathUtils.degToRad(30));
    const s = new THREE.Shape();
    s.moveTo(-half, backY);
    s.lineTo(half, backY);
    s.lineTo(half - cut, frontY);
    s.lineTo(-half + cut, frontY);
    s.lineTo(-half, backY);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: railH,
      bevelEnabled: false
    });
    return geo;
  }
  function addCushion(x, z, len, horizontal, flip = false) {
    const geo = cushionProfile(len);
    const mesh = new THREE.Mesh(geo, cushionMat);
    mesh.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.add(mesh);
    g.position.set(x, cushionRaiseY, z);
    if (!horizontal) {
      g.rotation.y = Math.PI / 2;
      if (flip) g.rotation.y += Math.PI;
    } else if (flip) {
      g.rotation.y = Math.PI;
    }
    table.add(g);
    if (!table.userData.cushions) table.userData.cushions = [];
    table.userData.cushions.push(g);
  }
  const horizLen = PLAY_W - 12;
  const vertSeg = PLAY_H / 2 - 12;
  const CUSHION_LEN = Math.min(horizLen, vertSeg);
  const bottomZ = -halfH - (TABLE.WALL * 0.5) / 2;
  const topZ = halfH + (TABLE.WALL * 0.5) / 2;
  const leftX = -halfW - (TABLE.WALL * 0.5) / 2;
  const rightX = halfW + (TABLE.WALL * 0.5) / 2;
  addCushion(0, bottomZ, CUSHION_LEN, true, false);
  addCushion(leftX, -halfH + 6 + vertSeg / 2, CUSHION_LEN, false, false);
  addCushion(rightX, halfH - 6 - vertSeg / 2, CUSHION_LEN, false, true);
  addCushion(0, topZ, CUSHION_LEN, true, true);
  addCushion(leftX, halfH - 6 - vertSeg / 2, CUSHION_LEN, false, false);
  addCushion(rightX, -halfH + 6 + vertSeg / 2, CUSHION_LEN, false, true);

  if (!table.userData.pockets) table.userData.pockets = [];
  pocketCenters().forEach((p) => {
    const cutHeight = railH * 3.0;
    const cut = new THREE.Mesh(
      new THREE.CylinderGeometry(6.2, 6.2, cutHeight, 48),
      new THREE.MeshBasicMaterial({ color: 0x0b0f1a, side: THREE.DoubleSide })
    );
    cut.rotation.set(0, 0, 0);
    const scaleY = 1.15;
    cut.scale.set(0.5, scaleY, 0.5);
    const half = (cutHeight * scaleY) / 2;
    cut.position.set(p.x, -half - 0.01, p.y);
    table.add(cut);
    table.userData.pockets.push(cut);
  });

  const degFrom = 30;
  const degTo = 32;
  const cot = (d) => 1 / Math.tan(THREE.MathUtils.degToRad(d));
  const dCutAdjust = cushionW * cot(degTo) - cushionW * cot(degFrom);
  if (table.userData.cushions) {
    table.userData.cushions.forEach((g) => {
      g.traverse((node) => {
        if (node.isMesh && node.material === cushionMat) {
          const geo = node.geometry;
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            if (y <= -cushionW / 2 + 1e-3) {
              const x = pos.getX(i);
              const dir = Math.sign(x) || 1;
              pos.setX(i, x + dir * dCutAdjust);
            }
          }
          pos.needsUpdate = true;
          geo.computeVertexNormals();
        }
      });
    });
  }

  table.position.y = TABLE_Y;
  parent.add(table);
  return {
    centers: pocketCenters(),
    baulkZ,
    group: table,
    clothMat,
    cushionMat
  };
}
// --------------------------------------------------
// NEW Engine (no globals). Camera feels like standing at the side.
// --------------------------------------------------
function SnookerGame() {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const rules = useMemo(() => new SnookerRules(), []);
  const [hud, setHud] = useState({
    power: 0.65,
    A: 0,
    B: 0,
    turn: 0,
    phase: 'reds',
    next: 'red',
    inHand: false,
    over: false
  });
  const powerRef = useRef(hud.power);
  useEffect(() => {
    powerRef.current = hud.power;
  }, [hud.power]);
  const [err, setErr] = useState(null);
  const fireRef = useRef(() => {}); // set from effect so slider can trigger fire()
  const cameraRef = useRef(null);
  const sphRef = useRef(null);
  const rendererRef = useRef(null);
  const last3DRef = useRef({ phi: 1.05, theta: Math.PI });
  const fitRef = useRef(() => {});
  const topViewRef = useRef(false);
  const [topView, setTopView] = useState(false);
  const aimDirRef = useRef(new THREE.Vector2(0, 1));
  const playerOffsetRef = useRef(0);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);
  const spinRef = useRef({ x: 0, y: 0 });
  const tipGroupRef = useRef(null);
  const spinRangeRef = useRef(0);
  const cueRef = useRef(null);
  const ballsRef = useRef([]);
  const [player, setPlayer] = useState({ name: '', avatar: '' });
  const panelsRef = useRef(null);
  const { mapDelta } = useAimCalibration();
  useEffect(() => {
    document.title = '3D Snooker';
  }, []);
  useEffect(() => {
    setPlayer({
      name: getTelegramUsername() || 'Player',
      avatar: getTelegramPhotoUrl()
    });
  }, []);
  useEffect(() => {
    let wakeLock;
    const request = async () => {
      try {
        wakeLock = await navigator.wakeLock?.request('screen');
      } catch (e) {
        console.warn('wakeLock request failed', e);
      }
    };
    request();
    const handleVis = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      try {
        wakeLock?.release();
      } catch {}
    };
  }, []);
  const aiFlag = useMemo(
    () => FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)],
    []
  );
  const aiShoot = useRef(() => {
    aimDirRef.current.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
    powerRef.current = 0.5;
    setHud((s) => ({ ...s, power: 0.5 }));
    fireRef.current?.();
  });

  // determine which sides of the cue ball are blocked by nearby balls or rails
  const getBlockedSides = () => {
    const cue = cueRef.current;
    const balls = ballsRef.current;
    const sides = { left: false, right: false, up: false, down: false };
    if (!cue) return sides;
    const thresh = BALL_R * 2 + CUE_TIP_GAP;
    for (const b of balls) {
      if (!b.active || b === cue) continue;
      const dx = b.pos.x - cue.pos.x;
      const dz = b.pos.y - cue.pos.y;
      if (Math.hypot(dx, dz) < thresh) {
        if (dx > 0) sides.right = true;
        if (dx < 0) sides.left = true;
        if (dz > 0) sides.up = true;
        if (dz < 0) sides.down = true;
      }
    }
    const halfW = PLAY_W / 2;
    const halfH = PLAY_H / 2;
    if (cue.pos.x + BALL_R >= halfW) sides.right = true;
    if (cue.pos.x - BALL_R <= -halfW) sides.left = true;
    if (cue.pos.y + BALL_R >= halfH) sides.up = true;
    if (cue.pos.y - BALL_R <= -halfH) sides.down = true;
    return sides;
  };

  const drawHudPanel = (ctx, logo, avatarImg, name, score, t, emoji) => {
    const c = ctx.canvas;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, w, h);
    if (logo && logo.complete) ctx.drawImage(logo, w / 2 - 64, 5, 128, 64);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '28px sans-serif';
    if (avatarImg && avatarImg.complete)
      ctx.drawImage(avatarImg, 20, 100, 64, 64);
    else if (emoji) {
      ctx.font = '48px serif';
      ctx.fillText(emoji, 52, 150);
    }
    ctx.textAlign = 'left';
    ctx.font = '24px sans-serif';
    ctx.fillText(name, 100, 120);
    ctx.fillText(`Score: ${score}`, 100, 160);
    ctx.fillText(`Time: ${t}`, 100, 200);
  };

  const updateHudPanels = useCallback(() => {
    const panels = panelsRef.current;
    if (!panels) return;
    const { A, B, C, D, logo, playerImg } = panels;
    drawHudPanel(A.ctx, logo, playerImg, player.name, hud.A, timer);
    A.tex.needsUpdate = true;
    drawHudPanel(B.ctx, logo, null, 'AI', hud.B, timer, aiFlag);
    B.tex.needsUpdate = true;
    drawHudPanel(C.ctx, logo, playerImg, player.name, hud.A, timer);
    C.tex.needsUpdate = true;
    drawHudPanel(D.ctx, logo, null, 'AI', hud.B, timer, aiFlag);
    D.tex.needsUpdate = true;
  }, [hud.A, hud.B, timer, player.name, aiFlag]);

  useEffect(() => {
    updateHudPanels();
  }, [updateHudPanels]);

  // Removed camera rotation helpers previously triggered by UI buttons

  const toggleView = () => {
    const cam = cameraRef.current;
    const sph = sphRef.current;
    const fit = fitRef.current;
    if (!cam || !sph || !fit) return;
    const next = !topViewRef.current;
    const start = {
      radius: sph.radius,
      phi: sph.phi,
      theta: sph.theta
    };
    if (next) last3DRef.current = { phi: sph.phi, theta: sph.theta };
      const targetMargin = next
        ? 1.05
        : window.innerHeight > window.innerWidth
          ? 1.6
          : 1.4;
    const target = {
      radius: fitRadius(cam, targetMargin),
      phi: next ? 0.0001 : last3DRef.current.phi,
      theta: next ? sph.theta : last3DRef.current.theta
    };
    const duration = 600;
    const t0 = performance.now();
    function anim(t) {
      const k = Math.min(1, (t - t0) / duration);
      const ease = k * (2 - k);
      sph.radius = start.radius + (target.radius - start.radius) * ease;
      sph.phi = start.phi + (target.phi - start.phi) * ease;
      sph.theta = start.theta + (target.theta - start.theta) * ease;
      const targetPos = new THREE.Vector3(
        playerOffsetRef.current,
        TABLE_Y + 0.05,
        0
      ).multiplyScalar(worldScaleFactor);
      cam.position.setFromSpherical(sph).add(targetPos);
      cam.lookAt(targetPos);
      if (k < 1) requestAnimationFrame(anim);
      else {
        topViewRef.current = next;
        setTopView(next);
        if (rendererRef.current) {
          rendererRef.current.domElement.style.transform = next
            ? 'scale(0.9)'
            : 'scale(1)';
        }
        fit(targetMargin);
      }
    }
    requestAnimationFrame(anim);
  };

  useEffect(() => {
    if (hud.over) return;
    const playerTurn = hud.turn;
    const duration = playerTurn === 0 ? 60 : 5;
    setTimer(duration);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (playerTurn === 0) {
            setHud((s) => ({ ...s, turn: 1 - s.turn }));
          } else {
            aiShoot.current();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [hud.turn, hud.over]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    try {
      screen.orientation?.lock?.('portrait').catch(() => {});
      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.useLegacyLights = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // Ensure the canvas fills the host element so the table is centered and
      // scaled correctly on all view modes.
      renderer.setSize(host.clientWidth, host.clientHeight);
      host.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', (e) =>
        e.preventDefault()
      );
      rendererRef.current = renderer;
      renderer.domElement.style.transformOrigin = 'top left';

      // Scene & Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050505);
      const world = new THREE.Group();
      scene.add(world);
      let worldScaleFactor = 1;
      RectAreaLightUniformsLib.init();
      let cue;
      let clothMat;
      let cushionMat;
      let shooting = false; // track when a shot is in progress
      let activeShotView = null;
      let cueAnimating = false; // forward stroke animation state
      const legHeight = TABLE.THICK * 2 * 3 * 1.15 * 2.25;
      const floorY = TABLE_Y - TABLE.THICK - legHeight + 0.3;
      const roomWidth = TABLE.W * 3.2;
      const roomDepth = TABLE.H * 3.6;
      const wallThickness = 1.2;
      const wallHeight = legHeight + TABLE.THICK + 40;
      const carpetThickness = 1.2;
      const carpetInset = wallThickness * 0.02;
      const carpetWidth = roomWidth - wallThickness + carpetInset;
      const carpetDepth = roomDepth - wallThickness + carpetInset;
      const carpet = new THREE.Mesh(
        new THREE.BoxGeometry(carpetWidth, carpetThickness, carpetDepth),
        new THREE.MeshStandardMaterial({
          color: 0x8c2f2f,
          roughness: 0.9,
          metalness: 0.05
        })
      );
      carpet.castShadow = false;
      carpet.receiveShadow = true;
      carpet.position.set(0, floorY - carpetThickness / 2, 0);
      world.add(carpet);

      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.88,
        metalness: 0.06
      });

      const makeWall = (width, height, depth) => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          wallMat
        );
        wall.castShadow = false;
        wall.receiveShadow = true;
        wall.position.y = floorY + height / 2;
        world.add(wall);
        return wall;
      };

      const backWall = makeWall(roomWidth, wallHeight, wallThickness);
      backWall.position.z = roomDepth / 2;

      const frontWall = makeWall(roomWidth, wallHeight, wallThickness);
      frontWall.position.z = -roomDepth / 2;

      const leftWall = makeWall(wallThickness, wallHeight, roomDepth);
      leftWall.position.x = -roomWidth / 2;

      const rightWall = makeWall(wallThickness, wallHeight, roomDepth);
      rightWall.position.x = roomWidth / 2;
        const camera = new THREE.PerspectiveCamera(
          CAMERA.fov,
          host.clientWidth / host.clientHeight,
          CAMERA.near,
          CAMERA.far
        );
        // Start behind baulk colours
        const sph = new THREE.Spherical(
          BREAK_VIEW.radius,
          BREAK_VIEW.phi, // drop the break view slightly lower for a tighter angle
          Math.PI
        );
        const updateCamera = () => {
          let target = null;
          if (topViewRef.current) {
            target = new THREE.Vector3(
              playerOffsetRef.current,
              TABLE_Y + 0.05,
              0
            ).multiplyScalar(worldScaleFactor);
            camera.position.set(target.x, sph.radius, target.z);
            camera.lookAt(target);
          } else if (shooting && activeShotView) {
            target = activeShotView.target
              .clone()
              .multiplyScalar(worldScaleFactor);
            shotSph.radius = activeShotView.radius;
            shotSph.phi = activeShotView.phi;
            shotSph.theta = activeShotView.theta;
            camera.position.setFromSpherical(shotSph).add(target);
            camera.lookAt(target);
          } else {
            const followCue = cue?.mesh && cue.active && !shooting;
            target = (
              followCue
                ? new THREE.Vector3(cue.pos.x, BALL_R, cue.pos.y)
                : new THREE.Vector3(playerOffsetRef.current, TABLE_Y + 0.05, 0)
            ).multiplyScalar(worldScaleFactor);
            camera.position.setFromSpherical(sph).add(target);
            camera.lookAt(target);
          }
          if (clothMat && target) {
            const dist = camera.position.distanceTo(target);
            // Subtle detail up close, fade quicker in orbit view
            const fade = THREE.MathUtils.clamp((120 - dist) / 50, 0, 1);
            const rep = THREE.MathUtils.lerp(12, 24, fade);
            clothMat.map?.repeat.set(rep, rep);
          }
        };
        const lerpAngle = (a, b, t) => {
          const delta =
            THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) -
            Math.PI;
          return a + delta * t;
        };
        const animateCamera = ({
          radius,
          phi,
          theta,
          duration = 600
        } = {}) => {
          const start = {
            radius: sph.radius,
            phi: sph.phi,
            theta: sph.theta
          };
          const startTime = performance.now();
          const ease = (k) => k * k * (3 - 2 * k);
          const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = ease(t);
            if (radius !== undefined) {
              sph.radius = THREE.MathUtils.lerp(start.radius, radius, eased);
            }
            if (phi !== undefined) {
              sph.phi = THREE.MathUtils.lerp(start.phi, phi, eased);
            }
            if (theta !== undefined) {
              sph.theta = lerpAngle(start.theta, theta, eased);
            }
            updateCamera();
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        };
        const fit = (m = 1.1) => {
          camera.aspect = host.clientWidth / host.clientHeight;
          const baseR = fitRadius(camera, m);
          let t = (sph.phi - CAMERA.minPhi) / (CAMERA.maxPhi - CAMERA.minPhi);
          let r = baseR * (1 - 0.8 * t);
          const railLimit = TABLE.THICK + 0.4; // stay above side rails
          const phiCap = Math.acos(THREE.MathUtils.clamp(railLimit / r, -1, 1));
          sph.phi = clamp(
            sph.phi,
            CAMERA.minPhi,
            Math.min(phiCap, CAMERA.maxPhi)
          );
          t = (sph.phi - CAMERA.minPhi) / (CAMERA.maxPhi - CAMERA.minPhi);
          sph.radius = clamp(baseR * (1 - 0.8 * t), CAMERA.minR, CAMERA.maxR);
          updateCamera();
          camera.updateProjectionMatrix();
        };
        cameraRef.current = camera;
        sphRef.current = sph;
        fitRef.current = fit;
        topViewRef.current = false;
        setTopView(false);
        fit(
          topViewRef.current
            ? 1.05
            : window.innerHeight > window.innerWidth
              ? 1.6
              : 1.4
        );
        // give a slightly wider, higher starting view at the break
        sph.radius *= 1.08;
        updateCamera();
        const dom = renderer.domElement;
        dom.style.touchAction = 'none';
        const balls = [];
        let project;
        const drag = { on: false, x: 0, y: 0, moved: false };
        const pinch = { active: false, dist: 0 };
        const down = (e) => {
          if (e.touches?.length === 2) {
            const [t1, t2] = e.touches;
            pinch.active = true;
            pinch.dist = Math.hypot(
              t1.clientX - t2.clientX,
              t1.clientY - t2.clientY
            );
            return;
          }
          if (topViewRef.current) return;
          drag.on = true;
          drag.moved = false;
          drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
          drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
        };
        const move = (e) => {
          if (pinch.active && e.touches?.length === 2) {
            const [t1, t2] = e.touches;
            const d = Math.hypot(
              t1.clientX - t2.clientX,
              t1.clientY - t2.clientY
            );
            const delta = pinch.dist - d;
            sph.radius = clamp(
              sph.radius + delta * 0.5,
              CAMERA.minR,
              CAMERA.maxR
            );
            pinch.dist = d;
            updateCamera();
            return;
          }
          if (topViewRef.current || !drag.on) return;
          const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
          const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
          const dx = x - drag.x;
          const dy = y - drag.y;
          if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
          if (drag.moved) {
            drag.x = x;
            drag.y = y;
            sph.theta -= dx * 0.005;
            sph.phi = clamp(sph.phi + dy * 0.003, CAMERA.minPhi, CAMERA.maxPhi);
            fit(
              topViewRef.current
                ? 1.05
                : window.innerHeight > window.innerWidth
                  ? 1.2
                  : 1.0
            );
          }
        };
        const up = () => {
          drag.on = false;
          drag.moved = false;
          pinch.active = false;
        };
        const wheel = (e) => {
          sph.radius = clamp(
            sph.radius + e.deltaY * 0.12,
            CAMERA.minR,
            CAMERA.maxR
          );
          updateCamera();
        };
        dom.addEventListener('mousedown', down);
        dom.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        dom.addEventListener('touchstart', down, { passive: true });
        dom.addEventListener('touchmove', move, { passive: true });
        window.addEventListener('touchend', up);
        dom.addEventListener('wheel', wheel, { passive: true });
        const keyRot = (e) => {
          if (topViewRef.current) return;
          const step = e.shiftKey ? 0.12 : 0.06;
          if (e.code === 'ArrowLeft') sph.theta += step;
          else if (e.code === 'ArrowRight') sph.theta -= step;
          else if (e.code === 'ArrowUp')
            sph.phi = clamp(sph.phi - step, CAMERA.minPhi, CAMERA.maxPhi);
          else if (e.code === 'ArrowDown')
            sph.phi = clamp(sph.phi + step, CAMERA.minPhi, CAMERA.maxPhi);
          else return;
          fit(window.innerHeight > window.innerWidth ? 1.6 : 1.4);
        };
        window.addEventListener('keydown', keyRot);

      // Lights
      // Place three spotlights above the table with a tighter footprint but extra brightness
      const lightHeight = TABLE_Y + 100; // raise spotlights slightly higher
      const rectSizeBase = 21;
      const rectSize = rectSizeBase * 0.6 * 0.9; // shrink footprint ~10%
      const lightIntensity = 31.68 * 1.1; // boost intensity by ~10%

      const makeLight = (x, z) => {
        const rect = new THREE.RectAreaLight(
          0xffffff,
          lightIntensity,
          rectSize,
          rectSize
        );
        rect.position.set(x, lightHeight, z);
        rect.lookAt(x, TABLE_Y, z);
        world.add(rect);
      };

      // evenly space three spotlights along the table center line
      const spacing = 2.0; // keep lights near the rails without overshooting the room
      const lightCount = 3;
      for (let i = 0; i < lightCount; i++) {
        const z = THREE.MathUtils.lerp(
          (-TABLE.H / 2) * spacing,
          (TABLE.H / 2) * spacing,
          (i + 0.5) / lightCount
        );
        makeLight(0, z);
      }

      // Table
      const {
        centers,
        baulkZ,
        group: table,
        clothMat: tableCloth,
        cushionMat: tableCushion
      } = Table3D(world);
      clothMat = tableCloth;
      cushionMat = tableCushion;
      // ensure the camera respects the configured zoom limits
      sph.radius = Math.min(sph.radius, CAMERA.maxR);
      worldScaleFactor = WORLD_SCALE;
      world.scale.setScalar(worldScaleFactor);
      world.updateMatrixWorld(true);
      updateCamera();

      // Balls (ONLY Guret)
      const add = (id, color, x, z) => {
        const b = Guret(table, id, color, x, z);
        balls.push(b);
        return b;
      };
      cue = add('cue', COLORS.cue, -BALL_R * 2, baulkZ);
      const SPOTS = spotPositions(baulkZ);

      // 15 red balls arranged in triangle behind the pink
      const startZ = SPOTS.pink[1] + BALL_R * 2;
      let rid = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          if (rid >= 15) break;
          const x = (i - row / 2) * (BALL_R * 2 + 0.002 * (BALL_R / 0.0525));
          const z = startZ + row * (BALL_R * 1.9);
          add(`red_${rid++}`, COLORS.red, x, z);
        }
      }

      // colours
      const colors = Object.fromEntries(
        Object.entries(SPOTS).map(([k, [x, z]]) => [k, add(k, COLORS[k], x, z)])
      );

      cueRef.current = cue;
      ballsRef.current = balls;

      // Aiming visuals
      const aimMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.9
      });
      const aimGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const aim = new THREE.Line(aimGeom, aimMat);
      aim.visible = false;
      table.add(aim);
      const tickGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const tick = new THREE.Line(
        tickGeom,
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      tick.visible = false;
      table.add(tick);

      const targetGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const target = new THREE.Line(
        targetGeom,
        new THREE.LineDashedMaterial({
          color: 0xffffff,
          dashSize: 1,
          gapSize: 1,
          transparent: true,
          opacity: 0.5
        })
      );
      target.visible = false;
      table.add(target);

      // Cue stick behind cueball
      const SCALE = BALL_R / 0.0525;
      const cueLen = 1.5 * SCALE;
      const cueStick = new THREE.Group();

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008 * SCALE, 0.025 * SCALE, cueLen, 32),
        new THREE.MeshPhysicalMaterial({ color: 0xdeb887, roughness: 0.6 })
      );
      shaft.rotation.x = -Math.PI / 2;
      cueStick.add(shaft);

      // group for tip & connector so only the thin end moves for spin
      const tipGroup = new THREE.Group();
      tipGroup.position.z = -cueLen / 2;
      cueStick.add(tipGroup);
      tipGroupRef.current = tipGroup;

      // subtle leather-like texture for the tip
      const tipCanvas = document.createElement('canvas');
      tipCanvas.width = tipCanvas.height = 64;
      const tipCtx = tipCanvas.getContext('2d');
      tipCtx.fillStyle = '#1b3f75';
      tipCtx.fillRect(0, 0, 64, 64);
      tipCtx.strokeStyle = 'rgba(255,255,255,0.08)';
      tipCtx.lineWidth = 2;
      for (let i = 0; i < 64; i += 8) {
        tipCtx.beginPath();
        tipCtx.moveTo(i, 0);
        tipCtx.lineTo(i, 64);
        tipCtx.stroke();
      }
      tipCtx.globalAlpha = 0.2;
      tipCtx.fillStyle = 'rgba(12, 24, 60, 0.65)';
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const w = 6 + Math.random() * 10;
        const h = 2 + Math.random() * 4;
        tipCtx.beginPath();
        tipCtx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
        tipCtx.fill();
      }
      tipCtx.globalAlpha = 1;
      const tipTex = new THREE.CanvasTexture(tipCanvas);

      const tipRadius = 0.006 * SCALE;
      const tipLen = 0.015 * SCALE;
      const tipCylinderLen = Math.max(0, tipLen - tipRadius * 2);
      const tip = new THREE.Mesh(
        tipCylinderLen > 0
          ? new THREE.CapsuleGeometry(tipRadius, tipCylinderLen, 8, 16)
          : new THREE.SphereGeometry(tipRadius, 16, 16),
        new THREE.MeshStandardMaterial({
          color: 0x1f3f73,
          roughness: 1,
          metalness: 0,
          map: tipTex
        })
      );
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -tipLen / 2;
      tipGroup.add(tip);

      const connectorHeight = 0.015 * SCALE;
      const connector = new THREE.Mesh(
        new THREE.CylinderGeometry(
          tipRadius,
          0.008 * SCALE,
          connectorHeight,
          32
        ),
        new THREE.MeshPhysicalMaterial({
          color: 0xcd7f32,
          metalness: 0.8,
          roughness: 0.5
        })
      );
      connector.rotation.x = -Math.PI / 2;
      connector.position.z = connectorHeight / 2;
      tipGroup.add(connector);

      const buttCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 * SCALE, 32, 16),
        new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.5 })
      );
      buttCap.position.z = cueLen / 2;
      cueStick.add(buttCap);

      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      for (let i = 0; i < 12; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.01 * SCALE, 0.001 * SCALE, 0.35 * SCALE),
          stripeMat
        );
        const angle = (i / 12) * Math.PI * 2;
        stripe.position.x = Math.cos(angle) * 0.02 * SCALE;
        stripe.position.y = Math.sin(angle) * 0.02 * SCALE;
        stripe.position.z = 0.55 * SCALE;
        stripe.rotation.z = angle;
        cueStick.add(stripe);
      }

      cueStick.position.set(cue.pos.x, CUE_Y, cue.pos.y + 1.0 * SCALE);
      // thin side already faces the cue ball so no extra rotation
      cueStick.visible = false;
      table.add(cueStick);

      spinRangeRef.current = 0.05 * SCALE;

      // Pointer → XZ plane
      const pointer = new THREE.Vector2();
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -TABLE_Y * worldScaleFactor
      );
      project = (ev) => {
        const r = dom.getBoundingClientRect();
        const cx =
          (((ev.clientX ?? ev.touches?.[0]?.clientX ?? 0) - r.left) / r.width) *
            2 -
          1;
        const cy = -(
          (((ev.clientY ?? ev.touches?.[0]?.clientY ?? 0) - r.top) / r.height) *
            2 -
          1
        );
        pointer.set(cx, cy);
        ray.setFromCamera(pointer, camera);
        const pt = new THREE.Vector3();
        ray.ray.intersectPlane(plane, pt);
        return new THREE.Vector2(
          pt.x / worldScaleFactor,
          pt.z / worldScaleFactor
        );
      };

      const aimDir = aimDirRef.current;
      const camFwd = new THREE.Vector3();
      const shotSph = new THREE.Spherical();
      const tmpAim = new THREE.Vector2();

      // In-hand placement
      const free = (x, z) =>
        balls.every(
          (b) =>
            !b.active ||
            b === cue ||
            new THREE.Vector2(x, z).distanceTo(b.pos) > BALL_R * 2.1
        );
      const onPlace = (e) => {
        if (!hud.inHand) return;
        const p = project(e);
        if (
          p.y <= baulkZ &&
          Math.abs(p.x) <= PLAY_W / 2 - BALL_R * 2 &&
          free(p.x, p.y)
        ) {
          cue.active = true;
          cue.mesh.visible = true;
          cue.pos.set(p.x, p.y);
          cue.mesh.position.set(p.x, BALL_R, p.y);
          setHud((s) => ({ ...s, inHand: false }));
        }
      };
      dom.addEventListener('pointerdown', onPlace);

      // Shot lifecycle
      let potted = [];
      let foul = false;
      let firstHit = null;
      const legalTarget = () =>
        hud.phase === 'reds'
          ? hud.next === 'red'
            ? 'red'
            : 'colour'
          : hud.next;
      const isRedId = (id) => id.startsWith('red');
      const values = rules.getBallValues();
      const val = (id) =>
        isRedId(id) ? values.RED : values[id.toUpperCase()] || 0;

        // Fire (slider e thërret në release)
        const fire = () => {
          if (!cue?.active || hud.inHand || !allStopped(balls) || hud.over)
            return;
          shooting = true;
          potted = [];
          foul = false;
          firstHit = null;
          clearInterval(timerRef.current);
          const aimDir = aimDirRef.current.clone();
          const base = aimDir
            .clone()
            .multiplyScalar(4.2 * (0.48 + powerRef.current * 1.52) * 0.5);
          const spinSide = spinRef.current.x * spinRangeRef.current;
          const spinTop = -spinRef.current.y * spinRangeRef.current;
          const sideVec = new THREE.Vector2(-aimDir.y, aimDir.x).multiplyScalar(
            spinSide
          );
          const topVec = aimDir.clone().multiplyScalar(spinTop);
          cue.vel.copy(base).add(sideVec).add(topVec);

          // lock the camera to the shooter's view without following the balls mid-shot
          if (cameraRef.current && sphRef.current) {
            topViewRef.current = false;
            const sph = sphRef.current;
            const shotTheta = Math.atan2(aimDir.x, aimDir.y) + Math.PI;
            const shotPhi = clamp(
              BREAK_VIEW.phi + SHOT_VIEW_OFFSET.phiOffset,
              CAMERA.minPhi,
              CAMERA.maxPhi
            );
            const shotRadius = clamp(
              BREAK_VIEW.radius * SHOT_VIEW_OFFSET.radiusFactor,
              CAMERA.minR,
              CAMERA.maxR
            );
            activeShotView = {
              radius: shotRadius,
              phi: shotPhi,
              theta: shotTheta,
              target: new THREE.Vector3(cue.pos.x, BALL_R, cue.pos.y)
            };
            sph.theta = shotTheta;
            sph.phi = shotPhi;
            sph.radius = shotRadius;
            updateCamera();
          }

          // animate cue stick forward
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y).normalize();
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const desiredPull = powerRef.current * BALL_R * 10 * 0.65;
          const maxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const pull = Math.min(desiredPull, maxPull);
          cueAnimating = true;
          const startPos = cueStick.position.clone();
          const endPos = startPos.clone().add(dir.clone().multiplyScalar(pull));
          let animFrame = 0;
          const animSteps = 5;
          const animateCue = () => {
            animFrame++;
            cueStick.position.lerpVectors(
              startPos,
              endPos,
              animFrame / animSteps
            );
            if (animFrame < animSteps) {
              requestAnimationFrame(animateCue);
            } else {
              let backFrame = 0;
              const animateBack = () => {
                backFrame++;
                cueStick.position.lerpVectors(
                  endPos,
                  startPos,
                  backFrame / animSteps
                );
                if (backFrame < animSteps) requestAnimationFrame(animateBack);
                else {
                  cueStick.visible = false;
                  cueAnimating = false;
                  if (cameraRef.current && sphRef.current) {
                    topViewRef.current = false;
                    const sph = sphRef.current;
                    sph.theta = Math.atan2(aimDir.x, aimDir.y) + Math.PI;
                    updateCamera();
                  }
                }
              };
              requestAnimationFrame(animateBack);
            }
          };
          animateCue();
        };
        fireRef.current = fire;

      // Resolve shot
      function resolve() {
        const me = hud.turn === 0 ? 'A' : 'B',
          op = hud.turn === 0 ? 'B' : 'A';
        let gain = 0;
        let swap = true;
        if (!cue.active) foul = true;
        const target = legalTarget();
        if (firstHit) {
          if (target === 'red' && !isRedId(firstHit)) foul = true;
          else if (target === 'colour' && isRedId(firstHit)) foul = true;
          else if (
            target !== 'red' &&
            target !== 'colour' &&
            firstHit !== target
          )
            foul = true;
        } else {
          foul = true;
        }
        const reds = potted.filter(isRedId),
          cols = potted.filter((id) => !isRedId(id));
        if (hud.phase === 'reds') {
          if (hud.next === 'red') {
            if (cols.length > 0) foul = true;
            gain += reds.length;
            if (reds.length > 0 && !foul) {
              setHud((s) => ({ ...s, next: 'colour' }));
              swap = false;
            }
          } else {
            if (reds.length > 0) foul = true;
            if (cols.length > 0 && !foul) {
              cols.forEach((id) => {
                gain += val(id);
                const b = colors[id];
                if (b) {
                  const [sx, sy] = SPOTS[id];
                  b.active = true;
                  b.mesh.visible = true;
                  b.pos.set(sx, sy);
                  b.mesh.position.set(sx, BALL_R, sy);
                }
              });
              setHud((s) => ({ ...s, next: 'red' }));
              swap = false;
            }
          }
          const redsLeft = balls.some((b) => b.active && isRedId(b.id));
          if (!redsLeft)
            setHud((s) => ({ ...s, phase: 'colors', next: 'yellow' }));
        } else {
          if (
            cols.length === 1 &&
            reds.length === 0 &&
            cols[0] === hud.next &&
            !foul
          ) {
            gain += val(hud.next);
            const order = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
            const idx = order.indexOf(hud.next);
            const nxt = order[idx + 1];
            if (nxt) {
              setHud((s) => ({ ...s, next: nxt }));
              swap = false;
            } else {
              setHud((s) => ({ ...s, over: true }));
            }
          } else if (cols.length > 0 || reds.length > 0) {
            foul = true;
          }
        }
        if (foul) {
          const foulPts = Math.max(
            4,
            ...potted.map((id) => val(id)),
            cue.active ? 0 : 4
          );
          setHud((s) => ({
            ...s,
            [op]: s[op] + foulPts,
            inHand: true,
            next: s.phase === 'reds' ? 'red' : s.next
          }));
          cue.active = false;
          cue.mesh.visible = false;
          cue.vel.set(0, 0);
        } else if (gain > 0) {
          setHud((s) => ({ ...s, [me]: s[me] + gain }));
        }
        if (swap || foul) setHud((s) => ({ ...s, turn: 1 - s.turn }));
          shooting = false;
          activeShotView = null;
          if (cameraRef.current && sphRef.current) {
            const cuePos = cue?.pos
              ? new THREE.Vector2(cue.pos.x, cue.pos.y)
              : new THREE.Vector2();
            const toCenter = new THREE.Vector2(-cuePos.x, -cuePos.y);
            if (toCenter.lengthSq() < 1e-4) toCenter.set(0, 1);
            else toCenter.normalize();
            const behindTheta = Math.atan2(toCenter.x, toCenter.y) + Math.PI;
            const behindPhi = clamp(
              BREAK_VIEW.phi,
              CAMERA.minPhi,
              CAMERA.maxPhi
            );
            const behindRadius = clamp(
              BREAK_VIEW.radius,
              CAMERA.minR,
              CAMERA.maxR
            );
            animateCamera({
              radius: behindRadius,
              phi: behindPhi,
              theta: behindTheta,
              duration: 600
            });
          }
          potted = [];
          foul = false;
          firstHit = null;
        }

      // Loop
      const step = () => {
        camera.getWorldDirection(camFwd);
        tmpAim.set(camFwd.x, camFwd.z).normalize();
        aimDir.lerp(tmpAim, 0.2);
        // Aiming vizual
        if (allStopped(balls) && !hud.inHand && cue?.active && !hud.over) {
          const { impact, afterDir, targetBall, railNormal } = calcTarget(
            cue,
            aimDir,
            balls
          );
          const start = new THREE.Vector3(cue.pos.x, BALL_R, cue.pos.y);
          let end = new THREE.Vector3(impact.x, BALL_R, impact.y);
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y).normalize();
          if (start.distanceTo(end) < 1e-4) {
            end = start.clone().add(dir.clone().multiplyScalar(BALL_R));
          }
          aimGeom.setFromPoints([start, end]);
          aim.visible = true;
          aim.material.color.set(
            targetBall && !railNormal ? 0xffff00 : 0xffffff
          );
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          tickGeom.setFromPoints([
            end.clone().add(perp.clone().multiplyScalar(1.4)),
            end.clone().add(perp.clone().multiplyScalar(-1.4))
          ]);
          tick.visible = true;
          const desiredPull = powerRef.current * BALL_R * 10 * 0.65;
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const maxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const pull = Math.min(desiredPull, maxPull);
          const side = spinRef.current.x * spinRangeRef.current;
          const vert = -spinRef.current.y * spinRangeRef.current;
          const spinWorld = new THREE.Vector3(
            perp.x * side,
            vert,
            perp.z * side
          );
          cueStick.position.set(
            cue.pos.x - dir.x * (cueLen / 2 + pull + CUE_TIP_GAP) + spinWorld.x,
            CUE_Y + spinWorld.y,
            cue.pos.y - dir.z * (cueLen / 2 + pull + CUE_TIP_GAP) + spinWorld.z
          );
          cueStick.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          cueStick.visible = true;
          if (afterDir) {
            const tEnd = new THREE.Vector3(
              end.x + afterDir.x * 30,
              BALL_R,
              end.z + afterDir.y * 30
            );
            targetGeom.setFromPoints([end, tEnd]);
            target.visible = true;
            target.computeLineDistances();
          } else {
            target.visible = false;
          }
        } else {
          aim.visible = false;
          tick.visible = false;
          target.visible = false;
          if (!cueAnimating) cueStick.visible = false;
        }

        // Fizika
        balls.forEach((b) => {
          if (!b.active) return;
          b.pos.add(b.vel);
          b.vel.multiplyScalar(FRICTION);
          const speed = b.vel.length();
          if (speed < STOP_EPS) b.vel.set(0, 0);
          reflectRails(b);
          b.mesh.position.set(b.pos.x, BALL_R, b.pos.y);
          if (speed > 0) {
            const axis = new THREE.Vector3(b.vel.y, 0, -b.vel.x).normalize();
            const angle = speed / BALL_R;
            b.mesh.rotateOnWorldAxis(axis, angle);
          }
        });
        // Kolizione + regjistro firstHit
        for (let i = 0; i < balls.length; i++)
          for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i],
              b = balls[j];
            if (!a.active || !b.active) continue;
            const dx = b.pos.x - a.pos.x,
              dy = b.pos.y - a.pos.y;
            const d2 = dx * dx + dy * dy;
            const min = (BALL_R * 2) ** 2;
            if (d2 > 0 && d2 < min) {
              const d = Math.sqrt(d2) || 1e-4;
              const nx = dx / d,
                ny = dy / d;
              const overlap = (BALL_R * 2 - d) / 2;
              a.pos.x -= nx * overlap;
              a.pos.y -= ny * overlap;
              b.pos.x += nx * overlap;
              b.pos.y += ny * overlap;
              const avn = a.vel.x * nx + a.vel.y * ny;
              const bvn = b.vel.x * nx + b.vel.y * ny;
              const at = a.vel
                .clone()
                .sub(new THREE.Vector2(nx, ny).multiplyScalar(avn));
              const bt = b.vel
                .clone()
                .sub(new THREE.Vector2(nx, ny).multiplyScalar(bvn));
              a.vel.copy(at.add(new THREE.Vector2(nx, ny).multiplyScalar(bvn)));
              b.vel.copy(bt.add(new THREE.Vector2(nx, ny).multiplyScalar(avn)));
              if (!firstHit) {
                if (a.id === 'cue' && b.id !== 'cue') firstHit = b.id;
                else if (b.id === 'cue' && a.id !== 'cue') firstHit = a.id;
              }
            }
          }
        // Kapje në xhepa
        balls.forEach((b) => {
          if (!b.active) return;
          for (const c of centers) {
            if (b.pos.distanceTo(c) < CAPTURE_R) {
              b.active = false;
              b.mesh.visible = false;
              b.vel.set(0, 0);
              if (b !== cue) potted.push(b.id.startsWith('red') ? 'red' : b.id);
              break;
            }
          }
        });
        // Fund i goditjes
          if (shooting) {
            const any = balls.some((b) => b.active && b.vel.length() >= STOP_EPS);
            if (!any) resolve();
          }
          const fit = fitRef.current;
          if (fit && cue?.active && !shooting) {
            const limX = PLAY_W / 2 - BALL_R - TABLE.WALL;
            const limY = PLAY_H / 2 - BALL_R - TABLE.WALL;
            const edgeX = Math.max(0, Math.abs(cue.pos.x) - (limX - 5));
            const edgeY = Math.max(0, Math.abs(cue.pos.y) - (limY - 5));
            const edge = Math.min(1, Math.max(edgeX, edgeY) / 5);
            fit(1 + edge * 0.08);
          }
          updateCamera();
          renderer.render(scene, camera);
          rafRef.current = requestAnimationFrame(step);
        };
        step();

      // Resize
      const onResize = () => {
        // Update canvas dimensions when the window size changes so the table
        // remains fully visible.
          renderer.setSize(host.clientWidth, host.clientHeight);
          fit(
            topViewRef.current
              ? 1.05
              : window.innerHeight > window.innerWidth
                ? 1.6
                : 1.4
          );
        };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', onResize);
        try {
          host.removeChild(renderer.domElement);
        } catch {}
        dom.removeEventListener('mousedown', down);
        dom.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        dom.removeEventListener('touchstart', down);
        dom.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        dom.removeEventListener('wheel', wheel);
        window.removeEventListener('keydown', keyRot);
        dom.removeEventListener('pointerdown', onPlace);
      };
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    }
  }, [hud.inHand, hud.over]);

  // --------------------------------------------------
  // NEW Big Pull Slider (right side): drag DOWN to set power, releases → fire()
  // --------------------------------------------------
  const sliderRef = useRef(null);
  useEffect(() => {
    const mount = sliderRef.current;
    if (!mount) return;
    const slider = new SnookerPowerSlider({
      mount,
      value: powerRef.current * 100,
      cueSrc: '/assets/snooker/cue.webp',
      labels: true,
      onChange: (v) => setHud((s) => ({ ...s, power: v / 100 })),
      onCommit: () => fireRef.current?.()
    });
    return () => {
      mount.innerHTML = '';
      slider.el?.remove?.();
    };
  }, []);

  // Spin controller interactions
  useEffect(() => {
    const box = document.getElementById('spinBox');
    const dot = document.getElementById('spinDot');
    if (!box || !dot) return;
    const move = (e) => {
      const rect = box.getBoundingClientRect();
      const x =
        (((e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left) /
          rect.width) *
          2 -
        1;
      const y =
        (((e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top) /
          rect.height) *
          2 -
        1;
      let nx = x,
        ny = y;
      const r = Math.hypot(nx, ny);
      if (r > 1) {
        nx /= r;
        ny /= r;
      }
      // Allow spin in all directions without blocking
      spinRef.current = { x: nx, y: ny };
      dot.style.transform = `translate(${(nx * rect.width) / 2}px, ${(ny * rect.height) / 2}px)`;
    };
    const up = () => {
      box.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    const down = (e) => {
      move(e);
      box.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    box.addEventListener('pointerdown', down);
    return () => {
      box.removeEventListener('pointerdown', down);
      box.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <div className="w-full h-[100vh] bg-black text-white overflow-hidden select-none">
      {/* Canvas host now stretches full width so table reaches the slider */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50">
        <div
          className="bg-gray-800 px-4 py-2 rounded-b flex flex-col items-center text-white"
          style={{
            transform: `scale(${UI_SCALE})`,
            transformOrigin: 'top center'
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img
                src={player.avatar || '/assets/icons/profile.svg'}
                alt="player"
                className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400"
              />
              <span className={hud.turn === 0 ? 'text-yellow-400' : ''}>
                {player.name}
              </span>
            </div>
            <div className="text-xl font-bold">
              {hud.A} - {hud.B}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full border-2 border-yellow-400 flex items-center justify-center">
                <span className="text-3xl leading-none">{aiFlag}</span>
              </div>
              <span className={hud.turn === 1 ? 'text-yellow-400' : ''}>
                AI
              </span>
            </div>
          </div>
          <div className="mt-1 text-sm">Time: {timer}</div>
        </div>
      </div>

      {err && (
        <div className="absolute inset-0 bg-black/80 text-white text-xs flex items-center justify-center p-4 z-50">
          Init error: {String(err)}
        </div>
      )}
      {/* Power Slider */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <div
          ref={sliderRef}
          style={{
            transform: `scale(${UI_SCALE})`,
            transformOrigin: 'top right'
          }}
        />
      </div>

      {/* Spin controller */}
      <div
        className="absolute bottom-4 right-4"
        style={{
          transform: `scale(${UI_SCALE})`,
          transformOrigin: 'bottom right'
        }}
      >
        <div
          id="spinBox"
          className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
        >
          <div id="spinDot" className="w-2 h-2 rounded-full bg-red-600"></div>
        </div>
      </div>
    </div>
  );
}

export default function NewSnookerGame() {
  const isMobileOrTablet = useIsMobile(1366);

  if (!isMobileOrTablet) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4 text-center">
        <p>This game is available on mobile phones and tablets only.</p>
      </div>
    );
  }

  return <SnookerGame />;
}
