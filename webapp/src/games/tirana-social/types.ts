import type {State} from '../tiranastreets/shared/engine.mjs';
export type Member={id:string;name:string;avatar:string;socialId:string;appearance:string;socketId:string;callJoined:boolean;media:{camera:boolean;microphone:boolean};mediaEpoch:string};
export type GameInvitation={id:string;from:string;to:string;fromName:string;toName:string;gameId:string;gameName:string;path:string;status:'pending'|'accepted'|'declined';createdAt:number;expiresAt:number};
export type ExploreSnapshot={version:number;id:string;playerId:string;serverNow:number;state:State;members:Member[];invitations?:GameInvitation[];messages:{id:number;from:string;name:string;text:string;at:number}[];blocked:string[]};
export type ExploreRequest=(action:string,payload?:Record<string,unknown>)=>Promise<any>;
