export const TABLE_MODEL_CLASSIC = 'classic'
export const TABLE_MODEL_OPENSOURCE = 'opensource'
export const TABLE_MODEL_OPENSOURCE_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb'

export const SNOOKER_GLB_POCKET_MAPPING = Object.freeze({
  mapping: 'glb-bed-to-game-playfield-pocket-mouths',
  playfieldLengthMm: 3569,
  playfieldWidthMm: 1778,
  cornerMouthMm: 83,
  middleMouthMm: 87
})

function safeFiniteNumber (value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function resolveSnookerGlbPocketLayout (targetSize = {}, options = {}) {
  const width = safePositiveDimension(targetSize.x)
  const length = safePositiveDimension(targetSize.z)
  const y = safeFiniteNumber(options.y, 0)
  const lengthMm = safePositiveDimension(
    options.playfieldLengthMm,
    SNOOKER_GLB_POCKET_MAPPING.playfieldLengthMm
  )
  const mmToUnits = length / lengthMm
  const cornerRadius =
    (safePositiveDimension(options.cornerMouthMm, SNOOKER_GLB_POCKET_MAPPING.cornerMouthMm) *
      mmToUnits) /
    2
  const middleRadius =
    (safePositiveDimension(options.middleMouthMm, SNOOKER_GLB_POCKET_MAPPING.middleMouthMm) *
      mmToUnits) /
    2
  const halfWidth = width / 2
  const halfLength = length / 2
  const cornerInset = Math.min(cornerRadius, halfWidth, halfLength)
  const middleInset = Math.min(middleRadius, halfWidth)
  const pockets = [
    { id: 'BL', x: -halfWidth + cornerInset, y, z: -halfLength + cornerInset, radius: cornerRadius, type: 'corner' },
    { id: 'BR', x: halfWidth - cornerInset, y, z: -halfLength + cornerInset, radius: cornerRadius, type: 'corner' },
    { id: 'TL', x: -halfWidth + cornerInset, y, z: halfLength - cornerInset, radius: cornerRadius, type: 'corner' },
    { id: 'TR', x: halfWidth - cornerInset, y, z: halfLength - cornerInset, radius: cornerRadius, type: 'corner' },
    { id: 'ML', x: -halfWidth + middleInset, y, z: 0, radius: middleRadius, type: 'middle' },
    { id: 'MR', x: halfWidth - middleInset, y, z: 0, radius: middleRadius, type: 'middle' }
  ]

  return {
    mapping: SNOOKER_GLB_POCKET_MAPPING.mapping,
    mmToUnits,
    cornerRadius,
    middleRadius,
    pockets
  }
}

const MIN_GLB_FIT_SIZE = 0.0001

function safePositiveDimension (value, fallback = MIN_GLB_FIT_SIZE) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > MIN_GLB_FIT_SIZE ? numeric : fallback
}

export function resolveSnookerGlbFitTransform (sourceSize = {}, targetSize = {}, options = {}) {
  const sourceX = safePositiveDimension(sourceSize.x)
  const sourceY = safePositiveDimension(sourceSize.y)
  const sourceZ = safePositiveDimension(sourceSize.z)
  const targetX = safePositiveDimension(targetSize.x)
  const targetY = safePositiveDimension(targetSize.y)
  const targetZ = safePositiveDimension(targetSize.z)
  const xScale = targetX / sourceX
  const yScale = targetY / sourceY
  const zScale = targetZ / sourceZ
  const preserveOriginalShape = options.preserveOriginalShape !== false

  if (!preserveOriginalShape) {
    return {
      scale: { x: xScale, y: yScale, z: zScale },
      preservesOriginalShape: false
    }
  }

  const fitAxis = options.fitAxis === 'z' || options.fitAxis === 'long' ? 'z' : 'x'
  const uniformHorizontalScale = fitAxis === 'z' ? zScale : xScale

  return {
    scale: {
      x: uniformHorizontalScale,
      y: uniformHorizontalScale,
      z: uniformHorizontalScale
    },
    preservesOriginalShape: true,
    fitAxis,
    sourceAspect: sourceX / sourceZ,
    targetAspect: targetX / targetZ,
    nonUniformCandidateScale: { x: xScale, y: yScale, z: zScale }
  }
}

export function resolveSnookerTableModel (value) {
  const requested = String(value || '').toLowerCase()
  return requested === TABLE_MODEL_CLASSIC ? TABLE_MODEL_CLASSIC : TABLE_MODEL_OPENSOURCE
}

export function applySnookerTableModelParam (params, tableModel) {
  const resolved = resolveSnookerTableModel(tableModel)
  params.set('tableModel', resolved)
  return resolved
}

export function usesProceduralSnookerTableRailDecor (tableModel) {
  return resolveSnookerTableModel(tableModel) === TABLE_MODEL_CLASSIC
}
