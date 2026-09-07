import * as THREE from 'three';
import type { Surface } from './engine';

/** Small, deterministic textures: no network requests or large stadium assets. */
export function courtTexture(surface: Surface, surround = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle =
    surface === 'clay'
      ? surround
        ? '#a55636'
        : '#c77b50'
      : surface === 'grass'
        ? surround
          ? '#395e3d'
          : '#4d793c'
        : surround
          ? '#286456'
          : '#387e9b';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 8423;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  if (surface === 'grass') {
    for (let y = 0; y < 512; y += 128) {
      ctx.fillStyle = '#bdd38518';
      ctx.fillRect(0, y, 512, 64);
    }
  }
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = random() > 0.5 ? '#f3e4bd16' : '#15281d19';
    ctx.fillRect(
      random() * 512,
      random() * 512,
      surface === 'clay' ? 2 : 1,
      surface === 'grass' ? 3 : 1
    );
  }
  if (surface === 'clay') {
    ctx.strokeStyle = '#efc19f16';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.ellipse(
        random() * 512,
        random() * 512,
        28 + random() * 30,
        4,
        random() * 3,
        0,
        Math.PI
      );
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(surround ? 3 : 1, surround ? 5 : 2);
  texture.anisotropy = 4;
  return texture;
}

export function buildStadium(parent: THREE.Group, low = false) {
  const stadium = new THREE.Group();
  stadium.name = 'Tennis stadium';
  parent.add(stadium);
  const material = (color: number, roughness = 0.85, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const concrete = material(0x9caba6),
    steel = material(0x50656b, 0.38, 0.6),
    wall = material(0x153f42),
    trim = material(0xe6e8d6),
    dark = material(0x1a2c31);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const box = (
    root: THREE.Group,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number
  ) => {
    const mesh = new THREE.Mesh(unitBox, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  // Drainage and unobstructed run-off surround a regulation-size court.
  box(stadium, 36, 0.18, 50, dark, 0, -0.28, 0);
  for (const x of [-10.7, 10.7]) {
    box(stadium, 0.14, 0.015, 37, steel, x, -0.025, 0);
    box(stadium, 0.2, 1, 36, wall, x * 1.06, 0.5, 0);
  }
  for (const z of [-18.4, 18.4])
    box(stadium, 22.8, 1.15, 0.16, wall, 0, 0.575, z);

  const ends: THREE.Group[] = [];
  const makeStand = (
    width: number,
    x: number,
    z: number,
    rotation: number,
    end = false
  ) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotation;
    stadium.add(root);
    if (end) ends.push(root);
    const rows = low ? 3 : 5;
    const positions: THREE.Vector3[] = [];
    for (let row = 0; row < rows; row++) {
      const y = 0.38 + row * 0.54,
        depth = row * 0.95;
      box(root, width, 0.18, 1.08, concrete, 0, y, depth);
      box(root, width, 0.42, 0.12, concrete, 0, y - 0.23, depth - 0.49);
      for (
        let column = -width / 2 + 0.6;
        column < width / 2 - 0.3;
        column += 0.65
      ) {
        // Two visible aisles through each stand.
        if (
          Math.abs(column - width / 4) < 0.55 ||
          Math.abs(column + width / 4) < 0.55
        )
          continue;
        positions.push(new THREE.Vector3(column, y + 0.35, depth));
      }
    }
    const seats = new THREE.InstancedMesh(
      unitBox,
      material(0x427079),
      positions.length
    );
    const backs = new THREE.InstancedMesh(
      unitBox,
      material(0x487f89),
      positions.length
    );
    const pose = new THREE.Object3D();
    positions.forEach((p, i) => {
      pose.position.copy(p);
      pose.scale.set(0.45, 0.1, 0.42);
      pose.updateMatrix();
      seats.setMatrixAt(i, pose.matrix);
      pose.position.set(p.x, p.y + 0.23, p.z + 0.18);
      pose.scale.set(0.45, 0.45, 0.08);
      pose.updateMatrix();
      backs.setMatrixAt(i, pose.matrix);
      const c = new THREE.Color(i % 11 < 2 ? 0xc4cab9 : 0x38717a);
      seats.setColorAt(i, c);
      backs.setColorAt(i, c);
    });
    root.add(seats, backs);
    if (!low) {
      const people = positions.filter((_, i) => i % 5 !== 0 && i % 7 !== 0);
      const bodies = new THREE.InstancedMesh(
        new THREE.CapsuleGeometry(0.15, 0.25, 2, 5),
        material(0xffffff),
        people.length
      );
      const heads = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.105, 6, 4),
        material(0xffffff),
        people.length
      );
      const shirts = [
        0xdadbd0, 0x629097, 0x4e6b89, 0xac7770, 0xcba566, 0x344e60
      ];
      const skin = [0xcfa17d, 0x926343, 0xb77c55, 0xe3bd98];
      people.forEach((p, i) => {
        pose.scale.set(1, 1, 1);
        pose.position.set(p.x, p.y + 0.27, p.z);
        pose.updateMatrix();
        bodies.setMatrixAt(i, pose.matrix);
        bodies.setColorAt(i, new THREE.Color(shirts[i % shirts.length]));
        pose.position.y += 0.36;
        pose.updateMatrix();
        heads.setMatrixAt(i, pose.matrix);
        heads.setColorAt(i, new THREE.Color(skin[i % skin.length]));
      });
      root.add(bodies, heads);
    }
    const railY = rows * 0.54 + 0.8;
    box(root, width, 0.06, 0.06, steel, 0, railY, rows * 0.95 - 0.4);
    for (let x = -width / 2; x <= width / 2; x += 2.4)
      box(root, 0.055, 1.1, 0.055, steel, x, railY - 0.55, rows * 0.95 - 0.4);
    return root;
  };
  makeStand(34, -12.2, 0, -Math.PI / 2);
  makeStand(34, 12.2, 0, Math.PI / 2);
  makeStand(23.5, 0, -20, Math.PI, true);
  makeStand(23.5, 0, 20, 0, true);

  // End enclosures can be hidden when the player camera sits behind them.
  const enclosures = [new THREE.Group(), new THREE.Group()];
  stadium.add(...enclosures);
  // Courtside windscreen branding and a slim chain-link enclosure.
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#153f42';
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#e4ead6';
    ctx.textAlign = 'center';
    ctx.font = '500 44px Arial';
    ctx.fillText('T E N N I S   R O Y A L', 512, 80);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const bannerMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      side: THREE.DoubleSide
    });
    for (const z of [-18.29, 18.29]) {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(10.6, 0.95),
        bannerMat
      );
      banner.position.set(0, 0.62, z);
      if (z > 0) banner.rotation.y = Math.PI;
      enclosures[z < 0 ? 0 : 1].add(banner);
    }
  }
  for (const z of [-18.4, 18.4]) {
    const enclosure = enclosures[z < 0 ? 0 : 1];
    const fence: number[] = [];
    for (let x = -11.4; x <= 11.4; x += 2.85)
      box(enclosure, 0.065, 3.6, 0.065, steel, x, 1.8, z);
    for (let x = -11.4; x < 11.4; x += 0.32) fence.push(x, 1.15, z, x, 3.6, z);
    for (let y = 1.15; y < 3.6; y += 0.32) fence.push(-11.4, y, z, 11.4, y, z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(fence, 3));
    enclosure.add(
      new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({
          color: 0x7e9c96,
          transparent: true,
          opacity: 0.24
        })
      )
    );
  }

  for (const x of [-8.2, 8.2]) {
    const z = x < 0 ? 3 : -3;
    for (let slat = 0; slat < 4; slat++)
      box(stadium, 0.095, 0.08, 2.3, trim, x + slat * 0.1, 0.47, z);
    box(stadium, 0.08, 0.4, 2.3, trim, x - 0.06, 0.77, z);
    for (const end of [-0.9, 0.9])
      box(stadium, 0.4, 0.43, 0.06, steel, x + 0.12, 0.22, z + end);
    box(stadium, 0.4, 0.4, 0.45, dark, x, 0.2, z + 1.7);
  }
  // Umpire chair, ladder and net hardware.
  box(stadium, 0.72, 0.1, 0.6, trim, 7.2, 1.7, 0);
  box(stadium, 0.72, 0.55, 0.08, dark, 7.2, 2.0, -0.3);
  for (const x of [6.91, 7.49]) {
    for (const z of [-0.25, 0.25])
      box(stadium, 0.045, 1.7, 0.045, steel, x, 0.85, z);
  }
  for (let y = 0.3; y < 1.6; y += 0.3)
    box(stadium, 0.65, 0.035, 0.11, steel, 7.2, y, 0.38);
  const lamp = new THREE.MeshStandardMaterial({
    color: 0xf1f3e8,
    emissive: 0xe5eafa,
    emissiveIntensity: 0.65,
    roughness: 0.4
  });
  for (const x of [-10.3, 10.3])
    for (const z of [-16, 16]) {
      box(stadium, 0.14, 9, 0.14, steel, x, 4.5, z);
      box(stadium, 2.1, 0.14, 0.4, dark, x, 9, z);
      for (let i = -1; i <= 1; i++)
        box(stadium, 0.55, 0.3, 0.32, lamp, x + i * 0.65, 8.84, z);
    }
  return { ends, enclosures, group: stadium };
}
