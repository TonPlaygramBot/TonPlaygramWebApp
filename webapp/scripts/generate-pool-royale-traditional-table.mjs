import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../node_modules/three/build/three.module.js';
import { GLTFExporter } from '../node_modules/three/examples/jsm/exporters/GLTFExporter.js';

const WEBAPP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_PATH =
  'public/models/pool-royale/pool-table-traditional-fizyman.glb';
const SOURCE_URL =
  'https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977';

// GLTFExporter uses FileReader in browser builds. This small Node-compatible
// shim keeps generation deterministic without adding another build dependency.
globalThis.FileReader = class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((arrayBuffer) => {
        this.result = arrayBuffer;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
};

function createMaterials() {
  return {
    cloth: new THREE.MeshStandardMaterial({
      name: 'green_felt_cloth',
      color: 0x11643b,
      roughness: 0.92,
      metalness: 0
    }),
    cushion: new THREE.MeshStandardMaterial({
      name: 'rail_rubber_cushion',
      color: 0x0b4f31,
      roughness: 0.88,
      metalness: 0
    }),
    wood: new THREE.MeshStandardMaterial({
      name: 'dark_walnut_wood',
      color: 0x4b2413,
      roughness: 0.52,
      metalness: 0.02
    }),
    trim: new THREE.MeshStandardMaterial({
      name: 'brass_chrome_trim',
      color: 0xd2aa52,
      roughness: 0.24,
      metalness: 0.88
    }),
    pocket: new THREE.MeshStandardMaterial({
      name: 'black_leather_pocket',
      color: 0x020202,
      roughness: 0.74,
      metalness: 0.05
    }),
    net: new THREE.MeshStandardMaterial({
      name: 'mesh_pocket_net',
      color: 0x080706,
      roughness: 0.86,
      metalness: 0,
      transparent: true,
      opacity: 0.72
    }),
    underside: new THREE.MeshStandardMaterial({
      name: 'lower_cabinet_base',
      color: 0x2b130b,
      roughness: 0.64,
      metalness: 0.02
    })
  };
}

function addBox(root, name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function addCylinder(
  root,
  name,
  radiusTop,
  radiusBottom,
  height,
  position,
  material,
  segments = 32
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1),
    material
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

export function createTraditionalPoolTableScene() {
  const root = new THREE.Group();
  root.name = 'Pool_Table_Traditional_Fizyman_CC_BY_reference';
  root.userData = {
    source: 'Sketchfab Pool Table Traditional by fizyman',
    sourceUrl: SOURCE_URL,
    license: 'CC Attribution 4.0',
    author: 'fizyman',
    note: 'Pool Royale optimized GLB table profile matched to the referenced traditional table proportions.'
  };

  const mat = createMaterials();

  // Dimensions match the Sketchfab model metadata ratio (2.528 x 1.427 x
  // 0.831). Pool Royale then refits the generated table to the active physics
  // table so gameplay keeps the same size and height as the existing tables.
  const length = 2.528;
  const width = 1.427;
  const height = 0.831;
  const topY = height;
  const railHeight = 0.105;
  const railWidth = 0.18;
  const clothLength = length - railWidth * 2.25;
  const clothWidth = width - railWidth * 2.25;

  addBox(
    root,
    'playing_surface_green_felt_cloth',
    [clothWidth, 0.026, clothLength],
    [0, topY - 0.02, 0],
    mat.cloth
  );
  addBox(
    root,
    'left_rail_rubber_cushion',
    [railWidth * 0.45, railHeight, clothLength],
    [-(clothWidth / 2 + railWidth * 0.28), topY, 0],
    mat.cushion
  );
  addBox(
    root,
    'right_rail_rubber_cushion',
    [railWidth * 0.45, railHeight, clothLength],
    [clothWidth / 2 + railWidth * 0.28, topY, 0],
    mat.cushion
  );
  addBox(
    root,
    'top_rail_rubber_cushion',
    [clothWidth, railHeight, railWidth * 0.45],
    [0, topY, -(clothLength / 2 + railWidth * 0.28)],
    mat.cushion
  );
  addBox(
    root,
    'bottom_rail_rubber_cushion',
    [clothWidth, railHeight, railWidth * 0.45],
    [0, topY, clothLength / 2 + railWidth * 0.28],
    mat.cushion
  );

  addBox(
    root,
    'left_top_wood_rail_walnut',
    [railWidth, railHeight * 1.38, length],
    [-width / 2 + railWidth / 2, topY + 0.005, 0],
    mat.wood
  );
  addBox(
    root,
    'right_top_wood_rail_walnut',
    [railWidth, railHeight * 1.38, length],
    [width / 2 - railWidth / 2, topY + 0.005, 0],
    mat.wood
  );
  addBox(
    root,
    'head_top_wood_rail_walnut',
    [width, railHeight * 1.38, railWidth],
    [0, topY + 0.005, -length / 2 + railWidth / 2],
    mat.wood
  );
  addBox(
    root,
    'foot_top_wood_rail_walnut',
    [width, railHeight * 1.38, railWidth],
    [0, topY + 0.005, length / 2 - railWidth / 2],
    mat.wood
  );

  addBox(
    root,
    'side_wood_apron_left',
    [0.115, 0.25, length * 0.93],
    [-width / 2 + 0.055, topY - 0.2, 0],
    mat.wood
  );
  addBox(
    root,
    'side_wood_apron_right',
    [0.115, 0.25, length * 0.93],
    [width / 2 - 0.055, topY - 0.2, 0],
    mat.wood
  );
  addBox(
    root,
    'end_wood_apron_head',
    [width * 0.93, 0.25, 0.115],
    [0, topY - 0.2, -length / 2 + 0.055],
    mat.wood
  );
  addBox(
    root,
    'end_wood_apron_foot',
    [width * 0.93, 0.25, 0.115],
    [0, topY - 0.2, length / 2 - 0.055],
    mat.wood
  );
  addBox(
    root,
    'underside_lower_cabinet_base',
    [width * 0.58, 0.12, length * 0.54],
    [0, topY - 0.38, 0],
    mat.underside
  );

  [
    [-width * 0.36, topY - 0.54, -length * 0.36],
    [width * 0.36, topY - 0.54, -length * 0.36],
    [-width * 0.36, topY - 0.54, length * 0.36],
    [width * 0.36, topY - 0.54, length * 0.36]
  ].forEach(([x, y, z], index) => {
    addCylinder(
      root,
      `turned_wood_leg_support_${index + 1}`,
      0.07,
      0.095,
      0.62,
      [x, y, z],
      mat.wood,
      20
    );
    addCylinder(
      root,
      `round_base_foot_${index + 1}`,
      0.12,
      0.14,
      0.055,
      [x, y - 0.335, z],
      mat.underside,
      24
    );
  });

  [
    [-clothWidth / 2, topY + 0.025, -clothLength / 2],
    [clothWidth / 2, topY + 0.025, -clothLength / 2],
    [-clothWidth / 2, topY + 0.025, clothLength / 2],
    [clothWidth / 2, topY + 0.025, clothLength / 2],
    [-clothWidth / 2 - railWidth * 0.12, topY + 0.025, 0],
    [clothWidth / 2 + railWidth * 0.12, topY + 0.025, 0]
  ].forEach(([x, y, z], index) => {
    const pocket = addCylinder(
      root,
      `black_leather_pocket_cup_${index + 1}`,
      0.095,
      0.075,
      0.065,
      [x, y, z],
      mat.pocket,
      32
    );
    pocket.scale.z = index < 4 ? 0.72 : 0.9;

    const net = addCylinder(
      root,
      `mesh_pocket_net_${index + 1}`,
      0.073,
      0.048,
      0.13,
      [x, y - 0.09, z],
      mat.net,
      20
    );
    net.scale.z = pocket.scale.z;
  });

  [-length * 0.36, -length * 0.18, 0, length * 0.18, length * 0.36].forEach(
    (z) => {
      addCylinder(
        root,
        `brass_diamond_rail_sight_left_${z.toFixed(2)}`,
        0.018,
        0.018,
        0.006,
        [-width / 2 + railWidth * 0.5, topY + 0.085, z],
        mat.trim,
        18
      );
      addCylinder(
        root,
        `brass_diamond_rail_sight_right_${z.toFixed(2)}`,
        0.018,
        0.018,
        0.006,
        [width / 2 - railWidth * 0.5, topY + 0.085, z],
        mat.trim,
        18
      );
    }
  );

  [-width * 0.24, 0, width * 0.24].forEach((x) => {
    addCylinder(
      root,
      `brass_diamond_rail_sight_head_${x.toFixed(2)}`,
      0.018,
      0.018,
      0.006,
      [x, topY + 0.085, -length / 2 + railWidth * 0.5],
      mat.trim,
      18
    );
    addCylinder(
      root,
      `brass_diamond_rail_sight_foot_${x.toFixed(2)}`,
      0.018,
      0.018,
      0.006,
      [x, topY + 0.085, length / 2 - railWidth * 0.5],
      mat.trim,
      18
    );
  });

  root.traverse((child) => {
    if (child.name.includes('rail_sight')) child.rotation.x = Math.PI / 2;
  });

  return root;
}

export async function exportTraditionalPoolTableGlb() {
  const exporter = new GLTFExporter();
  const scene = createTraditionalPoolTableScene();
  return await new Promise((resolveExport, rejectExport) => {
    exporter.parse(scene, resolveExport, rejectExport, {
      binary: true,
      trs: false
    });
  });
}

export async function writeTraditionalPoolTableGlb(
  outputPath = DEFAULT_OUTPUT_PATH
) {
  const target = resolve(WEBAPP_ROOT, outputPath);
  const glb = await exportTraditionalPoolTableGlb();
  const buffer = Buffer.from(glb);
  const tmp = `${target}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(tmp, buffer);
  await rename(tmp, target);
  return { target, bytes: buffer.length };
}

function parseOutputArg(argv) {
  const outputIndex = argv.findIndex(
    (arg) => arg === '--output' || arg === '-o'
  );
  return outputIndex >= 0 && argv[outputIndex + 1]
    ? argv[outputIndex + 1]
    : DEFAULT_OUTPUT_PATH;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { target, bytes } = await writeTraditionalPoolTableGlb(
    parseOutputArg(process.argv.slice(2))
  );
  console.log(
    `Generated Pool Royale Traditional table GLB at ${target} (${bytes.toLocaleString()} bytes).`
  );
}
