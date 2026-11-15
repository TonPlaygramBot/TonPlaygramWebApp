type Visitor = {x:number;z:number;carId?:string|null};
export const PYRAMID_MALL:{id:string;name:string;x:number;z:number;radius:number};
export function distanceToPyramid(player?:Visitor|null):number;
export function isNearPyramid(player?:Visitor|null):boolean;
