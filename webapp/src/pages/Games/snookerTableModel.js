export const TABLE_MODEL_CLASSIC = 'classic'
export const TABLE_MODEL_OPENSOURCE = 'opensource'
export const TABLE_MODEL_OPENSOURCE_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb'

const MIN_GLB_FIT_SIZE = 0.0001
const DEFAULT_GLB_FIT_OPTIONS = Object.freeze({ preserveOriginalShape: true })

function safePositiveDimension (value, fallback = MIN_GLB_FIT_SIZE) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > MIN_GLB_FIT_SIZE ? numeric : fallback
}

function resolveUniformOfficialScale (sourceX, sourceZ, targetX, targetZ) {
  const sourceLong = Math.max(sourceX, sourceZ)
  const targetLong = Math.max(targetX, targetZ)
  const longAxisScale = targetLong / sourceLong
  if (Number.isFinite(longAxisScale) && longAxisScale > MIN_GLB_FIT_SIZE) {
    return longAxisScale
  }
  const sourceShort = Math.min(sourceX, sourceZ)
  const targetShort = Math.min(targetX, targetZ)
  const shortAxisScale = targetShort / sourceShort
  return Number.isFinite(shortAxisScale) && shortAxisScale > MIN_GLB_FIT_SIZE ? shortAxisScale : 1
}

export function resolveSnookerGlbFitTransform (sourceSize = {}, targetSize = {}, options = {}) {
  const fitOptions = { ...DEFAULT_GLB_FIT_OPTIONS, ...(options || {}) }
  const sourceX = safePositiveDimension(sourceSize.x)
  const sourceY = safePositiveDimension(sourceSize.y)
  const sourceZ = safePositiveDimension(sourceSize.z)
  const targetX = safePositiveDimension(targetSize.x)
  const targetY = safePositiveDimension(targetSize.y)
  const targetZ = safePositiveDimension(targetSize.z)

  if (fitOptions.preserveOriginalShape !== false) {
    const horizontalScale = resolveUniformOfficialScale(sourceX, sourceZ, targetX, targetZ)
    return {
      scale: {
        x: horizontalScale,
        y: horizontalScale,
        z: horizontalScale
      },
      preservesOriginalShape: true,
      mapping: 'official-long-axis-uniform-scale'
    }
  }

  return {
    scale: {
      x: targetX / sourceX,
      y: targetY / sourceY,
      z: targetZ / sourceZ
    },
    preservesOriginalShape: false,
    mapping: 'axis-fit-scale'
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
