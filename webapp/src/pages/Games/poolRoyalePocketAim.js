export const resolvePocketMouthAimPoint = ({
  pocketCenter,
  targetPos,
  balls = [],
  ignoredBallIds = [],
  ballRadius = null,
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

  const entryDepth = entranceDepth;
  const laneHalfWidth = Math.max(corridorHalfWidth * 0.72, baseRadius * 0.24);
  const ballR = Number.isFinite(ballRadius) && ballRadius > 0
    ? ballRadius
    : baseRadius * 0.22;
  const ignored = new Set(ignoredBallIds.map((id) => String(id)));
  const nearJawSign = lateralBias >= 0 ? 1 : -1;
  let nearJawCrowd = 0;
  let farJawCrowd = 0;
  let laneCrowd = 0;
  balls.forEach((ball) => {
    if (!ball?.active) return;
    const id = ball?.id == null ? null : String(ball.id);
    if (id && ignored.has(id)) return;
    const relX = ball.pos.x - pocketCenter.x;
    const relY = ball.pos.y - pocketCenter.y;
    const depth = relX * inwardDir.x + relY * inwardDir.y;
    if (depth < -ballR * 0.5 || depth > entryDepth + ballR * 2.8) return;
    const lateral = relX * lateralDir.x + relY * lateralDir.y;
    if (Math.abs(lateral) <= laneHalfWidth + ballR * 0.4) {
      laneCrowd += 1;
    }
    if (Math.abs(lateral) < laneHalfWidth + ballR * 0.5) {
      const sign = lateral >= 0 ? 1 : -1;
      if (sign === nearJawSign) nearJawCrowd += 1;
      else farJawCrowd += 1;
    }
  });

  const cleanMouth = laneCrowd === 0 && nearJawCrowd === 0 && farJawCrowd === 0;
  const farJawBias =
    !cleanMouth && nearJawCrowd > farJawCrowd
      ? -nearJawSign
      : nearJawCrowd < farJawCrowd
        ? nearJawSign
        : 0;
  const sideShiftScale = cleanMouth
    ? 0
    : (isSidePocket ? 0.24 : 0.29) * (0.55 + 0.45 * Math.max(0, inwardAlignment));
  const sideShift = corridorHalfWidth * (farJawBias || lateralBias) * sideShiftScale;

  return {
    point: {
      x: pocketCenter.x + inwardDir.x * entranceDepth + lateralDir.x * sideShift,
      y: pocketCenter.y + inwardDir.y * entranceDepth + lateralDir.y * sideShift
    },
    lateralBias,
    inwardAlignment,
    cleanMouth,
    nearJawCrowd,
    farJawCrowd
  };
};
