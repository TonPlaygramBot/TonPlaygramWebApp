export type NativeModelId = 'clock' | 'mosque' | 'pyramid' | 'museum' | 'eyes' | 'skanderbeg';
export type ModelData = { id: NativeModelId; lod: 'near' | 'far'; meshes: {material:string; positions:number[]; normals:number[]}[]; bounds: {min:number[]; max:number[]}; triangles:number };
export const MATERIALS: Readonly<Record<string,{color:number;roughness:number;metalness:number}>>;
export const NATIVE_MODEL_IDS: readonly NativeModelId[];
export function buildNativeModel(id:NativeModelId,lod?:'near'|'far'):ModelData;
