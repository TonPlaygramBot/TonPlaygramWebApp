export const PANORAMA_FAR:number;
export const DURRES_REFERENCE:Readonly<{latitude:number;longitude:number;source:string;accuracy:string}>;
export const PANORAMA_SOURCE:string;
export function panoramaBlend(height:number):number;
export function panoramaVisible(viewer:{x:number;y:number;z:number},bounds:readonly number[]):boolean;
