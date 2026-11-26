// Visual intensity only. Speed is the game's normal closing speed in m/s.
// Aircraft or other callers without a road impact severity retain their look.
export function roadCrashVisuals(severity,radius){
 if(!Number.isFinite(severity))return {debris:12,dustRadius:radius||2,kick:1};
 const s=Math.max(0,severity);
 if(s<4.5)return {debris:0,dustRadius:0,kick:0};
 if(s<8)return {debris:2,dustRadius:0,kick:.32};
 if(s<15)return {debris:6,dustRadius:Math.min(1.5,s*.1),kick:.6};
 return {debris:Math.min(16,8+Math.round((s-15)*.32)),dustRadius:Math.min(3.8,s*.14),kick:Math.min(1.3,s/21)};
}
