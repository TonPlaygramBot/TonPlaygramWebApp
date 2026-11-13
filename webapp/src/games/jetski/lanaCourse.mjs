import { HYDROGRAPHY } from '../tirana-environment/hydrography.mjs';

// The city renderer uses these same OSM reaches. Their missing 37 m seam
// beneath the boulevard is joined by the two mapped endpoints.
const east = HYDROGRAPHY.paths.find(({ id }) => id === '733080610');
const west = HYDROGRAPHY.paths.find(({ id }) => id === '672838261');
export const LANA_CHANNEL_WIDTH = east.width;
export const LANA_RISE = 0.5;
export const LANA_SAMPLE_COUNT = 240;
const channelStartX = 750;
const channelEndX = -515;
const startX = 620;
const finishX = -245;

function sliceByX(line, firstX, lastX) {
  const result = [];
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    if (ax < lastX || bx > firstX) continue;
    const from = Math.min(ax, firstX);
    const to = Math.max(bx, lastX);
    if (!result.length)
      result.push([from, az + (bz - az) * ((from - ax) / (bx - ax))]);
    if (from !== to)
      result.push([to, az + (bz - az) * ((to - ax) / (bx - ax))]);
  }
  return result;
}

const mapped = [...east.line, ...west.line];
export const LANA_CHANNEL = {
  id: 'lana-jet-ski',
  width: LANA_CHANNEL_WIDTH,
  line: sliceByX(mapped, channelStartX, channelEndX)
};
const lengthOf = (line) =>
  line
    .slice(1)
    .reduce(
      (sum, b, i) => sum + Math.hypot(b[0] - line[i][0], b[1] - line[i][1]),
      0
    );
const courseLength = lengthOf(sliceByX(LANA_CHANNEL.line, startX, finishX));
const segments = [];
let walked = -lengthOf(sliceByX(LANA_CHANNEL.line, channelStartX, startX));
for (let i = 1; i < LANA_CHANNEL.line.length; i++) {
  const a = LANA_CHANNEL.line[i - 1];
  const b = LANA_CHANNEL.line[i];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  segments.push({ a, dx: b[0] - a[0], dz: b[1] - a[1], length, start: walked });
  walked += length;
}

export function makeLanaPoints() {
  let index = 0;
  return Array.from({ length: LANA_SAMPLE_COUNT }, (_, i) => {
    const distance = (i * courseLength) / (LANA_SAMPLE_COUNT - 1);
    while (segments[index].start + segments[index].length < distance) index++;
    const segment = segments[index];
    const t = (distance - segment.start) / segment.length;
    return {
      x: segment.a[0] + segment.dx * t,
      z: segment.a[1] + segment.dz * t
    };
  });
}

export function nearestLana(x, z) {
  let closestDistanceSquared = Infinity;
  let nearestX = x;
  let nearestZ = z;
  let along = 0;
  for (const { a, dx, dz, length, start } of segments) {
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (length * length))
    );
    const px = a[0] + dx * t;
    const pz = a[1] + dz * t;
    const distanceSquared = (x - px) ** 2 + (z - pz) ** 2;
    if (distanceSquared >= closestDistanceSquared) continue;
    closestDistanceSquared = distanceSquared;
    nearestX = px;
    nearestZ = pz;
    along = start + length * t;
  }
  const last = LANA_SAMPLE_COUNT - 1;
  const index = Math.max(
    0,
    Math.min(last, Math.round((along / courseLength) * last))
  );
  return {
    index,
    distance: Math.sqrt(closestDistanceSquared),
    x: nearestX,
    z: nearestZ
  };
}

export const lanaChannelDistance = (x, z) => nearestLana(x, z).distance;
