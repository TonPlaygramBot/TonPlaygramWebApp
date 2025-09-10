import * as THREE from 'three';

// Real-world reference dimensions in centimeters
const BALL_DIAMETER_CM = 6.7; // ITF spec range ~6.54–6.86cm
const RACKET_LENGTH_CM = 68.6; // 27"
const HEAD_RX = 12; // racket head ellipse radius X
const HEAD_RY = 17; // racket head ellipse radius Y

// ---------- Materials ----------
function graphiteMaterial(hex = 0x1e2229) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.35,
    metalness: 0.12,
  });
}

function overgripMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x0e0f12,
    roughness: 0.8,
    metalness: 0.02,
  });
}

function stringMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xe8e8e8,
    roughness: 0.6,
    metalness: 0.0,
  });
}

function bumperGuardMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.6 });
}

function tennisBallMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xccff00,
    roughness: 0.7,
    metalness: 0.0,
  });
}

// ---------- Geometry builders ----------
function buildRacketHeadRing({
  rx = HEAD_RX,
  ry = HEAD_RY,
  thickness = 1.35,
  depth = 2.1,
  segments = 128,
}) {
  const outer = new THREE.Shape();
  const ptsOut = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    ptsOut.push(
      new THREE.Vector2(
        Math.cos(t) * (rx + thickness),
        Math.sin(t) * (ry + thickness),
      ),
    );
  }
  outer.setFromPoints(ptsOut);

  const hole = new THREE.Path();
  const ptsIn = [];
  for (let i = segments - 1; i >= 0; i--) {
    const t = (i / segments) * Math.PI * 2;
    ptsIn.push(new THREE.Vector2(Math.cos(t) * rx, Math.sin(t) * ry));
  }
  hole.setFromPoints(ptsIn);
  outer.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: segments,
  });
  geom.rotateX(Math.PI / 2);
  geom.translate(0, depth * 0.5, 0);
  return geom;
}

function buildStrings({
  rx = HEAD_RX,
  ry = HEAD_RY,
  mains = 16,
  crosses = 19,
  yOffset = 1.05,
}) {
  const group = new THREE.Group();
  const strMat = stringMaterial();
  const RAD = 0.06; // ~1.2 mm diameter

  // Mains (vertical)
  for (let i = 0; i < mains; i++) {
    const t = (i / (mains - 1)) * 2 - 1;
    const x = t * rx * 0.92;
    const zMax = Math.sqrt(Math.max(0, (1 - (x * x) / (rx * rx)) * (ry * ry))) * 0.92;
    const len = zMax * 2;
    if (len > 0.5) {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(RAD, RAD, len, 12),
        strMat,
      );
      cyl.rotation.z = Math.PI / 2;
      cyl.position.set(x, yOffset, 0);
      group.add(cyl);
    }
  }

  // Crosses (horizontal)
  for (let j = 0; j < crosses; j++) {
    const t = (j / (crosses - 1)) * 2 - 1;
    const z = t * ry * 0.92;
    const xMax = Math.sqrt(Math.max(0, (1 - (z * z) / (ry * ry)) * (rx * rx))) * 0.92;
    const len = xMax * 2;
    if (len > 0.5) {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(RAD, RAD, len, 12),
        strMat,
      );
      cyl.rotation.x = Math.PI / 2;
      cyl.position.set(0, yOffset + 0.08, z);
      group.add(cyl);
    }
  }

  return group;
}

function buildThroatAndShaft({ throatLen = 10, shaftLen = 16 }) {
  const g = new THREE.Group();
  const mat = graphiteMaterial();

  const beamW = 1.3,
    beamT = 1.2,
    beamL = throatLen;
  const beamLGeom = new THREE.BoxGeometry(beamW, beamT, beamL);
  const left = new THREE.Mesh(beamLGeom, mat);
  const right = new THREE.Mesh(beamLGeom, mat);
  left.position.set(-3.6, 1.2, -HEAD_RY * 0.92 - beamL / 2);
  right.position.set(3.6, 1.2, -HEAD_RY * 0.92 - beamL / 2);

  const yoke = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.6, 2.2), mat);
  yoke.position.set(0, 1.2, -HEAD_RY * 0.92 - throatLen - 1.1);

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, shaftLen), mat);
  shaft.position.set(
    0,
    1.2,
    -HEAD_RY * 0.92 - throatLen - 1.1 - shaftLen / 2,
  );

  g.add(left, right, yoke, shaft);
  return { group: g, shaftEndZ: shaft.position.z - shaftLen / 2 };
}

function buildHandle({ startZ, gripLen = 17, oct = 8 }) {
  const g = new THREE.Group();
  const radius = 1.6; // ~3.2 cm across flats
  const shape = new THREE.Shape();
  for (let i = 0; i < oct; i++) {
    const a = (i / oct) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: gripLen,
    bevelEnabled: false,
  });
  geom.rotateX(Math.PI / 2);
  geom.translate(0, 0.9, startZ - gripLen / 2);

  const grip = new THREE.Mesh(geom, overgripMaterial());
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.98, radius * 0.98, 1.2, oct),
    overgripMaterial(),
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.set(0, 0.9, startZ - gripLen - 0.6);

  g.add(grip, cap);
  return g;
}

function buildBumperGuard() {
  const geom = new THREE.TorusGeometry(HEAD_RX, 0.35, 10, 100, Math.PI * 0.55);
  const mesh = new THREE.Mesh(geom, bumperGuardMaterial());
  mesh.rotation.set(Math.PI / 2, 0, 0);
  mesh.position.set(0, 2.1, HEAD_RY * 0.8);
  return mesh;
}

export function buildRacket() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(buildRacketHeadRing({}), graphiteMaterial());
  const strings = buildStrings({});
  const { group: throat, shaftEndZ } = buildThroatAndShaft({});
  const handle = buildHandle({ startZ: shaftEndZ });
  const bumper = buildBumperGuard();
  g.add(head, strings, throat, handle, bumper);
  return g;
}

export function buildTennisBall() {
  const r = BALL_DIAMETER_CM / 2;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(r, 64, 48),
    tennisBallMaterial(),
  );
  const seamMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.0,
  });
  const tubeR = 0.12; // ~2.4 mm

  function seamCurve(phiOffset) {
    class Seam extends THREE.Curve {
      getPoint(t) {
        const u = t * 2 * Math.PI;
        const phi = u + phiOffset;
        const theta = Math.PI / 2 + 0.18 * Math.sin(2 * u);
        const x = r * Math.cos(phi) * Math.sin(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(theta);
        return new THREE.Vector3(x, y, z);
      }
    }
    return new Seam();
  }

  const seam1 = new THREE.Mesh(
    new THREE.TubeGeometry(seamCurve(0), 400, tubeR, 16, true),
    seamMat,
  );
  const seam2 = new THREE.Mesh(
    new THREE.TubeGeometry(seamCurve(Math.PI / 2), 400, tubeR, 16, true),
    seamMat,
  );
  ball.add(seam1, seam2);
  return ball;
}

export { BALL_DIAMETER_CM, RACKET_LENGTH_CM };
