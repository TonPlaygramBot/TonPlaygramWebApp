import * as THREE from 'three';

const SRGB_COLOR_SPACE = THREE.SRGBColorSpace ?? null;

export function applySRGBColorSpace(texture) {
  if (!texture) {
    return;
  }

  if (SRGB_COLOR_SPACE && 'colorSpace' in texture) {
    texture.colorSpace = SRGB_COLOR_SPACE;
  }
}
