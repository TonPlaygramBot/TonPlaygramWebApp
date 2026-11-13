/** A bounded visible segment between muzzle and impact, including the first
 * frame of a very short shot. Never extends behind the muzzle or past cover. */
export function tracerSpan(distance,age,speed=180,trail=5){
  const end=Math.min(Math.max(0,distance),Math.max(0,age)*speed);
  const start=Math.max(0,end-trail);
  return {start,end,center:(start+end)/2,length:end-start};
}
