import { hslToHexNumber } from '../utils/woodMaterials.js';

export const CUE_STYLE_PRESETS = Object.freeze([
  Object.freeze({
    id: 'pro-walnut',
    label: 'Pro Walnut',
    hue: 22,
    sat: 0.4,
    light: 0.44,
    contrast: 0.64,
    source: 'Signature house cue finish'
  }),
  Object.freeze({
    id: 'maple-classic',
    label: 'Maple Classic',
    hue: 35,
    sat: 0.22,
    light: 0.78,
    contrast: 0.44,
    source: 'ambientCG Maple Planks 001 (CC0)'
  }),
  Object.freeze({
    id: 'ebony-luxe',
    label: 'Ebony Luxe',
    hue: 25,
    sat: 0.35,
    light: 0.18,
    contrast: 0.85,
    source: 'ambientCG Ebony Wood 002 (CC0)'
  }),
  Object.freeze({
    id: 'cocobolo-flare',
    label: 'Cocobolo Flare',
    hue: 18,
    sat: 0.52,
    light: 0.42,
    contrast: 0.7,
    source: 'Poly Haven Cocobolo (CC0)'
  }),
  Object.freeze({
    id: 'ash-ice',
    label: 'Nordic Ash',
    hue: 32,
    sat: 0.25,
    light: 0.7,
    contrast: 0.55,
    source: 'ambientCG Ash 004 (CC0)'
  }),
  Object.freeze({
    id: 'carbon-matrix',
    label: 'Carbon Matrix',
    hue: 210,
    sat: 0.08,
    light: 0.16,
    contrast: 0.75,
    source: 'ambientCG Carbon Fiber 002 (CC0)'
  })
]);

export const CUE_RACK_PALETTE = CUE_STYLE_PRESETS.map((preset) =>
  hslToHexNumber(preset.hue, preset.sat, preset.light)
);
