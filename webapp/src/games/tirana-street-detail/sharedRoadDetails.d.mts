import type {RoadDetails} from './roadDetailCore.mjs';
export const STREET_DETAILS:RoadDetails;
export const collideDetailPosts:(body:{x:number;z:number},radius:number)=>boolean;
export function detailPostObstacles(origin?:{x:number;z:number}):{x:number;z:number;w:number;d:number;h:number;minY:number}[];
