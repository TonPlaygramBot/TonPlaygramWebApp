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

const CABAN_DETAIL = Object.freeze({
  bumpMultiplier: 1.22,
  sheen: 0.58,
  sheenRoughness: 0.46,
  emissiveIntensity: 0.24,
  envMapIntensity: 0.18
})

const CABAN_TONE_GROUPS = Object.freeze([
  {
    idPrefix: 'cabanBlue',
    label: 'Blue',
    tones: ['Sky', 'Royal', 'Navy'],
    hex: ['#52afff', '#2b87e6', '#2264b8']
  },
  {
    idPrefix: 'cabanGreen',
    label: 'Green',
    tones: ['Mint', 'Classic', 'Forest'],
    hex: ['#6fc67e', '#4e9f62', '#387a4b']
  },
  {
    idPrefix: 'cabanBeige',
    label: 'Beige',
    tones: ['Sand', 'Natural', 'Khaki'],
    hex: ['#e3cda7', '#c6a57d', '#a6845d']
  },
  {
    idPrefix: 'cabanDarkGrey',
    label: 'Dark Grey',
    tones: ['Slate', 'Graphite', 'Charcoal'],
    hex: ['#6e6860', '#54504a', '#3a3733']
  }
])

const BASE_PRICE = 700
const PRICE_STEP = 12

export const POOL_ROYALE_CLOTH_VARIANTS = Object.freeze(
  CABAN_TONE_GROUPS.flatMap((group) =>
    group.hex.map((hex, index) => ({
      id: `${group.idPrefix}${group.tones[index]}`,
      name: `${group.label} ${group.tones[index]}`,
      sourceId: 'caban',
      tone: group.label.toLowerCase(),
      baseColor: toNumber(hex),
      palette: buildPalette(hex),
      sparkle: 1.08,
      stray: 1.06,
      detail: CABAN_DETAIL,
      thumbnail: polyHavenThumb('caban'),
      price: BASE_PRICE + PRICE_STEP * index,
      swatches: createSwatches(hex),
      description: `Original Poly Haven caban cloth texture with a ${group.label.toLowerCase()} ${group.tones[index].toLowerCase()} tint.`
    }))
  )
)
