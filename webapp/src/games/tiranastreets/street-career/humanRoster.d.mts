import type {NPC,Point} from '../shared/engine.mjs';
export type HumanAsset={readonly id:string;readonly label:string;readonly sourceId:string;readonly url:string;readonly roles:readonly string[];readonly licence:string};
export const HUMAN_ROSTER:readonly HumanAsset[];
export function stableActorHash(id:string):number;
export function actorRole(kind:string):string;
export function humanFor(entity:Pick<NPC,'id'|'kind'>):HumanAsset;
export function nearbyHumans(entities:readonly NPC[],viewer:Point,battery?:boolean):NPC[];
export function screenStick(dx:number,dy:number,radius?:number):{x:number;y:number};
