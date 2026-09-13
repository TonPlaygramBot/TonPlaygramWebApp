export type PlayerAsset={id:string;url:string};
export type PlayerEntry={id:string;label:string;author:string;licence:string;source:string;url?:string;preview?:string;uid?:string};
export const PLAYER_CATALOG:readonly PlayerEntry[];
export function playerAssetFor(id:string,manifest?:{players?:Record<string,unknown>}):PlayerAsset|null;
export function selectPlayerAsset(asset:PlayerAsset|null):void;
export function selectedPlayerAsset():PlayerAsset|null;
export function selectedPlayerUrl():string|null;
