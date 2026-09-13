/** Prefer a compatible locomotion clip; a walking clip is never a cycling pose. */
export function humanMotion(n,clips){
 const moving=n.speed>.15&&n.health>0,cycling=n.motion==='cycle';
 const motion=cycling?'cycle':moving?(n.anim==='run'||n.speed>3?'run':'walk'):'idle';
 let clip=clips.find(c=>new RegExp(motion,'i').test(c.name));
 if(!clip&&motion==='run')clip=clips.find(c=>/walk/i.test(c.name));
 const reference=clip&&/run/i.test(clip.name)?4.2:1.4;
 const rate=moving?Math.max(.5,Math.min(1.8,n.speed/reference)):1;
 return {motion,clip,rate,moving,cycling};
}
export function smoothHeading(current,target,dt){
 const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
 return current+delta*(1-Math.exp(-12*Math.max(0,Math.min(.1,dt))));
}
