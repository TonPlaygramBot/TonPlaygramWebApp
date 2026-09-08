import type {Track} from './simulation.mjs';
export type TurnGuide={x:number;z:number;y:number;yaw:number;direction:'left'|'right';approach:{x:number;z:number};at:number};
export function turnGuides(track:Pick<Track,'points'|'width'|'length'>,options?:{lookAhead?:number;minTurn?:number;spacing?:number}):TurnGuide[];
