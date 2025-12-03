import { hslToHexNumber } from '../utils/woodMaterials.js';

export const CUE_STYLE_PRESETS = Object.freeze([
  Object.freeze({
    id: 'redwood-ember',
    label: 'Redwood Ember',
    hue: 18,
    sat: 0.56,
    light: 0.42,
    contrast: 0.72,
    source: 'ambientCG Redwood 003 (CC0)'
  }),
  Object.freeze({
    id: 'birch-frost',
    label: 'Birch Frost',
    hue: 33,
    sat: 0.18,
    light: 0.8,
    contrast: 0.46,
    source: 'ambientCG Birch 002 (CC0)'
  }),
  Object.freeze({
    id: 'wenge-nightfall',
    label: 'Wenge Nightfall',
    hue: 24,
    sat: 0.32,
    light: 0.2,
    contrast: 0.88,
    source: 'ambientCG Wenge 002 (CC0)'
  }),
  Object.freeze({
    id: 'mahogany-heritage',
    label: 'Mahogany Heritage',
    hue: 15,
    sat: 0.44,
    light: 0.36,
    contrast: 0.78,
    source: 'Poly Haven Mahogany 004 (CC0)'
  }),
  Object.freeze({
    id: 'walnut-satin',
    label: 'Walnut Satin',
    hue: 21,
    sat: 0.4,
    light: 0.5,
    contrast: 0.68,
    source: 'ambientCG Walnut 002 (CC0)'
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
