import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(__dirname, '..');
const outputPath = path.join(
  webappRoot,
  'public/models/pool-royale/pool-table-traditional-fizyman.glb'
);

// GLTFExporter uses FileReader in binary mode. Node has Blob but not FileReader,
// so this small shim lets the same exporter produce a GLB during install/build.
globalThis.FileReader = class FileReader {
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

const SOURCE_METADATA = Object.freeze({
  source: 'Sketchfab Pool Table Traditional by fizyman',
  sourceUrl:
    'https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977',
  license: 'CC Attribution 4.0',
  author: 'fizyman',
  note: 'Pool Royale generated GLB table profile matched to the referenced traditional table proportions.'
});

function createMaterialCatalog() {
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
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
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
  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    segments,
    1
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function addRailSights(root, materials, dimensions) {
  const { length, width, topY, railWidth } = dimensions;
  for (const z of [
    -length * 0.36,
    -length * 0.18,
    0,
    length * 0.18,
    length * 0.36
  ]) {
    addCylinder(
      root,
      `brass_diamond_rail_sight_left_${z.toFixed(2)}`,
      0.018,
      0.018,
      0.006,
      [-width / 2 + railWidth * 0.5, topY + 0.085, z],
      materials.trim,
      18
    );
    addCylinder(
      root,
      `brass_diamond_rail_sight_right_${z.toFixed(2)}`,
      0.018,
      0.018,
      0.006,
      [width / 2 - railWidth * 0.5, topY + 0.085, z],
      materials.trim,
      18
    );
  }

  for (const x of [-width * 0.24, 0, width * 0.24]) {
    addCylinder(
      root,
      `brass_diamond_rail_sight_head_${x.toFixed(2)}`,
      0.018,
      0.018,
      0.006,
      [x, topY + 0.085, -length / 2 + railWidth * 0.5],
      materials.trim,
      18
    );
    addCylinder(
      root,
      `brass_diamond_rail_sight_foot_${x.toFixed(2)}`,
      0.018,
      0.018,
      0.006,
      [x, topY + 0.085, length / 2 - railWidth * 0.5],
      materials.trim,
      18
    );
  }
}

function buildTraditionalPoolTableScene() {
  const root = new THREE.Group();
  root.name = 'Pool_Table_Traditional_Fizyman_CC_BY_reference';
  root.userData = { ...SOURCE_METADATA };

  const materials = createMaterialCatalog();

  // Dimensions match Sketchfab metadata ratio (2.528 x 1.427 x 0.831).
  // Pool Royale refits the generated GLB to the selected playable table size.
  const length = 2.528;
  const width = 1.427;
  const height = 0.831;
  const topY = height;
  const railHeight = 0.105;
  const railWidth = 0.18;
  const clothLength = length - railWidth * 2.25;
  const clothWidth = width - railWidth * 2.25;
  const dimensions = { length, width, topY, railWidth };

  addBox(
    root,
    'playing_surface_green_felt_cloth',
    [clothWidth, 0.026, clothLength],
    [0, topY - 0.02, 0],
    materials.cloth
  );
  addBox(
    root,
    'left_rail_rubber_cushion',
    [railWidth * 0.45, railHeight, clothLength],
    [-(clothWidth / 2 + railWidth * 0.28), topY, 0],
    materials.cushion
  );
  addBox(
    root,
    'right_rail_rubber_cushion',
    [railWidth * 0.45, railHeight, clothLength],
    [clothWidth / 2 + railWidth * 0.28, topY, 0],
    materials.cushion
  );
  addBox(
    root,
    'top_rail_rubber_cushion',
    [clothWidth, railHeight, railWidth * 0.45],
    [0, topY, -(clothLength / 2 + railWidth * 0.28)],
    materials.cushion
  );
  addBox(
    root,
    'bottom_rail_rubber_cushion',
    [clothWidth, railHeight, railWidth * 0.45],
    [0, topY, clothLength / 2 + railWidth * 0.28],
    materials.cushion
  );

  addBox(
    root,
    'left_top_wood_rail_walnut',
    [railWidth, railHeight * 1.38, length],
    [-width / 2 + railWidth / 2, topY + 0.005, 0],
    materials.wood
  );
  addBox(
    root,
    'right_top_wood_rail_walnut',
    [railWidth, railHeight * 1.38, length],
    [width / 2 - railWidth / 2, topY + 0.005, 0],
    materials.wood
  );
  addBox(
    root,
    'head_top_wood_rail_walnut',
    [width, railHeight * 1.38, railWidth],
    [0, topY + 0.005, -length / 2 + railWidth / 2],
    materials.wood
  );
  addBox(
    root,
    'foot_top_wood_rail_walnut',
    [width, railHeight * 1.38, railWidth],
    [0, topY + 0.005, length / 2 - railWidth / 2],
    materials.wood
  );

  addBox(
    root,
    'side_wood_apron_left',
    [0.115, 0.25, length * 0.93],
    [-width / 2 + 0.055, topY - 0.2, 0],
    materials.wood
  );
  addBox(
    root,
    'side_wood_apron_right',
    [0.115, 0.25, length * 0.93],
    [width / 2 - 0.055, topY - 0.2, 0],
    materials.wood
  );
  addBox(
    root,
    'end_wood_apron_head',
    [width * 0.93, 0.25, 0.115],
    [0, topY - 0.2, -length / 2 + 0.055],
    materials.wood
  );
  addBox(
    root,
    'end_wood_apron_foot',
    [width * 0.93, 0.25, 0.115],
    [0, topY - 0.2, length / 2 - 0.055],
    materials.wood
  );
  addBox(
    root,
    'underside_lower_cabinet_base',
    [width * 0.58, 0.12, length * 0.54],
    [0, topY - 0.38, 0],
    materials.underside
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
      materials.wood,
      20
    );
    addCylinder(
      root,
      `round_base_foot_${index + 1}`,
      0.12,
      0.14,
      0.055,
      [x, y - 0.335, z],
      materials.underside,
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
    const cup = addCylinder(
      root,
      `black_leather_pocket_cup_${index + 1}`,
      0.095,
      0.075,
      0.065,
      [x, y, z],
      materials.pocket,
      32
    );
    cup.scale.z = index < 4 ? 0.72 : 0.9;

    const net = addCylinder(
      root,
      `mesh_pocket_net_${index + 1}`,
      0.073,
      0.048,
      0.13,
      [x, y - 0.09, z],
      materials.net,
      20
    );
    net.scale.z = cup.scale.z;
  });

  addRailSights(root, materials, dimensions);

  root.traverse((child) => {
    if (child.name.includes('rail_sight')) child.rotation.x = Math.PI / 2;
  });

  return root;
}

async function exportGlb(scene) {
  const exporter = new GLTFExporter();
  return await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, { binary: true, trs: false });
  });
}

async function main() {
  const scene = buildTraditionalPoolTableScene();
  const glb = await exportGlb(scene);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(glb));
  console.log(
    `[pool-royale-table] Generated ${path.relative(webappRoot, outputPath)} (${Buffer.byteLength(Buffer.from(glb)).toLocaleString()} bytes)`
  );
}

await main();
