export const CUE_STYLE_PRESETS = [
  {
    id: 'heritage-maple',
    name: 'Heritage Maple',
    shaftColor: 0xdeb887,
    stripeColor: 0x1f2937,
    connectorColor: 0xcd7f32,
    buttColor: 0x111111,
    tipColor: 0x1b3f75,
    rackShaftColor: 0xcaa472,
    rackAccentColor: 0x1f2937
  },
  {
    id: 'midnight-onyx',
    name: 'Midnight Onyx',
    shaftColor: 0x2b3542,
    stripeColor: 0x38bdf8,
    connectorColor: 0x94a3b8,
    buttColor: 0x0f172a,
    tipColor: 0x1d4ed8,
    rackShaftColor: 0x3b4758,
    rackAccentColor: 0x38bdf8
  },
  {
    id: 'arctic-ice',
    name: 'Arctic Ice',
    shaftColor: 0xe2e8f0,
    stripeColor: 0x2563eb,
    connectorColor: 0x94a3b8,
    buttColor: 0x1f2937,
    tipColor: 0x2563eb,
    rackShaftColor: 0xcbd5f5,
    rackAccentColor: 0x2563eb
  },
  {
    id: 'ember-flame',
    name: 'Ember Flame',
    shaftColor: 0x7c2d12,
    stripeColor: 0xf97316,
    connectorColor: 0xf59e0b,
    buttColor: 0x1b1b1b,
    tipColor: 0xf97316,
    rackShaftColor: 0x9a3412,
    rackAccentColor: 0xf97316
  },
  {
    id: 'forest-guardian',
    name: 'Forest Guardian',
    shaftColor: 0x14532d,
    stripeColor: 0x10b981,
    connectorColor: 0x22c55e,
    buttColor: 0x052e16,
    tipColor: 0x0d9488,
    rackShaftColor: 0x1c7c42,
    rackAccentColor: 0x10b981
  },
  {
    id: 'royal-indigo',
    name: 'Royal Indigo',
    shaftColor: 0x312e81,
    stripeColor: 0xa855f7,
    connectorColor: 0x7c3aed,
    buttColor: 0x1e1b4b,
    tipColor: 0x6366f1,
    rackShaftColor: 0x4338ca,
    rackAccentColor: 0xa855f7
  }
];

export function getCueStyleById(id) {
  return CUE_STYLE_PRESETS.find((style) => style.id === id) ?? CUE_STYLE_PRESETS[0];
}
