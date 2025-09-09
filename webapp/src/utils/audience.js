import * as THREE from 'three';

const COLORS = {
  wall: 0x0f1013,
  floor: 0x111213,
  stair: 0x1b1d20,
  riser: 0x17181b,
  seat: 0x2a2f3a,
  chair: 0x3b4250,
  metal: 0x8c97a6,
  skin: 0xffd7b3,
  hairD: 0x222222,
  hairL: 0x7d5a3c,
  shirt1: 0x2a76ff,
  shirt2: 0x22c55e,
  shirt3: 0xf59e0b,
  pants1: 0x39424e,
  pants2: 0x1f2937,
  shoe: 0x0c0c0c
};

function mat(color, rough = 0.85, metal = 0.1) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function box(w, h, d, c) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
}
function cyl(rt, rb, h, c, seg = 18) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, 0.75, 0.12));
}
function sph(r, c, seg = 20) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat(c, 0.65, 0));
}

function buildChair() {
  const g = new THREE.Group();
  const seatH = 1.0;
  const seat = box(1.2, 0.18, 1.1, COLORS.seat);
  seat.position.set(0, seatH, 0);
  g.add(seat);
  const back = box(1.2, 1.2, 0.12, COLORS.chair);
  back.position.set(0, seatH + 0.7, -0.55);
  g.add(back);
  const legH = seatH;
  const legR = 0.08;
  [[-0.55, legH * 0.5, -0.5], [0.55, legH * 0.5, -0.5], [-0.55, legH * 0.5, 0.5], [0.55, legH * 0.5, 0.5]].forEach(([x, y, z]) => {
    const leg = cyl(legR, legR, legH, COLORS.chair, 10);
    leg.position.set(x, y, z);
    g.add(leg);
  });
  return g;
}

function buildHumanVariant() {
  const g = new THREE.Group();
  const shirts = [COLORS.shirt1, COLORS.shirt2, COLORS.shirt3];
  const pants = [COLORS.pants1, COLORS.pants2];
  const hair = [COLORS.hairD, COLORS.hairL];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const HEAD = 0.5;
  const torso = cyl(0.45, 0.55, 1.2, pick(shirts));
  torso.position.set(0, 1.2 * 0.5 + 1.1, 0);
  g.add(torso);
  const neck = cyl(0.1, 0.12, 0.16, COLORS.skin, 12);
  neck.position.set(0, torso.position.y + 0.7, 0);
  g.add(neck);
  const head = sph(HEAD, COLORS.skin, 16);
  head.position.set(0, neck.position.y + HEAD + 0.02, 0);
  g.add(head);
  const hairCap = cyl(HEAD * 1.02, HEAD * 1.02, 0.18, pick(hair), 14);
  hairCap.position.set(0, head.position.y + 0.25, 0);
  g.add(hairCap);
  const hips = box(0.9, 0.25, 0.7, pick(pants));
  hips.position.set(0, 1.05, 0.05);
  g.add(hips);
  const thighL = cyl(0.18, 0.2, 0.7, pick(pants), 12);
  const thighR = thighL.clone();
  thighL.position.set(-0.32, 0.95, 0.25);
  thighR.position.set(0.32, 0.95, 0.25);
  thighL.rotation.x = -Math.PI / 2.3;
  thighR.rotation.x = -Math.PI / 2.3;
  g.add(thighL, thighR);
  const calfL = cyl(0.16, 0.18, 0.65, pick(pants), 12);
  const calfR = calfL.clone();
  calfL.position.set(-0.32, 0.5, 0.7);
  calfR.position.set(0.32, 0.5, 0.7);
  calfL.rotation.x = Math.PI / 64;
  calfR.rotation.x = Math.PI / 64;
  g.add(calfL, calfR);
  const shoeL = box(0.24, 0.12, 0.36, COLORS.shoe);
  const shoeR = shoeL.clone();
  shoeL.position.set(-0.32, 0.12, 0.98);
  shoeR.position.set(0.32, 0.12, 0.98);
  g.add(shoeL, shoeR);
  const uArmL = cyl(0.14, 0.16, 0.5, pick(shirts), 12);
  const uArmR = uArmL.clone();
  uArmL.position.set(-0.6, 1.55, 0.1);
  uArmR.position.set(0.6, 1.55, 0.1);
  uArmL.rotation.x = -Math.PI / 3.0;
  uArmR.rotation.x = -Math.PI / 3.0;
  g.add(uArmL, uArmR);
  const fArmL = cyl(0.12, 0.14, 0.45, COLORS.skin, 12);
  const fArmR = fArmL.clone();
  fArmL.position.set(-0.48, 1.2, 0.5);
  fArmR.position.set(0.48, 1.2, 0.5);
  fArmL.rotation.x = -Math.PI / 8;
  fArmR.rotation.x = -Math.PI / 8;
  g.add(fArmL, fArmR);
  const handL = sph(0.1, COLORS.skin, 12);
  const handR = handL.clone();
  handL.position.set(-0.42, 1.0, 0.78);
  handR.position.set(0.42, 1.0, 0.78);
  g.add(handL, handR);
  return g;
}

