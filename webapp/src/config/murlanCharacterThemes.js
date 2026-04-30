import { khronosThumb } from './storeThumbnails.js';

export const MURLAN_CHARACTER_THEMES = Object.freeze([
  {
    id: 'cesium-man',
    label: 'Cesium Man',
    source: 'khronos-sample-models',
    license: 'Apache-2.0',
    price: 0,
    description: 'Open-source Cesium sample character with original PBR textures.',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
    thumbnail: khronosThumb('CesiumMan'),
    scale: 1.0,
    seatOffsetY: -0.84,
    seatOffsetZ: -0.22,
    normalizedSeatOffsetY: -0.4,
    normalizedSeatOffsetZ: 0.52,
    seatPitch: -0.92,
    seatYaw: Math.PI,
    handLift: 1.04
  }
]);
