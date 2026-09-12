export const WEATHER_NAMES = ['Clear', 'Cloudy', 'Overcast', 'Rain', 'Mist'];
const profiles = [
  {cloud:.08,rain:0,fog:.00038}, {cloud:.48,rain:0,fog:.00055},
  {cloud:.9,rain:0,fog:.00085}, {cloud:1,rain:1,fog:.00135},
  {cloud:.55,rain:0,fog:.0021}
];
export function environmentRandom(seed, step) {
  let x=(seed ^ Math.imul(step+1,0x9e3779b9))>>>0;
  x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);
  return ((x^(x>>>15))>>>0)/4294967296;
}
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** Pure presentation clock: frame rate, pause duration and sampling order cannot
 * change the weather. No gameplay RNG or multiplayer state is consumed. */
export function environmentAt(seed, seconds=0) {
  seconds=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const slot=Math.floor(seconds/300),within=seconds-slot*300;
  const index=n=>Math.min(4,Math.floor(environmentRandom(seed,n+20)*5));
  const previous=index(slot-1),next=index(slot),blend=smooth(0,45,within);
  const from=profiles[previous],to=profiles[next];
  const hour=(environmentRandom(seed,0)*24+seconds/180)%24;
  const sunHeight=Math.sin((hour-6)/24*Math.PI*2)*Math.cos(41.3275*Math.PI/180);
  const daylight=smooth(-.12,.22,sunHeight);
  const cloud=mix(from.cloud,to.cloud,blend),rain=mix(from.rain,to.rain,blend);
  const wetness=Math.max(rain,from.rain*(1-smooth(0,150,within)));
  const minutes=Math.floor(hour*60);
  return {hour,clock:`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,
    name:WEATHER_NAMES[blend<.5?previous:next],cloud,rain,wetness,sunHeight,daylight,
    fog:mix(from.fog,to.fog,blend),golden:daylight*(1-smooth(.08,.38,sunHeight)),night:1-daylight};
}
let sessionSeed;
export function environmentSeed() {
  if(sessionSeed===undefined){const values=new Uint32Array(1);if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(values);else values[0]=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;sessionSeed=values[0];}
  return sessionSeed;
}
