import data from './data/humanoidMotions.mjs';

/** Interpolated CC0 motion samples; callers apply them through each rig's IK. */
export function sampleHumanoidMotion(motion,phase,joint,target,offset=false){
  const clip=data.motions[motion],index=data.names.indexOf(joint);
  if(!clip||index<0)return false;
  const p=((phase%1)+1)%1*(clip.frames.length-1),i=Math.floor(p),a=clip.frames[i],b=clip.frames[Math.min(i+1,clip.frames.length-1)],alpha=p-i;
  const k=index*3,rest=data.rest[joint];
  target.set(a[k]+(b[k]-a[k])*alpha-(offset?rest[0]:0),a[k+1]+(b[k+1]-a[k+1])*alpha-(offset?rest[1]:0),a[k+2]+(b[k+2]-a[k+2])*alpha-(offset?rest[2]:0));
  return true;
}
