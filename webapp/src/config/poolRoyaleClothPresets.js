import { polyHavenThumb } from './storeThumbnails.js'

const normalizeHex = (value) => {
  const asString =
    typeof value === 'number'
      ? value.toString(16).padStart(6, '0')
      : String(value || '').replace('#', '')
  return `#${asString.slice(0, 6)}`
}

const clampChannel = (channel) => Math.max(0, Math.min(255, Math.round(channel)))

const adjustHex = (hex, factor) => {
  const normalized = normalizeHex(hex).slice(1)
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  const target = factor >= 0 ? 255 : 0
  const amount = Math.min(1, Math.max(-1, factor))
  const delta = Math.abs(amount)
  const adjust = (channel) => clampChannel(channel + (target - channel) * delta)
  const next = (adjust(r) << 16) | (adjust(g) << 8) | adjust(b)
  return `#${next.toString(16).padStart(6, '0')}`
}

const toNumber = (hex) => parseInt(normalizeHex(hex).slice(1), 16)

const buildPalette = (baseHex) => ({
  shadow: toNumber(adjustHex(baseHex, -0.22)),
  base: toNumber(baseHex),
  accent: toNumber(adjustHex(baseHex, 0.12)),
  highlight: toNumber(adjustHex(baseHex, 0.24))
})

const createSwatches = (baseHex) => [
  normalizeHex(baseHex),
  adjustHex(baseHex, 0.16),
  adjustHex(baseHex, 0.3)
]

const CABAN_SOURCE_ID = 'caban'
const CABAN_LABEL = 'Caban Wool'
const CABAN_BASE_PRICE = 690
const CABAN_PRICE_STEP = 12

const CABAN_DETAIL = Object.freeze({
  bumpMultiplier: 1.22,
  sheen: 0.58,
  sheenRoughness: 0.46,
  emissiveIntensity: 0.24,
  envMapIntensity: 0.18
})

const CABAN_SHADE_GROUPS = Object.freeze([
  {
    tone: 'blue',
    label: 'Blue',
    shades: [
      { id: 'bright', name: 'Bright', hex: '#1f8ff5' },
      { id: 'medium', name: 'Medium', hex: '#166fca' },
      { id: 'dark', name: 'Dark', hex: '#0f4f95' }
    ]
  },
  {
    tone: 'green',
    label: 'Green',
    shades: [
      { id: 'bright', name: 'Bright', hex: '#3bbf73' },
      { id: 'medium', name: 'Medium', hex: '#2a995d' },
      { id: 'dark', name: 'Dark', hex: '#1d6f43' }
    ]
  },
  {
    tone: 'beige',
    label: 'Beige',
    shades: [
      { id: 'bright', name: 'Bright', hex: '#d8c197' },
      { id: 'medium', name: 'Medium', hex: '#b89f73' },
      { id: 'dark', name: 'Dark', hex: '#927c54' }
    ]
  },
  {
    tone: 'darkGrey',
    label: 'Dark Grey',
    shades: [
      { id: 'bright', name: 'Bright', hex: '#6f7783' },
      { id: 'medium', name: 'Medium', hex: '#525962' },
      { id: 'dark', name: 'Dark', hex: '#353a41' }
    ]
  }
])

const createCabanVariant = ({ tone, label, shade, index, groupIndex }) => {
  const id = `caban${label.replace(/\s+/g, '')}${shade.name}`
  const price = CABAN_BASE_PRICE + groupIndex * 12 + index * CABAN_PRICE_STEP
  return {
    id,
    name: `${CABAN_LABEL} — ${label} ${shade.name}`,
    sourceId: CABAN_SOURCE_ID,
    tone,
    baseColor: toNumber(shade.hex),
    palette: buildPalette(shade.hex),
    sparkle: 1.08,
    stray: 1.06,
    detail: CABAN_DETAIL,
    thumbnail: polyHavenThumb(CABAN_SOURCE_ID),
    price,
    swatches: createSwatches(shade.hex),
    description:
      `${CABAN_LABEL} cloth in ${label.toLowerCase()} (${shade.name.toLowerCase()}) using the original ` +
      'Poly Haven Caban glTF texture mapping.'
  }
}

export const POOL_ROYALE_CLOTH_VARIANTS = Object.freeze(
  CABAN_SHADE_GROUPS.flatMap((group, groupIndex) =>
    group.shades.map((shade, index) =>
      createCabanVariant({
        tone: group.tone,
        label: group.label,
        shade,
        index,
        groupIndex
      })
    )
  )
)
