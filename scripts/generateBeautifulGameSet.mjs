import fs from 'fs';
import path from 'path';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFExporter } from '../webapp/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { Blob } from 'buffer';

class SimpleOffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._ctx = {
      canvas: this,
      drawImage() {},
      putImageData() {},
      translate() {},
      scale() {},
      getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) })
    };
  }

  getContext() {
    return this._ctx;
  }

  convertToBlob() {
    return Promise.resolve(new Blob());
  }

  toBlob(cb) {
    cb(new Blob());
  }

  toDataURL() {
    return 'data:image/png;base64,';
  }
}

globalThis.OffscreenCanvas = globalThis.OffscreenCanvas || SimpleOffscreenCanvas;
globalThis.ImageData =
  globalThis.ImageData ||
  class ImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (type) => {
      if (type === 'canvas') {
        return new globalThis.OffscreenCanvas(1, 1);
      }
      return {};
    }
  };
}

globalThis.Blob = globalThis.Blob || Blob;
globalThis.FileReader =
  globalThis.FileReader ||
  class FileReader {
    constructor() {
      this.onload = null;
      this.onloadend = null;
      this.result = null;
    }

    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((arrayBuffer) => {
        this.result = arrayBuffer;
        if (typeof this.onload === 'function') {
          this.onload({ target: this });
        }
        if (typeof this.onloadend === 'function') {
          this.onloadend({ target: this });
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
          if (typeof this.onloadend === 'function') {
            this.onloadend({ target: this });
          }
        });
    }
  };

const scene = new THREE.Scene();
scene.name = 'ABeautifulGameRoot';
scene.userData = { source: 'ABeautifulGameLocal' };

function makeNoiseTexture(colorHex, seed = 1) {
  const size = 512;
  const base = new THREE.Color(colorHex);
  const data = new Uint8Array(size * size * 4);

  let s = seed;
  const rand = () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return ((s < 0 ? ~s + 1 : s) % 1000) / 1000;
  };

  for (let i = 0; i < size * size; i += 1) {
    const stride = i * 4;
    const noise = 0.06 + rand() * 0.18;
    const jitter = (rand() * 0.18 - 0.09) * 255;
    data[stride] = clampChannel(base.r * 255 + jitter);
    data[stride + 1] = clampChannel(base.g * 255 + jitter);
    data[stride + 2] = clampChannel(base.b * 255 + jitter);
    data[stride + 3] = clampChannel(220 + noise * 35);
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 2.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

const PIECE_HEIGHT = {
  Pawn: 1.1,
  Rook: 1.2,
  Knight: 1.25,
  Bishop: 1.35,
  Queen: 1.5,
  King: 1.6
};

const createLathe = (profile, segments = 24) => new THREE.LatheGeometry(profile, segments);

const glassMaterial = (tint, transmission = 0.94) =>
  new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness: 0.06,
    metalness: 0.06,
    transparent: true,
    opacity: 1,
    transmission,
    thickness: 0.65,
    attenuationColor: tint,
    attenuationDistance: 0.42,
    ior: 1.5,
    clearcoat: 0.8,
    clearcoatRoughness: 0.08,
    reflectivity: 0.8
  });

const accentMaterial = (color, metalness = 0.52, roughness = 0.18) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: 0.42,
    clearcoatRoughness: 0.1,
    sheen: 0.26,
    sheenColor: new THREE.Color('#fdf6e3'),
    specularIntensity: 0.78
  });

function buildBase(color, radius = 0.4, height = 0.2) {
  const mat = glassMaterial(color, 0.9);
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
  const mat = accentMaterial(accentColor ?? color, 0.28, 0.24);
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
  const mat = glassMaterial(color, 0.94);
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
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 12, 32), accentMaterial(accentColor ?? color));
  inner.rotation.x = Math.PI / 2;
  group.add(inner);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), accentMaterial(accentColor ?? color, 0.45, 0.16));
  orb.position.y = 0.15;
  group.add(orb);
  return group;
}

function makeCross(color) {
  const mat = accentMaterial(color, 0.48, 0.22);
  const group = new THREE.Group();
  const vert = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), mat);
  vert.position.y = 0.17;
  const hor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), mat);
  hor.position.y = 0.28;
  group.add(vert, hor);
  return group;
}

function buildKnightHead(color) {
  const mat = glassMaterial(color, 0.88);
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
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), glassMaterial(color, 0.9));
    head.position.y = cursorY + 0.6;
    g.add(head);
  } else if (type === 'Rook') {
    const body = buildBody(color, 0.28, 0.7);
    body.position.y = cursorY;
    g.add(body);
    cursorY += 0.7;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.2, 32, 1, false, 0, Math.PI * 2), accentMaterial(accentColor ?? color, 0.52, 0.24));
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
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), glassMaterial(color, 0.92));
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

  const graniteLight = makeNoiseTexture('#d9d7d1', 17);
  const graniteDark = makeNoiseTexture('#6c6963', 29);
  const graniteEdge = makeNoiseTexture('#2b2a32', 47);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(size * tile + 0.6, 0.28, size * tile + 0.6),
    new THREE.MeshPhysicalMaterial({
      color: '#111118',
      roughness: 0.42,
      metalness: 0.16,
      clearcoat: 0.34,
      clearcoatRoughness: 0.2,
      map: graniteEdge,
      normalMap: graniteEdge,
      normalScale: new THREE.Vector2(0.45, 0.45)
    })
  );
  frame.name = 'BoardFrame';
  frame.position.y = 0.1;
  boardGroup.add(frame);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(size * tile + 0.4, 0.08, size * tile + 0.4),
    new THREE.MeshPhysicalMaterial({
      color: '#1c1c23',
      roughness: 0.32,
      metalness: 0.12,
      clearcoat: 0.28,
      clearcoatRoughness: 0.16,
      map: graniteEdge,
      normalMap: graniteEdge,
      normalScale: new THREE.Vector2(0.42, 0.42)
    })
  );
  top.name = 'BoardTop';
  top.position.y = 0.2;
  boardGroup.add(top);

  const light = '#f2efe8';
  const dark = '#5b5a5e';
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const isDark = (r + c) % 2 === 1;
      const mat = new THREE.MeshPhysicalMaterial({
        color: isDark ? dark : light,
        roughness: 0.34,
        metalness: 0.18,
        clearcoat: 0.24,
        clearcoatRoughness: 0.12,
        sheen: 0.18,
        sheenColor: new THREE.Color('#ffffff'),
        specularIntensity: 0.56,
        map: isDark ? graniteDark : graniteLight,
        normalMap: isDark ? graniteDark : graniteLight,
        normalScale: new THREE.Vector2(0.35, 0.35)
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

try {
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true });
  const buffer = Buffer.from(Array.isArray(arrayBuffer) ? arrayBuffer[0] : arrayBuffer);
  const outputPath = path.join(process.cwd(), 'webapp/public/assets/chess/ABeautifulGame.glb');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  // eslint-disable-next-line no-console
  console.log('Saved', outputPath, 'bytes', buffer.length);
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Failed to export ABeautifulGame GLB', error);
  process.exitCode = 1;
}
