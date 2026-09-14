import { sampleCircuitDistance, cornerSpeedLimit } from './circuitMetrics.mjs';
import { boostPads } from './arcadeRules.mjs';
import { surfaceHeight } from './racingSurface.mjs';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const cache = new WeakMap();
export const ROAD_SURFACE_Y = .115;
export const TYRE_RADIUS = .57;
export const TYRE_EDGE_OFFSET = .90;

function fitsRoad(track,bump){
  const s=Math.sin(bump.yaw),c=Math.cos(bump.yaw);
  for(const u of [-.5,0,.5])for(const v of [-.5,0,.5]){
    const x=bump.x+s*u*bump.length+c*v*bump.width,z=bump.z+c*u*bump.length-s*v*bump.width;
    let onRoad=false;
    for(let i=0;i<track.points.length;i++){
      const a=track.points[i],b=track.points[(i+1)%track.points.length],dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
      const width=(a.width??track.width)*(1-t)+(b.width??track.width)*t;
      if(Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<width/2-.12){onRoad=true;break;}
    }
    if(!onRoad)return false;
  }
  return true;
}

/** Authored event humps, not claims about real Tirana road obstacles. The same
 * immutable profiles drive the visible mesh, every wheel and server physics. */
export function roadBumps(track) {
  if (cache.has(track)) return cache.get(track);
  const bumps = [];
  // Keep simple synthetic/test tracks and the original API free of obstacles.
  if (track.roadFeelVersion === 1) {
    const count = clamp(Math.floor(track.length / 145), 6, 22);
    const pads = boostPads(track);
    const add=(at,cornerOnly=false)=>{
        const p = sampleCircuitDistance(track,at);
        const before=sampleCircuitDistance(track,at-6),after=sampleCircuitDistance(track,at+6);
        const turn=Math.abs(Math.atan2(Math.sin(after.yaw-before.yaw),Math.cos(after.yaw-before.yaw)));
        const corner=turn>.055;
        const width = track.points[p.index].width ?? track.width;
        if (p.distance < 65 || track.length - p.distance < 65 || width < 2.1 || turn>1.8 || (cornerOnly&&!corner)||
            cornerSpeedLimit(track, p, 4) < 11 ||
            pads.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 23) ||
            bumps.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 65)) return false;
        const narrow=width<3.5;
        const bump={...p,id:bumps.length,width:width-(narrow?.3:.8),length:narrow?2.8:corner?3.6:4.2,
          height:narrow?(corner?.11:.14):corner?.17:.22+(bumps.length%3)*.025,corner};
        while(bump.width>=1.4&&!fitsRoad(track,bump))bump.width-=.15;
        if(bump.width<1.4)return false;
        bumps.push(bump);return true;
    };
    // Reserve a third for turn approaches/apexes; do not reject every bend.
    for(let at=80;at<track.length-65&&bumps.length<Math.ceil(count/3);at+=9)add(at,true);
    for(let i=0;i<count&&bumps.length<count;i++){
      for(let attempt=0;attempt<14;attempt++)if(add(track.length*(i+.45)/count+attempt*7))break;
    }
    bumps.sort((a,b)=>a.distance-b.distance);
  }
  cache.set(track, bumps);
  return bumps;
}

export function roadHeight(bumps, x, z) {
  let height = 0;
  for (const b of bumps) {
    const dx = x - b.x, dz = z - b.z;
    const along = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
    const across = Math.abs(dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw));
    if (Math.abs(along) >= b.length / 2 || across >= b.width / 2) continue;
    const edge = clamp((b.width / 2 - across) / .35, 0, 1);
    height = Math.max(height, b.height * Math.cos(along / b.length * Math.PI) ** 2 * edge);
  }
  return height;
}

export function resetSuspension(r) {
  r.suspension = { height: 0, velocity: 0, pitch: 0, pitchVelocity: 0,
    roll: 0, rollVelocity: 0, wheels: [0, 0, 0, 0], grip: 1 };
  r.bumpImpact = 0;
}

/** Four contact patches and damped body springs, advanced only by the fixed
 * simulation clock. Fast humps unload the tyres briefly without random flips. */
export function stepSuspension(r, track, dt) {
  if (!r.suspension) resetSuspension(r);
  const state = r.suspension, bumps = roadBumps(track);
  const s = Math.sin(r.yaw), c = Math.cos(r.yaw);
  const wheelbase = (r.bodyLength || 2.7) * .67;
  const trackWidth = (r.bodyWidth || 1.72) * .83;
  const previous = state.wheels.reduce((a, b) => a + b, 0) / 4;
  const ground=surfaceHeight(track,r.x,r.z);
  for (let i = 0; i < 4; i++) {
    const side = (i % 2 ? -1 : 1) * trackWidth / 2;
    const along = (i < 2 ? 1 : -1) * wheelbase / 2;
    const x=r.x+s*along+c*side,z=r.z+c*along-s*side;
    state.wheels[i] = roadHeight(bumps,x,z)+surfaceHeight(track,x,z)-ground;
  }
  const [fl, fr, rl, rr] = state.wheels;
  const average = (fl + fr + rl + rr) / 4;
  const bumpRate = Math.abs(average - previous) / dt;
  r.bumpImpact = Math.max((r.bumpImpact || 0) * Math.exp(-dt * 8), clamp(bumpRate * .16, 0, 1));
  const heavy = ['oopi', 'aegis'].includes(r.kartId);
  const spring = heavy ? 125 : 165, damping = heavy ? 17 : 21;
  const pitch = clamp(((rl + rr) - (fl + fr)) / (2 * wheelbase) - (r.acceleration || 0) * .0026, -.4, .4);
  const roll = clamp(((fl + rl) - (fr + rr)) / (2 * trackWidth) + (r.yawRate || 0) * r.speed * .0025, -.35, .35);
  const steps = Math.ceil(dt * 120), step = dt / steps;
  for (let i = 0; i < steps; i++) {
    for (const [key, velocity, target] of [['height', 'velocity', average], ['pitch', 'pitchVelocity', pitch], ['roll', 'rollVelocity', roll]]) {
      state[velocity] += ((target - state[key]) * spring - state[velocity] * damping) * step;
      state[key] += state[velocity] * step;
    }
  }
  state.height = clamp(state.height, -.04, .3);
  state.grip = clamp(1 - Math.max(0, state.height - average) * 1.6 - r.bumpImpact * .12, .72, 1);
}
