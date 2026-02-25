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
  const movingChips = [];
  const tmpVector = new THREE.Vector3();
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

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

  function disposeMesh(mesh) {
    if (!mesh) return;
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => mat?.dispose?.());
    } else {
      mesh.material?.dispose?.();
    }
  }

  function createChipMesh(denom) {
    const { materials } = getMaterials(denom);
    const mesh = new THREE.Mesh(geometry, materials.map((mat) => mat.clone()));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.value = denom.value;
    mesh.rotation.y = Math.random() * Math.PI;
    return mesh;
  }

  function removeChildren(group) {
    while (group.children.length) {
      const child = group.children[group.children.length - 1];
      disposeMesh(child);
      group.remove(child);
    }
  }

  function expandChips(amount) {
    const chips = [];
    splitAmount(amount).forEach(({ denom, count }) => {
      for (let i = 0; i < count; i += 1) {
        chips.push({ denom });
      }
    });
    return chips;
  }

  function buildLayout(group, overrides = {}) {
    const baseLayout = group?.userData?.layout ?? {};
    const rightBase = overrides.right ?? baseLayout.right ?? new THREE.Vector3(1, 0, 0);
    const forwardBase = overrides.forward ?? baseLayout.forward ?? new THREE.Vector3(0, 0, 1);
    let right = rightBase.clone().normalize();
    let forward = forwardBase.clone().normalize();
    let up = right.clone().cross(forward);
    if (up.lengthSq() < 1e-6) {
      up = new THREE.Vector3(0, 1, 0);
      forward = new THREE.Vector3(0, 0, 1);
      right = new THREE.Vector3(1, 0, 0);
    } else {
      up.normalize();
      forward = forward.sub(up.clone().multiplyScalar(forward.dot(up))).normalize();
      right = up.clone().cross(forward).normalize();
    }
    return {
      perRow: Math.max(1, Math.floor(overrides.perRow ?? baseLayout.perRow ?? 5)),
      spacing: overrides.spacing ?? baseLayout.spacing ?? radius * 1.65,
      rowSpacing: overrides.rowSpacing ?? baseLayout.rowSpacing ?? radius * 1.25,
      jitter: overrides.jitter ?? baseLayout.jitter ?? radius * 0.28,
      lift: overrides.lift ?? baseLayout.lift ?? 0,
      right,
      forward,
      up
    };
  }

  function layoutOffsets(count, layout) {
    const offsets = [];
    if (count <= 0) return offsets;
    const perRow = Math.max(1, layout.perRow);
    const rows = Math.ceil(count / perRow);
    const colCenter = (perRow - 1) / 2;
    const rowCenter = (rows - 1) / 2;
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const jitterX = (Math.random() - 0.5) * layout.jitter;
      const jitterZ = (Math.random() - 0.5) * layout.jitter;
      const x = (col - colCenter) * layout.spacing + jitterX;
      const z = (row - rowCenter) * layout.rowSpacing + jitterZ;
      offsets.push({ x, z });
    }
    return offsets;
  }

  function scatterChips(group, amount, options = {}) {
    const chips = expandChips(amount);
    const layout = buildLayout(group, options.layout);
    const offsets = layoutOffsets(chips.length, layout);
    chips.forEach((chip, index) => {
      const mesh = createChipMesh(chip.denom);
      const offset = offsets[index] ?? { x: 0, z: 0 };
      const position = new THREE.Vector3();
      position.addScaledVector(layout.right, offset.x);
      position.addScaledVector(layout.forward, offset.z);
      position.y = layout.lift + height / 2;
      mesh.position.copy(position);
      mesh.userData.value = chip.denom.value;
      group.add(mesh);
    });
    group.userData.layout = layout;
  }

  function applyAmount(group, amount, options = {}) {
    const mode = options.mode ?? group?.userData?.mode ?? 'stack';
    const currentMode = group?.userData?.mode ?? 'stack';
    const sameMode = currentMode === mode;
    const sameAmount = group?.userData?.chipValue === amount;
    if (sameAmount && sameMode && mode !== 'scatter') {
      return;
    }
    if (sameAmount && sameMode && mode === 'scatter' && !options.force) {
      return;
    }
    removeChildren(group);
    if (mode === 'scatter') {
      scatterChips(group, amount, options);
    } else {
      let offset = 0;
      splitAmount(amount).forEach(({ denom, count }) => {
        for (let i = 0; i < count; i += 1) {
          const mesh = createChipMesh(denom);
          mesh.position.y = offset + height / 2;
          group.add(mesh);
          offset += height * 0.95;
        }
      });
    }
    group.userData.mode = mode;
    group.userData.chipValue = amount;
  }

  function createStack(amount = 0, options = {}) {
    const group = new THREE.Group();
    group.userData = {
      mode: options.mode ?? 'stack',
      chipValue: 0,
      layout: options.mode === 'scatter' ? buildLayout(null, options.layout) : group.userData?.layout
    };
    applyAmount(group, amount, options);
    return group;
  }

  function disposeStack(group) {
    if (!group) return;
    removeChildren(group);
    group.userData.chipValue = 0;
  }

  function composePosition(origin, layout, offset, liftOverride) {
    const result = origin.clone();
    if (layout) {
      if (layout.right) {
        result.add(tmpVector.copy(layout.right).multiplyScalar(offset.x));
      }
      if (layout.forward) {
        result.add(tmpVector.copy(layout.forward).multiplyScalar(offset.z));
      }
    }
    const lift = liftOverride ?? layout?.lift ?? 0;
    result.y += lift + height / 2;
    return result;
  }

  function animateTransfer(amount, options = {}) {
    const {
      scene,
      start,
      mid,
      end,
      startLayout: startLayoutOverride,
      midLayout: midLayoutOverride,
      endLayout: endLayoutOverride,
      startLift,
      midLift,
      endLift,
      pauseDuration = 0.4,
      toMidDuration = 0.4,
      toEndDuration = 0.6,
      onComplete
    } = options;
    if (!scene || amount <= 0 || !start || !mid || !end) return;
    const chips = expandChips(amount);
    if (!chips.length) return;
    const startLayout = buildLayout(null, startLayoutOverride);
    const midLayout = buildLayout(null, midLayoutOverride ?? startLayoutOverride);
    const endLayout = buildLayout(null, endLayoutOverride ?? startLayoutOverride);
    const startOffsets = layoutOffsets(chips.length, startLayout);
    const midOffsets = layoutOffsets(chips.length, midLayout);
    const endOffsets = layoutOffsets(chips.length, endLayout);

    chips.forEach((chip, index) => {
      const mesh = createChipMesh(chip.denom);
      const startPos = composePosition(start, startLayout, startOffsets[index] ?? { x: 0, z: 0 }, startLift);
      const midPos = composePosition(mid, midLayout, midOffsets[index] ?? { x: 0, z: 0 }, midLift);
      const endPos = composePosition(end, endLayout, endOffsets[index] ?? { x: 0, z: 0 }, endLift);
      mesh.position.copy(startPos);
      scene.add(mesh);
      movingChips.push({
        mesh,
        value: chip.denom.value,
        start: startPos,
        mid: midPos,
        end: endPos,
        phase: 'toMid',
        elapsed: 0,
        pause: Math.max(0, pauseDuration),
        toMidDuration: Math.max(0.1, toMidDuration + Math.random() * 0.12),
        toEndDuration: Math.max(0.1, toEndDuration + Math.random() * 0.18),
        onComplete
      });
    });
  }

  function update(deltaSeconds = 0) {
    if (!movingChips.length) return;
    const clampedDelta = Math.min(0.1, Math.max(0, deltaSeconds));
    for (let i = movingChips.length - 1; i >= 0; i -= 1) {
      const chip = movingChips[i];
      if (!chip.mesh) {
        movingChips.splice(i, 1);
        continue;
      }
      if (chip.phase === 'toMid') {
        chip.elapsed += clampedDelta;
        const t = Math.min(1, chip.elapsed / chip.toMidDuration);
        chip.mesh.position.lerpVectors(chip.start, chip.mid, easeOutCubic(t));
        if (t >= 1) {
          chip.phase = chip.pause > 0 ? 'pause' : 'toEnd';
          chip.elapsed = 0;
        }
      } else if (chip.phase === 'pause') {
        chip.elapsed += clampedDelta;
        if (chip.elapsed >= chip.pause) {
          chip.phase = 'toEnd';
          chip.elapsed = 0;
        }
      } else if (chip.phase === 'toEnd') {
        chip.elapsed += clampedDelta;
        const t = Math.min(1, chip.elapsed / chip.toEndDuration);
        chip.mesh.position.lerpVectors(chip.mid, chip.end, easeOutCubic(t));
        chip.mesh.rotation.y += clampedDelta * 2;
        if (t >= 1) {
          if (chip.mesh.parent) {
            chip.mesh.parent.remove(chip.mesh);
          }
          disposeMesh(chip.mesh);
          if (typeof chip.onComplete === 'function') {
            chip.onComplete(chip.value);
          }
          movingChips.splice(i, 1);
        }
      }
    }
  }

  function dispose() {
    geometry.dispose();
    disposeMaterials();
    movingChips.splice(0, movingChips.length).forEach((chip) => {
      if (chip.mesh?.parent) {
        chip.mesh.parent.remove(chip.mesh);
      }
      disposeMesh(chip.mesh);
    });
  }

  return {
    createStack,
    setAmount: applyAmount,
    disposeStack,
    dispose,
    chipHeight: height,
    animateTransfer,
    update
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
