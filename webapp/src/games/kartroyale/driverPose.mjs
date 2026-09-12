const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const length=v=>Math.hypot(...v);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
export const DRIVER_REST={
  l:{shoulder:[.20,.95,-.32],elbow:[.32,.71,-.07],hand:[.16,.70,.16]},
  r:{shoulder:[-.20,.95,-.32],elbow:[-.32,.71,-.07],hand:[-.16,.70,.16]}
};
/** Fixed-length two-bone solve. The pole keeps elbows outside the torso. */
export function elbowFor(shoulder,hand,upper,lower,side) {
  const delta=sub(hand,shoulder),distance=Math.max(.001,length(delta)),axis=scale(delta,1/distance);
  const d=clamp(distance,Math.abs(upper-lower)+.001,upper+lower-.001);
  const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const pole=[side,-.25,-.1],perpendicular=sub(pole,scale(axis,dot(pole,axis))),n=Math.max(.001,length(perpendicular));
  return add(add(shoulder,scale(axis,along)),scale(perpendicular,height/n));
}
export function driverPose(steer=0,acceleration=0,yawRate=0,speed=0,time=0,reduced=false) {
  const angle=clamp(steer,-1,1)*.65,lean=reduced?0:clamp(yawRate*speed*.002,-.045,.045),breath=reduced?0:Math.sin(time*2.4)*.003;
  const arms={};
  for(const [key,rest] of Object.entries(DRIVER_REST)) {
    const side=key==='l'?1:-1;
    const shoulder=[rest.shoulder[0]+lean,rest.shoulder[1]+breath,rest.shoulder[2]+clamp(-acceleration*.0008,-.018,.018)];
    const hand=[side*.16*Math.cos(angle),.70+side*.16*Math.sin(angle),.16];
    const upper=length(sub(rest.elbow,rest.shoulder)),lower=length(sub(rest.hand,rest.elbow));
    arms[key]={shoulder,hand,elbow:elbowFor(shoulder,hand,upper,lower,side)};
  }
  return {arms,lean,breath,headYaw:clamp(-steer*.22,-.22,.22)};
}
