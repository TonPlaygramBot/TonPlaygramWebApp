import fs from 'fs';
import path from 'path';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFExporter } from '../webapp/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { Blob } from 'buffer';

globalThis.Blob = globalThis.Blob || Blob;
globalThis.FileReader =
  globalThis.FileReader ||
  class FileReader {
    constructor() {
      this.onload = null;
      this.result = null;
    }

    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((arrayBuffer) => {
        this.result = arrayBuffer;
        if (typeof this.onload === 'function') {
          this.onload({ target: this });
        }
      });
    }

    readAsDataURL(blob) {
      blob
        .arrayBuffer()
        .then((arrayBuffer) => Buffer.from(arrayBuffer).toString('base64'))
        .then((base64) => {
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
          if (typeof this.onload === 'function') {
            this.onload({ target: this });
          }
        });
    }
  };

const scene = new THREE.Scene();
scene.name = 'ABeautifulGameRoot';

const PIECE_HEIGHT = {
  Pawn: 1.1,
  Rook: 1.2,
  Knight: 1.25,
  Bishop: 1.35,
  Queen: 1.5,
  King: 1.6
};

const createLathe = (profile, segments = 24) => new THREE.LatheGeometry(profile, segments);

const smoothMaterial = (color, metalness = 0.2, roughness = 0.35) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ffffff'),
    specularIntensity: 0.65
  });

function buildBase(color, radius = 0.4, height = 0.2) {
  const mat = smoothMaterial(color, 0.22, 0.28);
  const geo = createLathe([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius * 1.05, height * 0.4),
    new THREE.Vector2(radius * 0.9, height),
    new THREE.Vector2(radius * 0.15, height * 1.02),
    new THREE.Vector2(0, height * 1.05)
  ]);
  return new THREE.Mesh(geo, mat);
}

function buildCollar(color, radius, height, accentColor) {
  const mat = smoothMaterial(accentColor ?? color, 0.24, 0.24);
  const geo = createLathe([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(radius * 1.1, 0),
    new THREE.Vector2(radius * 1.2, height * 0.4),
    new THREE.Vector2(radius * 0.65, height * 0.7),
    new THREE.Vector2(radius * 0.4, height)
  ]);
  return new THREE.Mesh(geo, mat);
}

function buildBody(color, radius = 0.3, height = 0.7) {
  const mat = smoothMaterial(color, 0.18, 0.25);
  const geo = createLathe([
    new THREE.Vector2(radius * 0.55, 0),
    new THREE.Vector2(radius, height * 0.12),
    new THREE.Vector2(radius * 0.68, height * 0.5),
    new THREE.Vector2(radius * 0.9, height * 0.78),
    new THREE.Vector2(radius * 0.5, height)
  ]);
  return new THREE.Mesh(geo, mat);
}

function makeCrown(color, accentColor) {
  const group = new THREE.Group();
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.05, 12, 32),
    smoothMaterial(accentColor ?? color, 0.28, 0.22)
  );
  inner.rotation.x = Math.PI / 2;
  group.add(inner);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), smoothMaterial(accentColor ?? color, 0.3, 0.2));
  orb.position.y = 0.15;
  group.add(orb);
  return group;
}

function makeCross(color) {
  const mat = smoothMaterial(color, 0.26, 0.24);
  const group = new THREE.Group();
  const vert = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), mat);
  vert.position.y = 0.17;
  const hor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), mat);
  hor.position.y = 0.28;
  group.add(vert, hor);
  return group;
}

function buildKnightHead(color) {
  const mat = smoothMaterial(color, 0.24, 0.3);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.05, 0.1, -0.02, 0.22);
  shape.quadraticCurveTo(-0.08, 0.35, 0.05, 0.48);
  shape.quadraticCurveTo(0.25, 0.72, 0.12, 0.9);
  shape.quadraticCurveTo(0.02, 1.05, -0.06, 0.88);
  shape.quadraticCurveTo(-0.18, 0.65, -0.12, 0.35);
  shape.quadraticCurveTo(-0.2, 0.1, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 4 });
  geo.translate(-0.12, 0, -0.1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}

