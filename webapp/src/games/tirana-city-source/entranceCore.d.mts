import type {FacadeEdge} from './sourceCore.mjs';
export function facadeRuns(edges:FacadeEdge[]):FacadeEdge[];
export function exteriorFrontage(edges:FacadeEdge[],direction?:number[]):FacadeEdge|undefined;
export const ROGNER_MAIN_ENTRANCE:{node:string;lat:number;lon:number;source:string};
