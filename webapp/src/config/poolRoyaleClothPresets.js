const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));

const adjustColor = (hex, factor) => {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;

  const nextR = clampChannel(r * factor);
  const nextG = clampChannel(g * factor);
  const nextB = clampChannel(b * factor);

  return (nextR << 16) | (nextG << 8) | nextB;
};

const colorToHex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const createPalette = (base, { shadow = 0.82, accent = 1.08, highlight = 1.22 } = {}) => ({
  shadow: adjustColor(base, shadow),
  base,
  accent: adjustColor(base, accent),
  highlight: adjustColor(base, highlight)
});

const CABAN_DETAIL = Object.freeze({
  bumpMultiplier: 1.22,
  sheen: 0.58,
  sheenRoughness: 0.46,
  emissiveIntensity: 0.24,
  envMapIntensity: 0.18
});

const CURLY_TEDDY_DETAIL = Object.freeze({
  bumpMultiplier: 1.16,
  sheen: 0.72,
  sheenRoughness: 0.44,
  emissiveIntensity: 0.36,
  envMapIntensity: 0.22
});

const POLAR_FLEECE_DETAIL = Object.freeze({
  bumpMultiplier: 1.12,
  sheen: 0.7,
  sheenRoughness: 0.52,
  emissiveIntensity: 0.34,
  envMapIntensity: 0.14
});

const COTTON_JERSEY_DETAIL = Object.freeze({
  bumpMultiplier: 1.18,
  sheen: 0.6,
  sheenRoughness: 0.48,
  emissiveIntensity: 0.28,
  envMapIntensity: 0.18
});

const createClothPreset = (
  {
    optionId,
    name,
    baseColor,
    sourceId,
    sparkle,
    stray,
    detail,
    description,
    price,
    paletteScale,
    swatches
  }
) => {
  const palette = createPalette(baseColor, paletteScale);
  return Object.freeze({
    optionId,
    name,
    sourceId,
    color: baseColor,
    palette,
    sparkle,
    stray,
    detailOverrides: detail,
    description,
    price,
    swatches: swatches || [colorToHex(baseColor), colorToHex(palette.highlight)]
  });
};

