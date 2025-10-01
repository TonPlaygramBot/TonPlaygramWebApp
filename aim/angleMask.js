const TWO_PI = Math.PI * 2;
const EPS = 1e-9;

function normalizeAngle(angle) {
  let a = angle % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

function angularWidth(start, end) {
  return end - start;
}

function addWrappedInterval(target, start, end) {
  const width = angularWidth(start, end);
  if (width <= EPS) return;
  if (width >= TWO_PI - EPS) {
    target.push({ start: 0, end: TWO_PI });
    return;
  }
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizedStart + width;
  if (normalizedEnd <= TWO_PI + EPS) {
    target.push({ start: normalizedStart, end: Math.min(normalizedEnd, TWO_PI) });
  } else {
    target.push({ start: normalizedStart, end: TWO_PI });
    target.push({ start: 0, end: normalizedEnd - TWO_PI });
  }
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  const sorted = intervals
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end + EPS) {
      if (current.end > last.end) last.end = current.end;
    } else {
      merged.push(current);
    }
  }
  // Collapse wrap-around if needed
  if (
    merged.length > 1 &&
    merged[0].start <= EPS &&
    merged[merged.length - 1].end >= TWO_PI - EPS
  ) {
    const first = merged.shift();
    merged[merged.length - 1].end = TWO_PI;
    merged.unshift({ start: 0, end: first.end });
  }
  // Clamp bounds to [0, 2π]
  return merged.map((i) => ({
    start: Math.max(0, Math.min(TWO_PI, i.start)),
    end: Math.max(0, Math.min(TWO_PI, i.end))
  }));
}

function computeIntervalsForBall(ball, params, meta) {
  const { C, rBall, rShaft, epsilon, L } = params;
  const R = rBall + rShaft + epsilon;
  const dx = ball.pos.x - C.x;
  const dz = ball.pos.z - C.z;
  const rhoSq = dx * dx + dz * dz;
  const rho = Math.sqrt(rhoSq);
  if (rho <= EPS) {
    meta.kind = 'degenerate';
    meta.delta = Math.PI;
    return [{ start: 0, end: TWO_PI }];
  }

  const alpha = Math.atan2(dz, dx);
  const center = alpha + Math.PI;
  const ratio = Math.min(1, R / Math.max(rho, EPS));
  const delta = Math.asin(ratio);
  meta.center = center;
  meta.delta = delta;

  const baseStart = center - delta;
  const baseEnd = center + delta;
  const cosDelta = Math.sqrt(Math.max(0, 1 - ratio * ratio));
  const intervals = [];

  if (L > EPS) {
    const Lhat = L / rho;
    if (Lhat >= 1) {
      intervals.push({ start: baseStart, end: baseEnd, mode: 'interior-full' });
    } else if (Lhat > cosDelta + EPS) {
      const psi0 = Math.acos(Math.min(1, Lhat));
      if (psi0 < delta - EPS) {
        intervals.push({ start: baseStart, end: center - psi0, mode: 'interior-edge' });
        intervals.push({ start: center + psi0, end: baseEnd, mode: 'interior-edge' });
      }
    }

    const q = (rhoSq + L * L - R * R) / (2 * rho * L);
    if (q <= -1 + EPS) {
      intervals.push({ start: baseStart, end: baseEnd, mode: 'endpoint-full' });
    } else if (q < 1 - EPS) {
      const psiLimit = Math.acos(Math.max(-1, Math.min(1, q)));
      const span = Math.min(psiLimit, delta);
      if (span > EPS) {
        intervals.push({ start: center - span, end: center + span, mode: 'endpoint' });
      }
    } else if (Math.abs(q - 1) <= 1e-6) {
      intervals.push({ start: center, end: center, mode: 'endpoint-touch' });
    }
  } else {
    if (rho <= R + EPS) {
      intervals.push({ start: 0, end: TWO_PI, mode: 'degenerate' });
    }
  }

  meta.intervals = intervals.map(({ start, end, mode }) => ({ start, end, mode }));
  return intervals;
}

export function computeAngleMask(params) {
  const blockedRaw = [];
  const perBallMeta = [];
  const { balls = [] } = params;
  for (let i = 0; i < balls.length; i += 1) {
    const meta = { index: i };
    const intervals = computeIntervalsForBall(balls[i], params, meta);
    perBallMeta.push(meta);
    intervals.forEach(({ start, end }) => {
      addWrappedInterval(blockedRaw, start, end);
    });
  }
  const blocked = mergeIntervals(blockedRaw);
  let allowed;
  if (blocked.length === 0) {
    allowed = [{ start: 0, end: TWO_PI }];
  } else if (blocked.length === 1 && blocked[0].start <= EPS && blocked[0].end >= TWO_PI - EPS) {
    allowed = [];
  } else {
    allowed = [];
    let cursor = 0;
    for (let i = 0; i < blocked.length; i += 1) {
      const current = blocked[i];
      if (current.start > cursor + EPS) {
        allowed.push({ start: cursor, end: current.start });
      }
      cursor = Math.max(cursor, current.end);
    }
    if (cursor < TWO_PI - EPS) {
      allowed.push({ start: cursor, end: TWO_PI });
    }
  }
  return {
    blocked,
    allowed,
    meta: { perBall: perBallMeta }
  };
}

function angularDiff(a, b) {
  let diff = b - a;
  diff = ((diff + Math.PI) % TWO_PI) - Math.PI;
  return diff;
}

export function chooseNearestAllowed(phi, allowed) {
  const phiNorm = normalizeAngle(phi);
  if (!allowed || allowed.length === 0) {
    return { theta: phiNorm, distance: Infinity, hitInterval: null };
  }
  let bestDistance = Infinity;
  let bestTheta = phiNorm;
  let bestInterval = null;
  for (let i = 0; i < allowed.length; i += 1) {
    const interval = allowed[i];
    if (interval.start - EPS <= phiNorm && phiNorm <= interval.end + EPS) {
      return { theta: phiNorm, distance: 0, hitInterval: interval };
    }
    const diffStart = Math.abs(angularDiff(phiNorm, interval.start));
    if (diffStart < bestDistance - EPS) {
      bestDistance = diffStart;
      bestTheta = interval.start;
      bestInterval = interval;
    }
    const diffEnd = Math.abs(angularDiff(phiNorm, interval.end));
    if (diffEnd < bestDistance - EPS) {
      bestDistance = diffEnd;
      bestTheta = interval.end;
      bestInterval = interval;
    }
  }
  return { theta: normalizeAngle(bestTheta), distance: bestDistance, hitInterval: bestInterval };
}
