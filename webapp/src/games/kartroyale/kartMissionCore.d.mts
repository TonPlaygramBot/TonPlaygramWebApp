export type KartJob={id:string;title:string;track:string;difficulty:string;objective:string;reward:number;description:string;place?:number;seconds?:number;minHealth?:number};
export type KartJobs={completed:string[];best:Record<string,number>};
export const KART_MISSIONS:readonly KartJob[];
export function normalizeKartJobs(raw:unknown):KartJobs;
export function availableKartJob(jobs:unknown,id:string):boolean;
export function evaluateKartJob(id:string,result:unknown,minimumHealth:number):{success:boolean;reason:string};
export function completeKartJob(jobs:unknown,id:string,result:unknown,minimumHealth:number):{jobs:KartJobs;reward:number;success:boolean;reason:string};
export type KartAction='steer'|'brake'|'boost'|'drift';
export class KartControlState {hold(token:string,action:KartAction,value?:number|boolean):void;release(token:string):void;clear():void;setEnabled(value:boolean):void;read():{steer:number;brake:boolean;boost:boolean;drift:boolean};}
export const KART_KEYS:Readonly<Record<string,readonly [KartAction,number|boolean]>>;