export const POOL_ROYALE_CLOTH_PRESETS = Object.freeze([
  // Caban wool — green spectrum
  createClothPreset({
    optionId: 'cabanMeadowGreen',
    name: 'Caban Wool — Meadow Green',
    baseColor: 0x6f9c52,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 640,
    description: 'Soft caban wool in a meadow green tint for classic lounges.',
    paletteScale: { shadow: 0.8, accent: 1.08, highlight: 1.24 },
    swatches: ['#6f9c52', '#a4c88a']
  }),
  createClothPreset({
    optionId: 'cabanOliveGreen',
    name: 'Caban Wool — Olive Green',
    baseColor: 0x5f7c3f,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 650,
    description: 'Olive caban wool with deeper fibers and earthy warmth.',
    paletteScale: { shadow: 0.8, accent: 1.1, highlight: 1.22 },
    swatches: ['#5f7c3f', '#90b26f']
  }),
  createClothPreset({
    optionId: 'cabanForestGreen',
    name: 'Caban Wool — Forest Green',
    baseColor: 0x4e6b3a,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 660,
    description: 'Dense forest-toned caban wool with crisp stitch depth.',
    paletteScale: { shadow: 0.78, accent: 1.08, highlight: 1.22 },
    swatches: ['#4e6b3a', '#84a169']
  }),
  createClothPreset({
    optionId: 'cabanMossGreen',
    name: 'Caban Wool — Moss Green',
    baseColor: 0x708a4a,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 670,
    description: 'Mossy caban weave with soft nap and mellow highlights.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.24 },
    swatches: ['#708a4a', '#a1c078']
  }),
  createClothPreset({
    optionId: 'cabanMintGreen',
    name: 'Caban Wool — Mint Green',
    baseColor: 0x7fae66,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 680,
    description: 'Light mint caban wool for bright, airy tables.',
    paletteScale: { shadow: 0.82, accent: 1.1, highlight: 1.25 },
    swatches: ['#7fae66', '#b5d79c']
  }),

  // Caban wool — blue spectrum
  createClothPreset({
    optionId: 'cabanMistBlue',
    name: 'Caban Wool — Mist Blue',
    baseColor: 0x7d8aa8,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 640,
    description: 'Cool misty-blue caban wool with soft sheen.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#7d8aa8', '#aec2d6']
  }),
  createClothPreset({
    optionId: 'cabanSlateBlue',
    name: 'Caban Wool — Slate Blue',
    baseColor: 0x6a7692,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 650,
    description: 'Slate caban wool with balanced mid-tones for modern halls.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#6a7692', '#98a6bd']
  }),
  createClothPreset({
    optionId: 'cabanIndigoBlue',
    name: 'Caban Wool — Indigo Blue',
    baseColor: 0x565b7f,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 660,
    description: 'Deep indigo caban wool with concentrated weave depth.',
    paletteScale: { shadow: 0.8, accent: 1.08, highlight: 1.2 },
    swatches: ['#565b7f', '#8c90b5']
  }),
  createClothPreset({
    optionId: 'cabanSteelBlue',
    name: 'Caban Wool — Steel Blue',
    baseColor: 0x6b7f99,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 670,
    description: 'Steel-blue caban wool with crisp contrast and cool sheen.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#6b7f99', '#9fb8c7']
  }),
  createClothPreset({
    optionId: 'cabanMarineBlue',
    name: 'Caban Wool — Marine Blue',
    baseColor: 0x4a5f7a,
    sourceId: 'caban',
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    price: 680,
    description: 'Marine caban wool with dark undertones for luxe lounges.',
    paletteScale: { shadow: 0.8, accent: 1.08, highlight: 1.22 },
    swatches: ['#4a5f7a', '#7c97ad']
  }),

  // Curly teddy natural — green spectrum
  createClothPreset({
    optionId: 'curlyTeddyNaturalClover',
    name: 'Curly Teddy Natural — Clover Green',
    baseColor: 0x77c38a,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 690,
    description: 'Plush curly teddy in clover green with defined curls.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#77c38a', '#a7e2b5']
  }),
  createClothPreset({
    optionId: 'curlyTeddyNaturalFern',
    name: 'Curly Teddy Natural — Fern Green',
    baseColor: 0x6aae86,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 700,
    description: 'Fern-toned curly teddy with rich fibers and depth.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#6aae86', '#9bd5b0']
  }),
  createClothPreset({
    optionId: 'curlyTeddyNaturalJade',
    name: 'Curly Teddy Natural — Jade Green',
    baseColor: 0x5fa37a,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 710,
    description: 'Jade curly teddy with balanced sheen and curl contrast.',
    paletteScale: { shadow: 0.8, accent: 1.08, highlight: 1.22 },
    swatches: ['#5fa37a', '#8fcb9f']
  }),
  createClothPreset({
    optionId: 'curlyTeddyNaturalMoss',
    name: 'Curly Teddy Natural — Moss Green',
    baseColor: 0x5b8f69,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 720,
    description: 'Mossy curly teddy with soft curls and darker base.',
    paletteScale: { shadow: 0.8, accent: 1.08, highlight: 1.22 },
    swatches: ['#5b8f69', '#8abc95']
  }),
  createClothPreset({
    optionId: 'curlyTeddyNaturalPistachio',
    name: 'Curly Teddy Natural — Pistachio',
    baseColor: 0x8ccf9a,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 730,
    description: 'Pistachio curly teddy with bright, airy loft.',
    paletteScale: { shadow: 0.84, accent: 1.1, highlight: 1.24 },
    swatches: ['#8ccf9a', '#b6e8c0']
  }),

  // Curly teddy natural — blue spectrum
  createClothPreset({
    optionId: 'curlyTeddyNaturalSky',
    name: 'Curly Teddy Natural — Sky Blue',
    baseColor: 0x8ab6de,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 690,
    description: 'Sky-blue curly teddy with airy sheen and soft nap.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#8ab6de', '#b8d4f1']
  }),
  createClothPreset({
    optionId: 'curlyTeddyNaturalGlacier',
    name: 'Curly Teddy Natural — Glacier Blue',
    baseColor: 0x78a4cf,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 700,
    description: 'Glacier-toned curly teddy with crisp curl edges.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#78a4cf', '#a9c6e4']
  }),
  createClothPreset({
    optionId: 'curlyTeddyNaturalDenim',
    name: 'Curly Teddy Natural — Denim Blue',
    baseColor: 0x6c90c0,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 710,
    description: 'Denim-inspired curly teddy with dimensional curls.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#6c90c0', '#9fb4da']
  }),
  createClothPreset({
    optionId: 'curlyTeddyNaturalOcean',
    name: 'Curly Teddy Natural — Ocean Blue',
    baseColor: 0x5f7fae,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 720,
    description: 'Oceanic curly teddy with saturated mid-tones.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#5f7fae', '#92a8cb']
  }),
  createClothPreset({
    optionId: 'curlyTeddyNaturalTwilight',
    name: 'Curly Teddy Natural — Twilight Blue',
    baseColor: 0x566f9e,
    sourceId: 'curly_teddy_natural',
    sparkle: 1.16,
    stray: 1.14,
    detail: CURLY_TEDDY_DETAIL,
    price: 730,
    description: 'Twilight blue curly teddy with subdued highlights.',
    paletteScale: { shadow: 0.8, accent: 1.08, highlight: 1.22 },
    swatches: ['#566f9e', '#879bc0']
  }),

  // Polar fleece — green spectrum
  createClothPreset({
    optionId: 'polarFleeceMint',
    name: 'Polar Fleece — Mint',
    baseColor: 0x7ad8a1,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 660,
    description: 'Minty polar fleece with lifted nap and crisp highs.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#7ad8a1', '#a8f0c3']
  }),
  createClothPreset({
    optionId: 'polarFleecePine',
    name: 'Polar Fleece — Pine',
    baseColor: 0x5fa97b,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 670,
    description: 'Pine polar fleece with earthy undertones and soft loft.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#5fa97b', '#8bd1a1']
  }),
  createClothPreset({
    optionId: 'polarFleeceWasabi',
    name: 'Polar Fleece — Wasabi',
    baseColor: 0x78c47e,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 680,
    description: 'Bold wasabi polar fleece with textured nap.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#78c47e', '#a7e3aa']
  }),
  createClothPreset({
    optionId: 'polarFleeceSpruce',
    name: 'Polar Fleece — Spruce',
    baseColor: 0x4f8d67,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 690,
    description: 'Spruce polar fleece with darker fibers and strong depth.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#4f8d67', '#7cb894']
  }),
  createClothPreset({
    optionId: 'polarFleeceEmerald',
    name: 'Polar Fleece — Emerald',
    baseColor: 0x3f9e6f,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 700,
    description: 'Emerald polar fleece with lush highlights and soft glow.',
    paletteScale: { shadow: 0.8, accent: 1.08, highlight: 1.22 },
    swatches: ['#3f9e6f', '#6fc69a']
  }),

  // Polar fleece — blue spectrum
  createClothPreset({
    optionId: 'polarFleeceIce',
    name: 'Polar Fleece — Ice Blue',
    baseColor: 0x92c8f0,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 660,
    description: 'Ice-blue polar fleece with airy loft and shimmer.',
    paletteScale: { shadow: 0.86, accent: 1.08, highlight: 1.2 },
    swatches: ['#92c8f0', '#bfe2fb']
  }),
  createClothPreset({
    optionId: 'polarFleeceArctic',
    name: 'Polar Fleece — Arctic Blue',
    baseColor: 0x74b4e1,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 670,
    description: 'Arctic polar fleece with crisp nap and cool base.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#74b4e1', '#a6d1f0']
  }),
  createClothPreset({
    optionId: 'polarFleeceLagoon',
    name: 'Polar Fleece — Lagoon Blue',
    baseColor: 0x5b9fcf,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 680,
    description: 'Lagoon polar fleece with saturated mid-tones.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#5b9fcf', '#8ac1e3']
  }),
  createClothPreset({
    optionId: 'polarFleeceCobalt',
    name: 'Polar Fleece — Cobalt Blue',
    baseColor: 0x4a86c1,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 690,
    description: 'Cobalt polar fleece with bright highlights and sheen.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#4a86c1', '#7aaad8']
  }),
  createClothPreset({
    optionId: 'polarFleeceNavy',
    name: 'Polar Fleece — Navy Blue',
    baseColor: 0x3f6ea8,
    sourceId: 'polar_fleece',
    sparkle: 1.12,
    stray: 1.1,
    detail: POLAR_FLEECE_DETAIL,
    price: 700,
    description: 'Navy polar fleece with deep pile and glossy peaks.',
    paletteScale: { shadow: 0.8, accent: 1.08, highlight: 1.22 },
    swatches: ['#3f6ea8', '#6b96c5']
  }),

  // Cotton jersey — green spectrum
  createClothPreset({
    optionId: 'cottonJerseySage',
    name: 'Cotton Jersey — Sage',
    baseColor: 0x7fb07c,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 650,
    description: 'Sage cotton jersey with soft knit and airy weave.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#7fb07c', '#b2d6ad']
  }),
  createClothPreset({
    optionId: 'cottonJerseyOlive',
    name: 'Cotton Jersey — Olive',
    baseColor: 0x6f9b62,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 660,
    description: 'Olive cotton jersey with warm stitch contrast.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#6f9b62', '#9cc78f']
  }),
  createClothPreset({
    optionId: 'cottonJerseyVerdant',
    name: 'Cotton Jersey — Verdant',
    baseColor: 0x5c8f55,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 670,
    description: 'Verdant cotton jersey with heavier knit texture.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#5c8f55', '#8dc789']
  }),
  createClothPreset({
    optionId: 'cottonJerseyLime',
    name: 'Cotton Jersey — Lime',
    baseColor: 0x7fbd62,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 680,
    description: 'Lime cotton jersey with bright, playful knit.',
    paletteScale: { shadow: 0.84, accent: 1.1, highlight: 1.24 },
    swatches: ['#7fbd62', '#b4e695']
  }),
  createClothPreset({
    optionId: 'cottonJerseyJuniper',
    name: 'Cotton Jersey — Juniper',
    baseColor: 0x4f7d55,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 690,
    description: 'Juniper cotton jersey with grounded greens and cozy knit.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#4f7d55', '#7fab89']
  }),

  // Cotton jersey — blue spectrum
  createClothPreset({
    optionId: 'cottonJerseySky',
    name: 'Cotton Jersey — Sky Blue',
    baseColor: 0x7fb2d8,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 650,
    description: 'Sky-blue cotton jersey with soft highlights.',
    paletteScale: { shadow: 0.86, accent: 1.08, highlight: 1.2 },
    swatches: ['#7fb2d8', '#adcfed']
  }),
  createClothPreset({
    optionId: 'cottonJerseyDenim',
    name: 'Cotton Jersey — Denim Blue',
    baseColor: 0x6a8fb8,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 660,
    description: 'Denim-toned cotton jersey with defined knit detail.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#6a8fb8', '#97b4d4']
  }),
  createClothPreset({
    optionId: 'cottonJerseySlate',
    name: 'Cotton Jersey — Slate Blue',
    baseColor: 0x5f7fa0,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 670,
    description: 'Slate cotton jersey with cool knit texture.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#5f7fa0', '#8ca4c0']
  }),
  createClothPreset({
    optionId: 'cottonJerseyAzure',
    name: 'Cotton Jersey — Azure',
    baseColor: 0x5a9fc8,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 680,
    description: 'Azure cotton jersey with bright airy highs.',
    paletteScale: { shadow: 0.84, accent: 1.08, highlight: 1.22 },
    swatches: ['#5a9fc8', '#88c3df']
  }),
  createClothPreset({
    optionId: 'cottonJerseyTeal',
    name: 'Cotton Jersey — Teal Blue',
    baseColor: 0x4a8bb0,
    sourceId: 'cotton_jersey',
    sparkle: 1.08,
    stray: 1.06,
    detail: COTTON_JERSEY_DETAIL,
    price: 690,
    description: 'Teal cotton jersey with balanced blue-green stitch.',
    paletteScale: { shadow: 0.82, accent: 1.08, highlight: 1.22 },
    swatches: ['#4a8bb0', '#79b3c8']
  })
]);

