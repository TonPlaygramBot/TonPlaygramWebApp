import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';

const DENOMINATIONS = [
  { value: 1, color: '#f2b21a' },
  { value: 2, color: '#f97316' },
  { value: 5, color: '#d54a3a' },
  { value: 10, color: '#2196f3' },
  { value: 20, color: '#4caf50' },
  { value: 50, color: '#3a3331' },
  { value: 100, color: '#6366f1' },
  { value: 200, color: '#7b4abd' },
  { value: 500, color: '#a3362e' },
  { value: 1000, color: '#1fb3d6' }
];

export function createChipFactory(renderer, { cardWidth }) {
  const radius = cardWidth * 0.18;
  const height = cardWidth * 0.04;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 64, 1, false);
  const cache = new Map();

  function getMaterials(denom) {
    const key = denom.value;
    if (cache.has(key)) return cache.get(key);
    const topTexture = makeChipTexture(denom.color, denom.value, renderer);
    const topMaterial = new THREE.MeshPhysicalMaterial({
      map: topTexture,
      roughness: 0.3,
      metalness: 0.6,
      clearcoat: 1,
      reflectivity: 0.8
    });
    const sideMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(denom.color),
      roughness: 0.2,
      metalness: 0.8,
      clearcoat: 1
    });
    const bottomMaterial = topMaterial.clone();
    const materials = [sideMaterial, topMaterial, bottomMaterial];
    cache.set(key, { materials, texture: topTexture });
    return cache.get(key);
  }

  function disposeMaterials() {
    cache.forEach(({ materials, texture }) => {
      materials.forEach((mat) => mat?.dispose?.());
      texture?.dispose?.();
    });
    cache.clear();
  }

  function createChipMesh(denom) {
    const { materials } = getMaterials(denom);
    return new THREE.Mesh(geometry, materials.map((mat) => mat.clone()));
  }

  function applyAmount(group, amount) {
    while (group.children.length) {
      const child = group.children[group.children.length - 1];
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose?.());
      } else {
        child.material?.dispose?.();
      }
      group.remove(child);
    }
    const chips = splitAmount(amount);
    let offset = 0;
    chips.forEach(({ denom, count }) => {
      for (let i = 0; i < count; i += 1) {
        const mesh = createChipMesh(denom);
        mesh.position.y = offset + height / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        offset += height * 0.95;
      }
    });
  }

  function createStack(amount = 0) {
    const group = new THREE.Group();
    applyAmount(group, amount);
    return group;
  }

  function disposeStack(group) {
    if (!group) return;
    while (group.children.length) {
      const child = group.children[group.children.length - 1];
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose?.());
      } else {
        child.material?.dispose?.();
      }
      group.remove(child);
    }
  }

  function dispose() {
    geometry.dispose();
    disposeMaterials();
  }

  return {
    createStack,
    setAmount: applyAmount,
    disposeStack,
    dispose,
    chipHeight: height
  };
}

function splitAmount(amount) {
  let remaining = Math.max(0, Math.floor(amount));
  const stacks = [];
  for (let i = DENOMINATIONS.length - 1; i >= 0; i -= 1) {
    const denom = DENOMINATIONS[i];
    const count = Math.floor(remaining / denom.value);
    if (count > 0) {
      stacks.push({ denom, count });
      remaining -= count * denom.value;
    }
  }
  if (stacks.length === 0) {
    stacks.push({ denom: DENOMINATIONS[0], count: 0 });
  }
  return stacks;
}

function makeChipTexture(color, value, renderer) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, '#222');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2.2, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 200; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.lineWidth = 12;
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = 'bold 180px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(tex);
  tex.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}