function buildRow(seats, seatSpacing = 1.6) {
  const g = new THREE.Group();
  for (let i = 0; i < seats; i++) {
    const chair = buildChair();
    const human = buildHumanVariant();
    const x = (i - (seats - 1) / 2) * seatSpacing;
    chair.position.set(x, 0, 0);
    human.position.set(x, 0, 0);
    g.add(chair, human);
  }
  return g;
}

function buildTribune({ rows = 8, seatsPerRow = 14, rise = 0.55, depth = 1.65, aisles = [-5, 0, 5] }) {
  const g = new THREE.Group();
  for (let r = 0; r < rows; r++) {
    const y = r * rise;
    const z = -r * depth;
    const riser = box(seatsPerRow * 1.8 + 6, 0.25, 0.2, COLORS.riser);
    riser.position.set(0, y, z - depth / 2);
    g.add(riser);
    const tread = box(seatsPerRow * 1.8 + 6, 0.2, depth, COLORS.stair);
    tread.position.set(0, y + 0.1, z);
    g.add(tread);
    const row = buildRow(seatsPerRow);
    row.position.set(0, y, z + depth * 0.15);
    g.add(row);
  }
  aisles.forEach((ai) => {
    for (let r = 0; r < rows; r++) {
      const y = r * rise;
      const z = -r * depth;
      const step = box(0.9, 0.2, depth * 0.9, COLORS.stair);
      step.position.set(ai * 1.6, y + 0.1, z);
      g.add(step);
    }
  });
  g.position.z = -depth * 0.15;
  return g;
}

export function buildAudience({ floorW, floorD, y = 0 }) {
  const group = new THREE.Group();
  const margin = 5;
  const zOff = floorD / 2 - margin;
  const xOff = floorW / 2 - margin;

  const tribFront = buildTribune({ rows: 8, seatsPerRow: 14, rise: 0.7, depth: 2.0, aisles: [-4, 0, 4] });
  tribFront.position.set(0, y, -zOff);
  group.add(tribFront);

  const tribBack = buildTribune({ rows: 8, seatsPerRow: 14, rise: 0.7, depth: 2.0, aisles: [-4, 0, 4] });
  tribBack.rotation.y = Math.PI;
  tribBack.position.set(0, y, zOff);
  group.add(tribBack);

  const tribL = buildTribune({ rows: 6, seatsPerRow: 10, rise: 0.7, depth: 1.9, aisles: [-3, 3] });
  tribL.rotation.y = Math.PI / 2;
  tribL.position.set(-xOff, y, 0);
  group.add(tribL);

  const tribR = buildTribune({ rows: 6, seatsPerRow: 10, rise: 0.7, depth: 1.9, aisles: [-3, 3] });
  tribR.rotation.y = -Math.PI / 2;
  tribR.position.set(xOff, y, 0);
  group.add(tribR);

  return group;
}