function createPiece(type, colorName, color, accentColor) {
  const g = new THREE.Group();
  g.name = `${colorName}_${type}`;
  const base = buildBase(color, 0.38, 0.18);
  g.add(base);
  let cursorY = 0.18;
  if (type === 'Pawn') {
    const body = buildBody(color, 0.25, 0.55);
    body.position.y = cursorY;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), smoothMaterial(color, 0.28, 0.25));
    head.position.y = cursorY + 0.6;
    g.add(head);
  } else if (type === 'Rook') {
    const body = buildBody(color, 0.28, 0.7);
    body.position.y = cursorY;
    g.add(body);
    cursorY += 0.7;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.2, 32, 1, false, 0, Math.PI * 2), smoothMaterial(accentColor ?? color, 0.28, 0.28));
    crown.position.y = cursorY + 0.12;
    g.add(crown);
  } else if (type === 'Knight') {
    const body = buildBody(color, 0.27, 0.65);
    body.position.y = cursorY;
    g.add(body);
    cursorY += 0.65;
    const head = buildKnightHead(color);
    head.position.y = cursorY - 0.1;
    g.add(head);
  } else if (type === 'Bishop') {
    const body = buildBody(color, 0.27, 0.75);
    body.position.y = cursorY;
    g.add(body);
    cursorY += 0.78;
    const collar = buildCollar(color, 0.24, 0.16, accentColor);
    collar.position.y = cursorY;
    g.add(collar);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), smoothMaterial(color, 0.26, 0.24));
    top.position.y = cursorY + 0.22;
    g.add(top);
  } else if (type === 'Queen') {
    const body = buildBody(color, 0.3, 0.82);
    body.position.y = cursorY;
    g.add(body);
    cursorY += 0.85;
    const collar = buildCollar(color, 0.26, 0.18, accentColor);
    collar.position.y = cursorY;
    g.add(collar);
    const crown = makeCrown(color, accentColor);
    crown.position.y = cursorY + 0.28;
    g.add(crown);
  } else if (type === 'King') {
    const body = buildBody(color, 0.32, 0.88);
    body.position.y = cursorY;
    g.add(body);
    cursorY += 0.92;
    const collar = buildCollar(color, 0.28, 0.18, accentColor);
    collar.position.y = cursorY;
    g.add(collar);
    const crown = makeCrown(color, accentColor);
    crown.position.y = cursorY + 0.26;
    g.add(crown);
    const cross = makeCross(accentColor ?? color);
    cross.position.y = cursorY + 0.45;
    g.add(cross);
  }
  g.position.y = 0;
  return g;
}

function makeBoard() {
  const boardGroup = new THREE.Group();
  boardGroup.name = 'BoardModel';
  const size = 8;
  const tile = 0.9;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(size * tile + 0.6, 0.28, size * tile + 0.6),
    new THREE.MeshPhysicalMaterial({ color: '#1c1b22', roughness: 0.32, metalness: 0.08, clearcoat: 0.3 })
  );
  frame.position.y = 0.1;
  boardGroup.add(frame);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(size * tile + 0.4, 0.08, size * tile + 0.4),
    new THREE.MeshPhysicalMaterial({ color: '#2f2e3b', roughness: 0.28, metalness: 0.12 })
  );
  top.position.y = 0.2;
  boardGroup.add(top);
  const light = '#e8e1d2';
  const dark = '#6b5640';
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const isDark = (r + c) % 2 === 1;
      const mat = new THREE.MeshPhysicalMaterial({
        color: isDark ? dark : light,
        roughness: 0.42,
        metalness: 0.08,
        clearcoat: 0.08,
        specularIntensity: 0.28
      });
      const tileMesh = new THREE.Mesh(new THREE.BoxGeometry(tile, 0.04, tile), mat);
      tileMesh.position.set(c * tile - (size * tile) / 2 + tile / 2, 0.24, r * tile - (size * tile) / 2 + tile / 2);
      tileMesh.name = `Tile_${r}_${c}`;
      boardGroup.add(tileMesh);
    }
  }
  return boardGroup;
}

const board = makeBoard();
scene.add(board);

const whiteColor = '#f6f7fb';
const blackColor = '#171b28';
const accent = '#cba763';

const positions = {
  Pawn: [
    [-3.5, -0.1],
    [-2.5, -0.1],
    [-1.5, -0.1],
    [-0.5, -0.1],
    [0.5, -0.1],
    [1.5, -0.1],
    [2.5, -0.1],
    [3.5, -0.1]
  ],
  Rook: [
    [-3.5, 0.7],
    [3.5, 0.7]
  ],
  Knight: [
    [-2.5, 0.7],
    [2.5, 0.7]
  ],
  Bishop: [
    [-1.5, 0.7],
    [1.5, 0.7]
  ],
  Queen: [[-0.5, 0.7]],
  King: [[0.5, 0.7]]
};

function populate(colorName, colorValue, direction) {
  const accentColor = colorName === 'Black' ? '#d4af37' : '#8b6b3d';
  for (const [type, coords] of Object.entries(positions)) {
    coords.forEach(([x, z]) => {
      const piece = createPiece(type, colorName, colorValue, accentColor);
      piece.position.x = x;
      piece.position.z = z * direction;
      piece.position.y = 0.24;
      piece.scale.setScalar(0.55);
      scene.add(piece);
    });
  }
}

populate('White', whiteColor, 1);
populate('Black', blackColor, -1);

const exporter = new GLTFExporter();
const arrayBuffer = await new Promise((resolve, reject) => {
  exporter.parse(scene, resolve, { binary: true }, reject);
});

const buffer = Buffer.from(Array.isArray(arrayBuffer) ? arrayBuffer[0] : arrayBuffer);
const outputPath = path.join(process.cwd(), 'webapp/public/assets/ABeautifulGame.glb');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buffer);
// eslint-disable-next-line no-console
console.log('Saved', outputPath, 'bytes', buffer.length);
