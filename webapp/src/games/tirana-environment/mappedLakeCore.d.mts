export type LakePolygon={outer:number[][];holes?:number[][][]};
export type LakeSource={id:string;source?:string;polygons:LakePolygon[]};
export type LakeProfile={name:string;color:number;shore:number;resolution:number;range:number};
export type MappedLake=LakeSource&{profile:LakeProfile};
export const LAKE_PROFILES:Record<string,LakeProfile>;
export function selectMappedLakes(sources:readonly LakeSource[]):MappedLake[];
export function lakeShoreTexture(polygons:LakePolygon[],size:number,range:number):{data:Uint8Array;minX:number;minZ:number;width:number;depth:number};
