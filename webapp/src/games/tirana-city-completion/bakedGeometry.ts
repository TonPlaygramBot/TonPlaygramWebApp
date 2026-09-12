import * as T from 'three';
import {COMPLETION_MESHES} from './meshData.mjs';
/** All copies use the evaluated Blender mesh, including the in-chat review. */
export function bakedParts(name:string){return (COMPLETION_MESHES.models[name]||[]).map(p=>({
 material:p.material,geometry:new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(p.position,3)).setAttribute('normal',new T.Float32BufferAttribute(p.normal,3))
}));}
export function bakedMaterial(name:string){const p=COMPLETION_MESHES.materials[name];return new T.MeshStandardMaterial({color:new T.Color().fromArray(p.color),roughness:p.roughness,metalness:p.metalness});}
