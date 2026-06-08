import * as THREE from 'three';

export const INLINE_HELICOPTER_PREVIEW_URL = '/assets/helicopter_inline_preview/helicopter_inline_preview.html';

let inlineHelicopterGeometryPromise = null;

function base64ToFloat32Array(base64) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

async function loadInlineHelicopterPayload() {
  const response = await fetch(INLINE_HELICOPTER_PREVIEW_URL);
  if (!response.ok) {
    throw new Error(`Inline helicopter preview failed to load: ${response.status}`);
  }
  const html = await response.text();
  const base64 = html.match(/const\s+B64\s*=\s*'([^']+)'/)?.[1];
  const vertexCount = Number(html.match(/const\s+VCOUNT\s*=\s*(\d+)/)?.[1] || 0);
  if (!base64 || !vertexCount) {
    throw new Error('Inline helicopter preview is missing geometry data.');
  }
  return { base64, vertexCount };
}

export async function loadInlineHelicopterGeometry() {
  if (!inlineHelicopterGeometryPromise) {
    inlineHelicopterGeometryPromise = (async () => {
      const { base64, vertexCount } = await loadInlineHelicopterPayload();
      const data = base64ToFloat32Array(base64);
      const interleaved = new THREE.InterleavedBuffer(data, 9);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
      geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(interleaved, 3, 3));
      geometry.setAttribute('color', new THREE.InterleavedBufferAttribute(interleaved, 3, 6));
      geometry.setDrawRange(0, vertexCount);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometry.userData.sharedInlineHelicopter = true;
      return geometry;
    })();
  }
  return inlineHelicopterGeometryPromise;
}

export function fitInlineHelicopterObject(model, targetSize = 5.2) {
  model.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxLength = Math.max(size.x, size.y, size.z);
  if (Number.isFinite(maxLength) && maxLength > 0) {
    model.scale.multiplyScalar(targetSize / maxLength);
  }
  model.updateMatrixWorld?.(true);
  const fittedBox = new THREE.Box3().setFromObject(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= center.y;
  model.position.z -= center.z;
  model.updateMatrixWorld?.(true);
  return model;
}

export async function createInlineHelicopterModel({ targetSize = 5.2 } = {}) {
  const geometry = await loadInlineHelicopterGeometry();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.16,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'inline_helicopter_preview_mesh';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.name = 'inline_helicopter_preview';
  group.add(mesh);
  fitInlineHelicopterObject(group, targetSize);
  return group;
}
