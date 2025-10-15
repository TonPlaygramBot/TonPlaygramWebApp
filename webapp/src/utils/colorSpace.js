import * as THREE from 'three';

const LEGACY_SRGB_ENCODING = 3001;

function getLegacySrgbEncoding() {
  return LEGACY_SRGB_ENCODING;
}

export function applySRGBColorSpace(target) {
  if (!target) return;
  if ('colorSpace' in target) {
    target.colorSpace = THREE.SRGBColorSpace;
  } else {
    target.encoding = getLegacySrgbEncoding();
  }
}

export function applyRendererSRGB(renderer) {
  if (!renderer) return;
  if ('outputColorSpace' in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else {
    renderer.outputEncoding = getLegacySrgbEncoding();
  }
}
