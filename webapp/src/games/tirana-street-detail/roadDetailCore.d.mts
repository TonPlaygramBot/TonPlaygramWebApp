export type Decal={kind:string;x:number;z:number;w:number;d:number;yaw:number;evidence?:string};
export type Post={id:string;x:number;z:number;radius:number;height:number;evidence:string};
export type RoadDetails={decals:readonly Decal[];posts:readonly Post[];cycles:readonly any[];accuracy:string};
export const POST_RADIUS:number,POST_HEIGHT:number;
export function segmentDistance(x:number,z:number,a:readonly number[],b:readonly number[]):number;
export function cyclingSide(road:any,river?:readonly any[]):null|{sides:number[];evidence:string;width:number};
export function buildRoadDetails(world:any,options?:{signals?:readonly any[];river?:readonly any[];includeCycling?:boolean;exclude?:(x:number,z:number,radius:number)=>boolean}):RoadDetails;
export function createPostCollider(posts:readonly Post[]):(body:{x:number;z:number},radius:number)=>boolean;

export function ribbonExclusion(track:{points:readonly any[];width:number}):(x:number,z:number,pad?:number)=>boolean;

export function streetDetailProfile(profile:'fps'|'street'|'racing'):{readonly roadY:number;readonly postY:number;readonly skipPaint:readonly string[]};
