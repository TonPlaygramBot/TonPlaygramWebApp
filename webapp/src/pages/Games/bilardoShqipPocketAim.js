export const resolvePocketMouthAimPoint = ({
  pocketCenter,
  targetPos,
  mouthWidth,
  baseRadius,
  pocketType = 'corner',
  microEps = 1e-6
} = {}) => {
  if (!pocketCenter || !Number.isFinite(pocketCenter.x) || !Number.isFinite(pocketCenter.y)) {
    return null;
  }
  if (!Number.isFinite(mouthWidth) || mouthWidth <= 0) return null;
  if (!Number.isFinite(baseRadius) || baseRadius <= 0) return null;

  const inwardX = -pocketCenter.x;
  const inwardY = -pocketCenter.y;
  const inwardLen = Math.hypot(inwardX, inwardY);
  if (inwardLen <= microEps) {
    return {
      point: {
        x: pocketCenter.x,
        y: pocketCenter.y
      },
      lateralBias: 0,
      inwardAlignment: 0
    };
  }

  const inwardDir = { x: inwardX / inwardLen, y: inwardY / inwardLen };
  const lateralDir = { x: -inwardDir.y, y: inwardDir.x };

  const targetVecX = (targetPos?.x ?? pocketCenter.x) - pocketCenter.x;
  const targetVecY = (targetPos?.y ?? pocketCenter.y) - pocketCenter.y;
  const targetLen = Math.hypot(targetVecX, targetVecY);
  const targetDir =
    targetLen > microEps
      ? { x: targetVecX / targetLen, y: targetVecY / targetLen }
      : inwardDir;

  const lateralBiasRaw = targetDir.x * lateralDir.x + targetDir.y * lateralDir.y;
  const inwardAlignmentRaw = targetDir.x * inwardDir.x + targetDir.y * inwardDir.y;
  const lateralBias = Math.max(-1, Math.min(1, lateralBiasRaw));
  const inwardAlignment = Math.max(-1, Math.min(1, inwardAlignmentRaw));

  const isSidePocket = pocketType === 'side';
  // Aim corridor is intentionally narrower than the geometric mouth so AI seeks
  // the center lane between the two jaws instead of flirting with one jaw.
  const corridorHalfWidth = (mouthWidth * 0.5) * (isSidePocket ? 0.3 : 0.34);
  const entranceDepth =
    baseRadius * (isSidePocket ? 0.72 : 0.68) + baseRadius * 0.14 * Math.max(0, inwardAlignment);

  const sideShiftScale = (isSidePocket ? 0.28 : 0.32) * (0.6 + 0.4 * Math.max(0, inwardAlignment));
  const sideShift = corridorHalfWidth * lateralBias * sideShiftScale;

  return {
    point: {
      x: pocketCenter.x + inwardDir.x * entranceDepth + lateralDir.x * sideShift,
      y: pocketCenter.y + inwardDir.y * entranceDepth + lateralDir.y * sideShift
    },
    lateralBias,
    inwardAlignment
  };
};
