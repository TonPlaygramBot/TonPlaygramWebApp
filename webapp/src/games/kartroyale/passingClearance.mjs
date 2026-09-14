import { MIN_PASSING_WIDTH } from './racingDimensions.mjs';

/** Conservative continuous clearance test. A distance-to-obstacle oracle is
 * 1-Lipschitz: half a probe interval reserves the space between probe points.
 * Used only during cached course construction, never during a physics frame.
 */
export function segmentHasClearance(a, b, radius, clearance, spacing = 1) {
  if (![a.x,a.z,b.x,b.z,radius,spacing].every(Number.isFinite) || radius < 0 || spacing <= 0)
    throw new TypeError('Finite segment, nonnegative radius and positive spacing required');
  const length = Math.hypot(b.x-a.x,b.z-a.z);
  const count = Math.max(1, Math.ceil(length/spacing));
  const reserve = length/(2*count);
  for (let i=0;i<=count;i++) {
    const t=i/count, available=clearance(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);
    if (!Number.isFinite(available) || available < radius+reserve) return false;
  }
  return true;
}

/** Widen only certified dry, unobstructed shoulders. Never move a building,
 * pave a lake, silently replace a circuit or make an existing road narrower.
 * The caller supplies the SAME joined edges used by renderer and barriers.
 * Any unsolved bottlenecks remain explicit in the returned audit.
 */
export function widenPassingSections(track, { clearance, sides, minimum = MIN_PASSING_WIDTH }) {
  if (!Array.isArray(track?.points) || track.points.length<3 || !Number.isFinite(minimum) || minimum<=0 || typeof clearance!=='function' || typeof sides!=='function')
    throw new TypeError('Track points and a positive passing width required');
  if (!track.points.every(p=>p && [p.x,p.z].every(Number.isFinite))) throw new TypeError('Invalid track coordinates');
  const original=track.points.map(p=>p.width??track.width);
  if (!original.every(w=>Number.isFinite(w)&&w>0)) throw new TypeError('Invalid track widths');
  const points=track.points.map((p,i)=>({...p,width:Math.max(original[i],minimum)}));
  const count=points.length, widened=new Set(original.flatMap((w,i)=>w<minimum?[i]:[]));
  // Reject unsafe candidates together. Re-evaluate neighbouring miters after
  // each rejection, since a width transition changes the adjoining edges.
  for (let pass=0;pass<=count && widened.size;pass++) {
    const edge=sides(points), rejected=new Set();
    const radius=i=>Math.max(...['left','right'].map(side=>Math.hypot(edge[side][i].x-points[i].x,edge[side][i].z-points[i].z)));
    for(let i=0;i<count;i++) {
      const j=(i+1)%count;
      if(!widened.has(i)&&!widened.has(j))continue;
      if(!segmentHasClearance(points[i],points[j],Math.max(radius(i),radius(j)),clearance)) {
        if(widened.has(i))rejected.add(i);
        if(widened.has(j))rejected.add(j);
      }
    }
    if(!rejected.size)break;
    for(const i of rejected){points[i].width=original[i];widened.delete(i);}
  }
  points.forEach((p,i)=>{track.points[i].width=p.width;});
  track.width=Math.max(...points.map(p=>p.width));
  return {
    requiredWidth:minimum,
    minimumWidth:Math.min(...points.map(p=>p.width)),
    widenedSamples:widened.size,
    unresolved:points.flatMap((p,index)=>p.width+1e-6<minimum?[{index,x:p.x,z:p.z,width:p.width}]:[])
  };
}
