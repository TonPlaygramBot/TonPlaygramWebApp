import * as THREE from 'three';
import { ARENAS } from './options';

/** A metre-scale indoor competition hall; shared meshes keep mobile draw calls bounded. */
export function buildArena() {
  const root = new THREE.Group();
  root.name = 'Royal table tennis arena';
  const materials = {
    floor: new THREE.MeshStandardMaterial({
      color: '#263d50',
      roughness: 0.96
    }),
    wall: new THREE.MeshStandardMaterial({ color: '#152739', roughness: 0.88 }),
    structure: new THREE.MeshStandardMaterial({
      color: '#394b5f',
      roughness: 0.72
    }),
    dark: new THREE.MeshStandardMaterial({ color: '#091722', roughness: 0.8 }),
    accent: new THREE.MeshStandardMaterial({
      color: '#37d5bc',
      roughness: 0.5
    }),
    light: new THREE.MeshBasicMaterial({ color: '#eaf6ff' })
  };
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.renderOrder = -10;
    root.add(mesh);
    return mesh;
  };
  box(16, 0.12, 22, 0, -0.065, 0, materials.floor);
  box(6.6, 0.008, 10, 0, 0, 0, materials.dark);
  // Competition barriers enclose both ends; sight lines stay clear at 1.62 m.
  for (const x of [-3.4, 3.4]) {
    box(0.08, 0.72, 10, x, 0.36, 0, materials.wall);
    box(0.09, 0.025, 10, x, 0.73, 0, materials.accent);
  }
  for (const z of [-5, 5]) {
    box(6.8, 0.72, 0.08, 0, 0.36, z, materials.wall);
    box(6.8, 0.025, 0.09, 0, 0.73, z, materials.accent);
    box(16, 7, 0.2, 0, 3.5, z * 2.1, materials.wall);
    box(5.8, 1.5, 0.08, 0, 3.7, z * 2.08, materials.dark);
    for (let tier = 0; tier < 4; tier++) {
      box(
        12,
        0.26,
        0.78,
        0,
        0.13 + tier * 0.28,
        Math.sign(z) * (6.3 + tier * 0.82),
        materials.structure
      );
    }
  }
  for (const x of [-7.9, 7.9]) box(0.2, 7, 22, x, 3.5, 0, materials.wall);
  // Instanced seating: two draw calls for 176 seats, without spectator animation cost.
  const seats = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.43, 0.09, 0.43),
    materials.accent,
    176
  );
  const backs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.43, 0.34, 0.075),
    materials.accent,
    176
  );
  const transform = new THREE.Object3D();
  let index = 0;
  for (const end of [-1, 1])
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 22; column++) {
        const x = (column - 10.5) * 0.53,
          z = end * (6.3 + row * 0.82);
        transform.position.set(x, 0.43 + row * 0.28, z);
        transform.updateMatrix();
        seats.setMatrixAt(index, transform.matrix);
        transform.position.set(x, 0.59 + row * 0.28, z + end * 0.2);
        transform.updateMatrix();
        backs.setMatrixAt(index++, transform.matrix);
      }
  seats.renderOrder = backs.renderOrder = -10;
  root.add(seats, backs);
  for (const z of [-6, 0, 6]) {
    box(15, 0.18, 0.18, 0, 5.8, z, materials.structure);
    for (const x of [-2, 2]) box(0.9, 0.055, 1.9, x, 5.68, z, materials.light);
  }
  // A real arena sign, readable on either court end.
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const sign = new THREE.CanvasTexture(canvas);
  sign.colorSpace = THREE.SRGBColorSpace;
  for (const end of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(5.3, 1.3),
      new THREE.MeshBasicMaterial({ map: sign })
    );
    panel.renderOrder = -10;
    panel.position.set(0, 3.7, end * 10.34);
    panel.rotation.y = end > 0 ? Math.PI : 0;
    root.add(panel);
  }
  const setTheme = (id: string) => {
    const arena = ARENAS.find((a) => a.id === id) || ARENAS[0];
    materials.accent.color.set(arena.color);
    if (ctx) {
      ctx.fillStyle = '#091722';
      ctx.fillRect(0, 0, 1024, 256);
      ctx.textAlign = 'center';
      ctx.fillStyle = arena.color;
      ctx.font = 'bold 66px Arial';
      ctx.fillText('TABLE TENNIS ROYAL', 512, 110);
      ctx.fillStyle = '#eaf6ff';
      ctx.font = '30px Arial';
      ctx.fillText(arena.name.toUpperCase(), 512, 174);
      sign.needsUpdate = true;
    }
  };
  setTheme(ARENAS[0].id);
  return { root, setTheme };
}
