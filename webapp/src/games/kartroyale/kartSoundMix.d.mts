import type {Frame} from './renderer';
export type CueFrame = {track:Frame['track'];time:number;countdown:number;item:Frame['raceItem'];drift:number};
export function kartTrackMix(frame:Frame,enabled:boolean):{rolling:number;roadHz:number;tire:number;tireHz:number;tireQ:number;grit:number;gritHz:number;air:number};
export function kartArcadeCueFrame(previous:CueFrame|null,frame:Frame,enabled:boolean):{
 current:CueFrame;cues:({kind:'charge';tier:number}|{kind:'pickup'})[];
};
