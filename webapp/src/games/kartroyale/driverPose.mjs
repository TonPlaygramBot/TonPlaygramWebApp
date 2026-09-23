const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const length=v=>Math.hypot(...v);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
export const STEERING_WHEEL_ANGLE=.65;
export const DRIVER_REST={
 l:{shoulder:[.20,.95,-.32],elbow:[.32,.71,-.07],hand:[.16,.70,.16]},
 r:{shoulder:[-.20,.95,-.32],elbow:[-.32,.71,-.07],hand:[-.16,.70,.16]}
};
export const DRIVER_LEGS={
 l:{hip:[.132,.47,-.23],knee:[.176,.32,.29],ankle:[.176,.22,.65]},
 r:{hip:[-.132,.47,-.23],knee:[-.176,.32,.29],ankle:[-.176,.22,.65]}
};
/** Fixed-length two-bone solve. The pole keeps elbows outside the torso. */
export function elbowFor(shoulder,hand,upper,lower,side,pole=[side,-.25,-.1]) {
 const delta=sub(hand,shoulder),distance=Math.max(.001,length(delta)),axis=scale(delta,1/distance);
 const d=clamp(distance,Math.abs(upper-lower)+.001,upper+lower-.001);
 const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const perpendicular=sub(pole,scale(axis,dot(pole,axis))),n=Math.max(.001,length(perpendicular));
 return add(add(shoulder,scale(axis,along)),scale(perpendicular,height/n));
}
export function driverPose(steer=0,acceleration=0,yawRate=0,speed=0,time=0,reduced=false,feedback={}) {
 const angle=clamp(steer,-1,1)*STEERING_WHEEL_ANGLE;
 const lean=reduced?0:clamp(yawRate*speed*.0014+(feedback.side||0),-.055,.055);
 const recoil=reduced?0:clamp(-acceleration*.00065+(feedback.forward||0),-.035,.045);
 const breath=reduced?0:Math.sin(time*2.4)*.002;
 const arms={},legs={};
 for(const [key,rest] of Object.entries(DRIVER_REST)) {
  const side=key==='l'?1:-1;
  const shoulder=[rest.shoulder[0]+lean,rest.shoulder[1]+breath,rest.shoulder[2]+recoil];
  // Exact rim coordinates: gloves use the same angle as the visible wheel.
  const hand=[side*.16*Math.cos(angle),.70+side*.16*Math.sin(angle),.16];
  const upper=length(sub(rest.elbow,rest.shoulder)),lower=length(sub(rest.hand,rest.elbow));
  arms[key]={shoulder,hand,elbow:elbowFor(shoulder,hand,upper,lower,side)};
 }
 for(const [key,rest] of Object.entries(DRIVER_LEGS)){
  const pedal=clamp(key==='l'?(feedback.brake||0):(feedback.throttle||0),0,1);
  const ankle=[rest.ankle[0],rest.ankle[1]+pedal*.003,rest.ankle[2]-pedal*.004];
  legs[key]={hip:rest.hip,ankle,pedal,knee:elbowFor(rest.hip,ankle,length(sub(rest.knee,rest.hip)),length(sub(rest.ankle,rest.knee)),0,[0,1,0])};
 }
 return {arms,legs,lean,recoil,breath,wheelAngle:angle,headYaw:clamp(-steer*.18,-.18,.18)};
}
