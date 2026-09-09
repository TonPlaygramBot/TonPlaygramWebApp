export type KartTasks={version:1;completed:string[];best:Record<string,number>};
export type KartTask={readonly id:string;readonly title:string;readonly track:string;readonly difficulty:string;readonly description:string;readonly seconds?:number;readonly health?:number;readonly place?:number;readonly xp:number};
export const KART_TASK_KEY:string;export const KART_TASKS:readonly KartTask[];
export function freshKartTasks():KartTasks;
export function normalizeKartTasks(raw:unknown):KartTasks;
export function kartTaskXP(profile:KartTasks):number;
export function finishKartTask(profile:KartTasks,id:string,result:unknown):{profile:KartTasks;complete:boolean;xp:number;reason:string};
export function loadKartTasks(storage?:Pick<Storage,'getItem'>):KartTasks;
export function saveKartTasks(storage:Pick<Storage,'setItem'>|undefined,profile:KartTasks):boolean;
