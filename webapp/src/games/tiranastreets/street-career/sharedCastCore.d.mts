import type {HumanAsset} from './humanRoster.mjs';
export type SharedAsset=HumanAsset & {readonly urls?:readonly string[];readonly sourceGame?:string};
export function buildSharedGameCast(chess:readonly {id:string;label?:string;modelUrls?:readonly string[];license?:string;nonCommercialOnly?:boolean}[]):readonly SharedAsset[];
export function chooseSharedHuman(entity:{id:string;kind:string},cast:readonly SharedAsset[]):SharedAsset;
