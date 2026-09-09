// Shared browser/server metres-based lookup. Tracks are immutable once cached.
const cache = new WeakMap();
const wrap = (n, length) => ((n % length) + length) % length;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
function metrics(track) {
  let value = cache.get(track);
  if (value) return value;
  const points = track.points;
  if (!Array.isArray(points) || points.length < 3) throw Error('Invalid circuit');
  const lengths = new Float64Array(points.length);
  const distance = new Float64Array(points.length + 1);
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    if (![p.x, p.z, q.x, q.z].every(Number.isFinite)) throw Error('Invalid circuit coordinate');
    const length = Math.hypot(q.x - p.x, q.z - p.z);
    if (length < 1e-8) throw Error('Degenerate circuit segment');
    lengths[i] = length;
    distance[i + 1] = distance[i] + length;
  }
  value = {lengths, distance, length: distance.at(-1)};
  cache.set(track, value);
  return value;
}
export function circuitDistance(track, near) {
  const m = metrics(track), index = near.index;
  if (!Number.isInteger(index) || index < 0 || index >= track.points.length ||
      !Number.isFinite(near.x) || !Number.isFinite(near.z)) throw Error('Invalid circuit projection');
  const p = track.points[index], q = track.points[(index + 1) % track.points.length];
  const t = clamp(((near.x-p.x)*(q.x-p.x)+(near.z-p.z)*(q.z-p.z)) / m.lengths[index] ** 2, 0, 1);
  return m.distance[index] + t * m.lengths[index];
}
export function sampleCircuitDistance(track, metres) {
  if (!Number.isFinite(metres)) throw Error('Invalid circuit distance');
  const m = metrics(track), at = wrap(metres, m.length);
  let low=0, high=track.points.length;
  while (low + 1 < high) {
    const mid=(low+high)>>1;
    if (m.distance[mid] <= at) low=mid; else high=mid;
  }
  const p=track.points[low], q=track.points[(low+1)%track.points.length];
  const t=(at-m.distance[low])/m.lengths[low];
  return {x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t,yaw:Math.atan2(q.x-p.x,q.z-p.z),index:low,distance:at};
}
export function pointAhead(track, near, metres) {
  return sampleCircuitDistance(track, circuitDistance(track, near)+metres);
}
/** Existing arcade braking envelope, evaluated at real upcoming corner distances
 * rather than an average sample length. Does not alter track or player physics. */
export function cornerSpeedLimit(track, near, horizon=45) {
  const m=metrics(track), count=track.points.length, at=circuitDistance(track,near);
  let limit=32;
  for(let step=1;step<=count;step++){
    const index=(near.index+step)%count;
    const ahead=wrap(m.distance[index]-at,m.length);
    if(ahead>horizon)break;
    const previous=(index+count-1)%count;
    const before=track.points[previous],corner=track.points[index],after=track.points[(index+1)%count];
    const turn=Math.atan2(after.x-corner.x,after.z-corner.z)-Math.atan2(corner.x-before.x,corner.z-before.z);
    const angle=Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)));
    const support=Math.max(.1,(m.lengths[previous]+m.lengths[index])*.5);
    const curve=angle/support;
    if(curve>.005)limit=Math.min(limit,Math.sqrt(4.2/curve+2*16*Math.max(0,ahead-8)));
  }
  return Math.max(7,limit);
}
