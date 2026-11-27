import {driftTier} from './arcadeRules.mjs';
const unit=value=>Number.isFinite(value)?Math.max(0,Math.min(value,1)):0;
const speedOf=value=>Number.isFinite(value)?Math.min(55,Math.abs(value)):0;
const ROAD={
 asphalt:{bed:.42,roadHz:690,tireHz:1770,tireQ:2.7,grit:0,gritHz:960},
 gravel:{bed:1,roadHz:510,tireHz:1220,tireQ:1.8,grit:.6,gritHz:1900},
 dirt:{bed:.8,roadHz:350,tireHz:850,tireQ:1.2,grit:.29,gritHz:1180}
};
export function kartTrackMix(frame,enabled){
 const road=Object.hasOwn(ROAD,frame.track.surface)?ROAD[frame.track.surface]:ROAD.asphalt;
 const speed=speedOf(frame.speed),moving=enabled&&speed>0,ground=moving&&!frame.airborne;
 const mix=unit(speed/36);
 const slip=ground?Math.max(unit(frame.tireSlip),frame.drifting?.14:0):0;
 return {
  rolling:ground?unit(speed/27)*road.bed*.075:0, roadHz:road.roadHz+120*mix,
  tire:ground?Math.min(.17,slip*speed*.025):0,tireHz:road.tireHz+230*mix,tireQ:road.tireQ,
  grit:ground?mix*road.grit*.085:0,gritHz:road.gritHz+220*mix,
  air:moving?Math.min(.085,speed*.0015):0
 };
}
/** Local presentation only. Physics and rewards remain in the shared race rules. */
export function kartArcadeCueFrame(previous,frame,enabled){
 const current={track:frame.track,time:frame.time,countdown:frame.countdown,
  item:frame.raceItem??null,drift:enabled&&frame.drifting?driftTier(frame.driftCharge):0};
 const cues=[];
 if(enabled&&previous&&previous.track===current.track&&current.time>=previous.time&&current.countdown===0&&previous.countdown===0){
  if(current.drift>previous.drift)cues.push({kind:'charge',tier:current.drift});
  if(current.item&&current.item!==previous.item)cues.push({kind:'pickup'});
 }
 return {current,cues};
}
